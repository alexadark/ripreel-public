'use server';

/**
 * Shot-based Video Generation Server Actions
 *
 * Server actions for managing shots and Veo 3.1 video generation.
 *
 * MVP SIMPLIFICATION:
 * - Shots are INDEPENDENT (no extend API chaining)
 * - Max 8 seconds per shot
 * - AI cuts scenes into narrative "beats"
 * - Each shot uses scene's approved image as start frame
 *
 * Workflow:
 * 1. AI divides scene into narrative shots (8s max each)
 * 2. Each shot generates video independently
 * 3. Videos are assembled in timeline order for final export
 */

import { db } from '@/lib/drizzle/db';
import {
  scene_shots,
  scenes,
  type SceneShot,
  type RawSceneData,
  type Veo3PromptData,
} from '@/lib/drizzle/schema';
import { eq, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { env } from '@/lib/env';
import {
  generateSceneVideo,
  generateImage,
  invokeWorkflow,
} from '@/lib/n8n/mcp-client';
import type { ApiKeys } from '@/lib/n8n/types';

// ============================================================================
// Types
// ============================================================================

export type ShotActionResult =
  | { success: true; shotId?: string; shotIds?: string[]; data?: unknown }
  | { success: false; error: string };

/**
 * AI-generated shot structure from n8n workflow
 */
interface AIGeneratedShot {
  shot_number: number;
  duration_seconds: number;
  action: string;
  dialogue: string | null;
  shot_type: string;
  composition: string;
}

// ============================================================================
// AI-Based Shot Creation (MVP)
// ============================================================================

/**
 * Create shots from AI analysis of scene content
 *
 * MVP SIMPLIFICATION:
 * - Calls n8n workflow 'scene-to-shots' to intelligently divide scene
 * - Each shot is max 8 seconds
 * - Shots are INDEPENDENT (no extend API)
 *
 * @param sceneId - The scene to create shots for
 * @param apiKeys - Optional user-provided API keys from localStorage
 */
export async function createShotsWithAI(
  sceneId: string,
  apiKeys?: ApiKeys
): Promise<ShotActionResult> {
  try {
    console.log('🤖 Creating shots with AI for scene:', sceneId);

    const [scene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, sceneId))
      .limit(1);

    if (!scene) {
      return { success: false, error: 'Scene not found' };
    }

    // Check if shots already exist
    const existingShots = await db
      .select()
      .from(scene_shots)
      .where(eq(scene_shots.scene_id, sceneId));

    if (existingShots.length > 0) {
      console.log(`⏭️ Shots already exist for scene ${scene.scene_number}`);
      return { success: true, shotIds: existingShots.map(s => s.id) };
    }

    // Prepare data for AI analysis
    const rawData = scene.raw_scene_data;
    const estimatedDuration = rawData?.estimated_duration_seconds || 10;

    // Call n8n workflow to intelligently divide scene into shots
    const result = await invokeWorkflow<{ shots: AIGeneratedShot[] }>(
      'scene-to-shots',
      {
        sceneId: scene.id,
        sceneText: scene.action_text || '',
        dialogue: rawData?.dialogue_snippet || '',
        characters: scene.characters || [],
        estimatedDuration,
      },
      { apiKeys }
    );

    if (!result.success || !result.data?.shots) {
      console.log('⚠️ AI shot creation failed, creating single default shot');
      // Fallback: Create a single shot from scene data
      return createDefaultShotFromScene(sceneId);
    }

    const aiShots = result.data.shots;
    console.log(`📸 AI generated ${aiShots.length} shots for scene ${scene.scene_number}`);

    // Create shot records (MVP: no extend, all independent)
    const createdShots: SceneShot[] = [];

    for (const shotData of aiShots) {
      const [insertedShot] = await db
        .insert(scene_shots)
        .values({
          scene_id: sceneId,
          shot_number: shotData.shot_number,
          shot_duration_seconds: Math.min(shotData.duration_seconds, 8), // Max 8s for MVP
          is_first_shot: shotData.shot_number === 1,
          shot_type: shotData.shot_type,
          composition_instruction: shotData.composition,
          action_prompt: shotData.action,
          dialogue_segment: shotData.dialogue,
          uses_extend: false, // MVP: No extend
          previous_shot_id: null, // MVP: No chaining
        })
        .returning();

      createdShots.push(insertedShot);
    }

    console.log(`✅ Created ${createdShots.length} AI-generated shots for scene ${scene.scene_number}`);
    revalidatePath(`/projects/${scene.project_id}/studio/video`, 'page');

    return { success: true, shotIds: createdShots.map(s => s.id) };
  } catch (error) {
    console.error('❌ Error creating shots with AI:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create shots with AI',
    };
  }
}

/**
 * Create a single default shot when AI analysis fails
 * MVP fallback to ensure scenes always have at least one shot
 */
async function createDefaultShotFromScene(sceneId: string): Promise<ShotActionResult> {
  const [scene] = await db
    .select()
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .limit(1);

  if (!scene) {
    return { success: false, error: 'Scene not found' };
  }

  const rawData = scene.raw_scene_data;
  const duration = Math.min(rawData?.estimated_duration_seconds || 8, 8);

  const [singleShot] = await db
    .insert(scene_shots)
    .values({
      scene_id: sceneId,
      shot_number: 1,
      shot_duration_seconds: duration,
      is_first_shot: true,
      shot_type: rawData?.shot_type || 'Medium Shot',
      composition_instruction: rawData?.composition_instruction || null,
      action_prompt: rawData?.action_description || scene.action_text || '',
      dialogue_segment: rawData?.dialogue_snippet || null,
      uses_extend: false,
      previous_shot_id: null,
    })
    .returning();

  console.log(`✅ Created default shot for scene ${scene.scene_number}`);
  revalidatePath(`/projects/${scene.project_id}/studio/video`, 'page');

  return { success: true, shotIds: [singleShot.id] };
}

/**
 * Create shots for all scenes in a project using AI
 * MVP: All shots are independent (no extend mode)
 */
export async function createAllProjectShotsWithAI(projectId: string): Promise<ShotActionResult> {
  try {
    console.log('🎬 Creating shots with AI for all scenes in project:', projectId);

    const projectScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.project_id, projectId))
      .orderBy(asc(scenes.scene_number));

    const allShotIds: string[] = [];

    for (const scene of projectScenes) {
      const result = await createShotsWithAI(scene.id);
      if (result.success && result.shotIds) {
        allShotIds.push(...result.shotIds);
      }
    }

    console.log(`✅ Created ${allShotIds.length} total shots for project`);

    return { success: true, shotIds: allShotIds };
  } catch (error) {
    console.error('❌ Error creating shots with AI for project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create shots',
    };
  }
}

// ============================================================================
// Shot Creation (Legacy)
// ============================================================================

/**
 * Compose video_prompt_veo3 into a single prompt string
 * Veo 3.1 7-component format: subject, action, scene, style, dialogue, sounds, technical
 *
 * NOTE: Content policy compliance is handled by n8n workflow (Claude Haiku rewrite)
 * See workflow "video_generation_simple" for detection and rewriting logic.
 */
function composeVeo3Prompt(vp: {
  subject?: string | null;
  action?: string | null;
  scene?: string | null;
  style?: string | null;
  dialogue?: string | null;
  sounds?: string | null;
  technical?: string | null;
}): string {
  const parts: string[] = [];
  if (vp.subject) parts.push(vp.subject);
  if (vp.action) parts.push(vp.action);
  if (vp.scene) parts.push(vp.scene);
  if (vp.style) parts.push(vp.style);
  if (vp.dialogue) parts.push(vp.dialogue);
  if (vp.sounds) parts.push(vp.sounds);
  if (vp.technical) parts.push(vp.technical);

  return parts.join('. ');
}

/**
 * Create shots from scene data
 *
 * Called after scene parsing when shots array is available.
 * Creates scene_shots records for each shot in the scene.
 *
 * @param sceneId - The scene to create shots for
 * @returns Result with created shot IDs
 */
export async function createShotsFromScene(
  sceneId: string
): Promise<ShotActionResult> {
  try {
    console.log('🎬 Creating shots for scene:', sceneId);

    // Get the scene
    const [scene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, sceneId))
      .limit(1);

    if (!scene) {
      return { success: false, error: 'Scene not found' };
    }

    // Get shots from full_data OR raw_scene_data (scenes use full_data in MVP)
    const rawData = scene.full_data || scene.raw_scene_data;
    const shotsData = rawData?.shots;

    console.log('📊 Scene data check:', {
      sceneId,
      has_full_data: !!scene.full_data,
      has_raw_scene_data: !!scene.raw_scene_data,
      shots_count: shotsData?.length || 0,
    });

    if (!shotsData || shotsData.length === 0) {
      // No shots array - create a single default shot from scene data
      console.log('📹 No shots array, creating single shot from scene data');

      // Get video_prompt_veo3 from scene level if available
      const sceneVeo3Data = rawData?.video_prompt_veo3 || null;
      // Compose action_prompt as fallback
      const composedPrompt = sceneVeo3Data
        ? composeVeo3Prompt(sceneVeo3Data)
        : rawData?.action_description || rawData?.action_summary || scene.action_text;

      const singleShot = await db
        .insert(scene_shots)
        .values({
          scene_id: sceneId,
          shot_number: 1,
          shot_duration_seconds: rawData?.estimated_duration_seconds || 8,
          is_first_shot: true,
          shot_type: rawData?.shot_type || 'Medium Shot',
          composition_instruction: rawData?.composition_instruction || null,
          // Store both structured data AND composed fallback
          video_prompt_veo3: sceneVeo3Data,
          action_prompt: composedPrompt,
          end_frame_instruction: null,
          dialogue_segment: rawData?.dialogue_snippet || null,
          uses_extend: false,
        })
        .returning();

      return { success: true, shotIds: [singleShot[0].id] };
    }

    // Create shots from array
    console.log(`📹 Creating ${shotsData.length} shots from scene data`);

    const createdShots: SceneShot[] = [];
    let previousShotId: string | null = null;

    for (const shotData of shotsData) {
      const isFirstShot = shotData.is_first_shot;
      const usesExtend = !isFirstShot && shotsData.length > 1;

      // Get video_prompt_veo3 structured data from shot (from n8n Scenes workflow)
      const shotVeo3Data = shotData.video_prompt_veo3 || null;
      // Compose action_prompt as fallback
      const composedPrompt = shotVeo3Data
        ? composeVeo3Prompt(shotVeo3Data)
        : shotData.action_prompt;

      console.log(`📹 Shot ${shotData.shot_number}:`, {
        has_veo3_data: !!shotVeo3Data,
        veo3_keys: shotVeo3Data ? Object.keys(shotVeo3Data) : [],
        action_prompt_length: composedPrompt?.length || 0,
      });

      const insertedShots: SceneShot[] = await db
        .insert(scene_shots)
        .values({
          scene_id: sceneId,
          shot_number: shotData.shot_number,
          shot_duration_seconds: shotData.shot_duration_seconds,
          is_first_shot: isFirstShot,
          shot_type: shotData.shot_type,
          composition_instruction: shotData.composition_instruction,
          // Store both structured data AND composed fallback
          video_prompt_veo3: shotVeo3Data,
          action_prompt: composedPrompt,
          end_frame_instruction: shotData.end_frame_instruction,
          dialogue_segment: shotData.dialogue_segment,
          uses_extend: usesExtend,
          previous_shot_id: usesExtend ? previousShotId : null,
          // Set initial status for first shot's start frame
          start_frame_status: isFirstShot && shotData.composition_instruction ? 'generating' : null,
        })
        .returning();

      const insertedShot = insertedShots[0];
      createdShots.push(insertedShot);
      previousShotId = insertedShot.id;
    }

    console.log(`✅ Created ${createdShots.length} shots for scene ${scene.scene_number}`);

    revalidatePath(`/projects/${scene.project_id}/studio/video`, 'page');

    return { success: true, shotIds: createdShots.map((s) => s.id) };
  } catch (error) {
    console.error('❌ Error creating shots:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create shots',
    };
  }
}

/**
 * Create shots for all scenes in a project
 *
 * Called after all scenes are validated and ready for video generation.
 */
export async function createShotsForProject(
  projectId: string
): Promise<ShotActionResult> {
  try {
    console.log('🎬 Creating shots for project:', projectId);

    const projectScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.project_id, projectId))
      .orderBy(asc(scenes.scene_number));

    const allShotIds: string[] = [];

    for (const scene of projectScenes) {
      // Check if shots already exist for this scene
      const existingShots = await db
        .select()
        .from(scene_shots)
        .where(eq(scene_shots.scene_id, scene.id))
        .limit(1);

      if (existingShots.length > 0) {
        console.log(`⏭️ Shots already exist for scene ${scene.scene_number}`);
        continue;
      }

      const result = await createShotsFromScene(scene.id);
      if (result.success && result.shotIds) {
        allShotIds.push(...result.shotIds);
      }
    }

    console.log(`✅ Created ${allShotIds.length} total shots for project`);

    return { success: true, shotIds: allShotIds };
  } catch (error) {
    console.error('❌ Error creating shots for project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create shots for project',
    };
  }
}

// ============================================================================
// Shot Frame Generation
// ============================================================================

/**
 * Trigger start frame image generation for a shot
 *
 * Only for first shots that have a composition_instruction.
 * This generates the image that will be used as the first frame in Veo 3.1.
 */
export async function triggerStartFrameGeneration(
  shotId: string
): Promise<ShotActionResult> {
  try {
    console.log('🖼️ Triggering start frame generation for shot:', shotId);

    const [shot] = await db
      .select()
      .from(scene_shots)
      .where(eq(scene_shots.id, shotId))
      .limit(1);

    if (!shot) {
      return { success: false, error: 'Shot not found' };
    }

    if (!shot.composition_instruction) {
      return { success: false, error: 'Shot has no composition_instruction for start frame' };
    }

    // Update status to generating
    await db
      .update(scene_shots)
      .set({ start_frame_status: 'generating' })
      .where(eq(scene_shots.id, shotId));

    // Invoke n8n image generation workflow
    const result = await generateImage({
      prompt: shot.composition_instruction,
      model: 'seedream4.5',
      aspect_ratio: '16:9',
      next_js_callback_url: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/n8n/shot-frame-generated?shot_id=${shotId}&frame_type=start`,
    });

    if (!result.success) {
      await db
        .update(scene_shots)
        .set({
          start_frame_status: 'failed',
          error_message: result.error || 'Failed to start frame generation',
        })
        .where(eq(scene_shots.id, shotId));

      return { success: false, error: result.error || 'Failed to start frame generation' };
    }

    // Store job ID for tracking
    await db
      .update(scene_shots)
      .set({ start_frame_job_id: result.data?.taskId })
      .where(eq(scene_shots.id, shotId));

    console.log('✅ Start frame generation triggered for shot:', shotId);

    return { success: true, shotId };
  } catch (error) {
    console.error('❌ Error triggering start frame generation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger start frame generation',
    };
  }
}

/**
 * Trigger end frame image generation for a shot
 *
 * Only for shots that have an end_frame_instruction.
 * This generates the image that will be used as the last frame in Veo 3.1.
 */
export async function triggerEndFrameGeneration(
  shotId: string
): Promise<ShotActionResult> {
  try {
    console.log('🖼️ Triggering end frame generation for shot:', shotId);

    const [shot] = await db
      .select()
      .from(scene_shots)
      .where(eq(scene_shots.id, shotId))
      .limit(1);

    if (!shot) {
      return { success: false, error: 'Shot not found' };
    }

    if (!shot.end_frame_instruction) {
      return { success: false, error: 'Shot has no end_frame_instruction' };
    }

    // Update status to generating
    await db
      .update(scene_shots)
      .set({ end_frame_status: 'generating' })
      .where(eq(scene_shots.id, shotId));

    // Invoke n8n image generation workflow
    const result = await generateImage({
      prompt: shot.end_frame_instruction,
      model: 'seedream4.5',
      aspect_ratio: '16:9',
      next_js_callback_url: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/n8n/shot-frame-generated?shot_id=${shotId}&frame_type=end`,
    });

    if (!result.success) {
      await db
        .update(scene_shots)
        .set({
          end_frame_status: 'failed',
          error_message: result.error || 'Failed to start end frame generation',
        })
        .where(eq(scene_shots.id, shotId));

      return { success: false, error: result.error || 'Failed to start end frame generation' };
    }

    // Store job ID for tracking
    await db
      .update(scene_shots)
      .set({ end_frame_job_id: result.data?.taskId })
      .where(eq(scene_shots.id, shotId));

    console.log('✅ End frame generation triggered for shot:', shotId);

    return { success: true, shotId };
  } catch (error) {
    console.error('❌ Error triggering end frame generation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger end frame generation',
    };
  }
}

// ============================================================================
// Video Prompt Composition
// ============================================================================

/**
 * Compose a complete video prompt for Veo 3.1
 *
 * Veo 3.1 generates video WITH audio from a single prompt.
 * All audio (dialogue, SFX, ambient, music) must be described in the prompt.
 *
 * Prompt structure:
 * 1. Camera type and movement
 * 2. Main action description
 * 3. Visual atmosphere (lighting, colors)
 * 4. Dialogue with voice description
 * 5. Sound effects and ambient audio
 * 6. Music mood
 *
 * @param shot - The shot data
 * @param scene - The parent scene with full data
 * @returns A complete video generation prompt for Veo 3.1
 */
function composeShotVideoPrompt(
  shot: SceneShot,
  scene: {
    raw_scene_data: RawSceneData | null;
    slugline: string;
  }
): string {
  // PREFER structured VEO 3.1 prompt if available
  // This gives full control over the 7 prompt components
  if (shot.video_prompt_veo3 && Object.values(shot.video_prompt_veo3).some(v => v)) {
    console.log('📹 Using structured VEO3 prompt for shot:', shot.id);
    return composeVeo3Prompt(shot.video_prompt_veo3);
  }

  // Fallback to action_prompt if it exists (composed from video_prompt_veo3 or legacy)
  // NOTE: Content policy compliance is handled by n8n workflow
  if (shot.action_prompt) {
    console.log('📹 Using action_prompt fallback for shot:', shot.id);
    return shot.action_prompt;
  }

  // Legacy: Build prompt from scene data (for shots created before structured prompts)
  console.log('📹 Using legacy scene data for shot:', shot.id);
  const parts: string[] = [];
  const rawData = scene.raw_scene_data;
  const audioReqs = rawData?.audio_requirements;

  // 1. Camera type (shot framing)
  if (shot.shot_type) {
    parts.push(`${shot.shot_type}.`);
  }

  // 2. Camera movement / composition instruction
  if (shot.composition_instruction) {
    parts.push(`Camera: ${shot.composition_instruction}.`);
  } else if (rawData?.composition_instruction) {
    parts.push(`Camera: ${rawData.composition_instruction}.`);
  }

  // 3. Visual atmosphere
  if (rawData?.visual_atmosphere) {
    parts.push(rawData.visual_atmosphere);
  } else if (rawData?.visual_mood?.atmosphere) {
    parts.push(rawData.visual_mood.atmosphere);
  }

  // 4. Lighting
  if (rawData?.visual_mood?.lighting) {
    parts.push(`${rawData.visual_mood.lighting} lighting.`);
  }

  // 5. Color palette
  if (rawData?.visual_mood?.color_palette) {
    parts.push(`${rawData.visual_mood.color_palette} color palette.`);
  }

  // 6. Dialogue with voice type (Veo 3.1 generates spoken audio)
  const dialogue = shot.dialogue_segment ||
    rawData?.dialogue_snippet ||
    audioReqs?.dialogue_transcript;

  if (dialogue) {
    const voiceDesc = audioReqs?.voice_type
      ? ` in a ${audioReqs.voice_type} voice`
      : '';
    const toneDesc = audioReqs?.dialogue_tone
      ? `, ${audioReqs.dialogue_tone}`
      : '';
    parts.push(`Character speaks${voiceDesc}${toneDesc}: "${dialogue}"`);
  }

  // 7. Sound effects
  if (audioReqs?.sfx) {
    const sfxArray = Array.isArray(audioReqs.sfx) ? audioReqs.sfx : [audioReqs.sfx];
    if (sfxArray.length > 0) {
      parts.push(`Sound effects: ${sfxArray.join(', ')}.`);
    }
  }

  // 8. Ambient sounds
  if (audioReqs?.ambient) {
    const ambientArray = Array.isArray(audioReqs.ambient) ? audioReqs.ambient : [audioReqs.ambient];
    if (ambientArray.length > 0) {
      parts.push(`Ambient audio: ${ambientArray.join(', ')}.`);
    }
  }

  // 9. Music mood
  if (audioReqs?.music_mood) {
    parts.push(`Music: ${audioReqs.music_mood}.`);
  } else if (audioReqs?.music) {
    parts.push(`Music: ${audioReqs.music}.`);
  }

  // NOTE: Content policy compliance is handled by n8n workflow
  return parts.join(' ');
}

// ============================================================================
// Scene Video Generation (all shots at once)
// ============================================================================

/**
 * Shot data prepared for n8n workflow
 *
 * Veo 3.1 generates video + audio from a single prompt.
 * The `video_prompt` includes everything: action, camera, dialogue, SFX, music.
 */
interface ShotPayload {
  shot_id: string;
  shot_number: number;
  shot_duration_seconds: number;
  is_first_shot: boolean;
  uses_extend: boolean;

  // Complete Veo 3.1 prompt (includes action, camera, dialogue, SFX, music)
  prompt: string;

  // Images for Veo 3.1 first/last frame generation
  start_frame_image_url: string | null;
  end_frame_image_url: string | null;
}

/**
 * Trigger video generation for ALL shots in a scene
 *
 * Sends all shots to n8n in a single payload.
 * n8n handles the sequential processing:
 * - Shot 1: Generate API with image(s) → taskId_1
 * - Shot 2: Extend API with taskId_1 → taskId_2
 * - Shot 3: Extend API with taskId_2 → taskId_3
 * - etc.
 *
 * n8n polls Kie.ai internally and returns all video URLs when complete.
 */
export async function triggerSceneVideoGeneration(
  sceneId: string
): Promise<ShotActionResult> {
  try {
    console.log('🎬 Triggering video generation for scene:', sceneId);

    // Get the scene
    const [scene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, sceneId))
      .limit(1);

    if (!scene) {
      return { success: false, error: 'Scene not found' };
    }

    // Get all shots for this scene
    const shots = await db
      .select()
      .from(scene_shots)
      .where(eq(scene_shots.scene_id, sceneId))
      .orderBy(asc(scene_shots.shot_number));

    if (shots.length === 0) {
      return { success: false, error: 'No shots found for this scene' };
    }

    // Check that first shot has start frame ready
    const firstShot = shots[0];
    if (!firstShot.start_frame_image_url) {
      return { success: false, error: 'First shot start frame image not ready' };
    }

    // Prepare shots payload for n8n with pre-composed prompts
    // Veo 3.1 generates video + audio from a single prompt
    const shotsPayload: ShotPayload[] = shots.map((shot) => ({
      shot_id: shot.id,
      shot_number: shot.shot_number,
      shot_duration_seconds: shot.shot_duration_seconds,
      is_first_shot: shot.is_first_shot,
      uses_extend: shot.uses_extend,
      prompt: composeShotVideoPrompt(shot, scene),
      start_frame_image_url: shot.start_frame_image_url,
      end_frame_image_url: shot.end_frame_image_url,
    }));

    console.log('📝 Shot payloads prepared:', shotsPayload.map((s) => ({
      shot_number: s.shot_number,
      prompt_preview: s.prompt.substring(0, 150) + (s.prompt.length > 150 ? '...' : ''),
      has_start_frame: !!s.start_frame_image_url,
      has_end_frame: !!s.end_frame_image_url,
    })));

    // Update all shots status to generating
    for (const shot of shots) {
      await db
        .update(scene_shots)
        .set({ video_status: 'generating' })
        .where(eq(scene_shots.id, shot.id));
    }

    // Invoke n8n workflow with ALL shots
    // model (veo3_fast) and aspectRatio (16:9) are set by default in n8n
    const result = await generateSceneVideo({
      scene_id: sceneId,
      scene_number: scene.scene_number,
      slugline: scene.slugline,
      shots: shotsPayload,
    });

    if (!result.success) {
      // Mark all shots as failed
      for (const shot of shots) {
        await db
          .update(scene_shots)
          .set({
            video_status: 'failed',
            error_message: result.error || 'Failed to start video generation',
          })
          .where(eq(scene_shots.id, shot.id));
      }

      return { success: false, error: result.error || 'Failed to start video generation' };
    }

    console.log('✅ Scene video generation triggered:', sceneId, {
      shotCount: shots.length,
      hasExtend: shots.some((s) => s.uses_extend),
    });

    revalidatePath(`/projects/${scene.project_id}/studio/video`, 'page');

    return { success: true, shotIds: shots.map((s) => s.id) };
  } catch (error) {
    console.error('❌ Error triggering scene video generation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger video generation',
    };
  }
}

/**
 * Trigger video generation for all scenes in a project
 */
export async function triggerProjectVideoGeneration(
  projectId: string
): Promise<ShotActionResult> {
  try {
    console.log('🎬 Triggering video generation for project:', projectId);

    const projectScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.project_id, projectId))
      .orderBy(asc(scenes.scene_number));

    const allShotIds: string[] = [];
    const errors: string[] = [];

    for (const scene of projectScenes) {
      const result = await triggerSceneVideoGeneration(scene.id);
      if (result.success && result.shotIds) {
        allShotIds.push(...result.shotIds);
      } else if (!result.success) {
        errors.push(`Scene ${scene.scene_number}: ${result.error}`);
      }
    }

    if (errors.length > 0 && allShotIds.length === 0) {
      return { success: false, error: errors.join('; ') };
    }

    console.log(`✅ Project video generation triggered: ${allShotIds.length} shots`);

    return { success: true, shotIds: allShotIds };
  } catch (error) {
    console.error('❌ Error triggering project video generation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger project video generation',
    };
  }
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all shots for a scene
 */
export async function getShotsForScene(sceneId: string) {
  return db
    .select()
    .from(scene_shots)
    .where(eq(scene_shots.scene_id, sceneId))
    .orderBy(asc(scene_shots.shot_number));
}

/**
 * Get shot generation status for a project
 */
export async function getProjectShotStatus(projectId: string): Promise<{
  totalShots: number;
  framesReady: number;
  videosGenerating: number;
  videosReady: number;
  videosFailed: number;
}> {
  const projectScenes = await db
    .select()
    .from(scenes)
    .where(eq(scenes.project_id, projectId));

  let totalShots = 0;
  let framesReady = 0;
  let videosGenerating = 0;
  let videosReady = 0;
  let videosFailed = 0;

  for (const scene of projectScenes) {
    const shots = await db
      .select()
      .from(scene_shots)
      .where(eq(scene_shots.scene_id, scene.id));

    totalShots += shots.length;

    for (const shot of shots) {
      // Check if frames are ready
      const startFrameReady = !shot.composition_instruction || shot.start_frame_status === 'ready';
      const endFrameReady = !shot.end_frame_instruction || shot.end_frame_status === 'ready';

      if (startFrameReady && endFrameReady) {
        framesReady++;
      }

      // Check video status
      if (shot.video_status === 'generating') {
        videosGenerating++;
      } else if (shot.video_status === 'ready' || shot.video_status === 'approved') {
        videosReady++;
      } else if (shot.video_status === 'failed') {
        videosFailed++;
      }
    }
  }

  return {
    totalShots,
    framesReady,
    videosGenerating,
    videosReady,
    videosFailed,
  };
}

// ============================================================================
// MVP Simplified Video Generation
// ============================================================================

/**
 * Generate video for a single shot (MVP: No extend mode)
 *
 * MVP SIMPLIFICATION:
 * - Uses scene's approved image as start frame (no separate frame generation)
 * - Independent 8s video per shot
 * - No chaining with previous shots
 *
 * @param shotId - ID of the shot to generate video for
 * @param apiKeys - Optional user-provided API keys from localStorage
 */
export async function generateShotVideoMVP(
  shotId: string,
  apiKeys?: ApiKeys
): Promise<ShotActionResult> {
  try {
    console.log('🎬 MVP: Generating video for shot:', shotId);

    const [shot] = await db
      .select()
      .from(scene_shots)
      .where(eq(scene_shots.id, shotId))
      .limit(1);

    if (!shot) {
      return { success: false, error: 'Shot not found' };
    }

    // Get scene with approved image
    const [scene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, shot.scene_id))
      .limit(1);

    if (!scene) {
      return { success: false, error: 'Scene not found' };
    }

    // MVP: Use scene's approved image as start frame
    const imageUrl = scene.approved_image_url;
    if (!imageUrl) {
      return { success: false, error: 'No approved image for scene. Generate and approve a scene image first.' };
    }

    // Update status to generating
    await db
      .update(scene_shots)
      .set({
        video_status: 'generating',
        start_frame_image_url: imageUrl, // Store reference to scene image
        updated_at: new Date(),
      })
      .where(eq(scene_shots.id, shotId));

    // Compose video prompt
    const videoPrompt = composeShotVideoPrompt(shot, scene);

    // Call VEO3 via n8n - simplified (no extend)
    // Uses workflow "video_generation_simple" with N8N_VIDEO_GENERATION_SIMPLE_WEBHOOK
    // IMPORTANT: timeout: 0 means no timeout - video generation takes several minutes
    const result = await invokeWorkflow<{ videoUrl?: string; taskId?: string }>(
      'video_generation_simple',
      {
        shotId: shot.id,
        imageUrl,
        prompt: videoPrompt,
        duration: shot.shot_duration_seconds,
        aspectRatio: '16:9',
      },
      { timeout: 0, apiKeys } // No timeout - video generation can take 2-5 minutes
    );

    if (!result.success) {
      await db
        .update(scene_shots)
        .set({
          video_status: 'failed',
          error_message: result.error || 'Video generation failed',
          updated_at: new Date(),
        })
        .where(eq(scene_shots.id, shotId));

      return { success: false, error: result.error || 'Video generation failed' };
    }

    // Store job ID for tracking (async workflow)
    if (result.data?.taskId) {
      await db
        .update(scene_shots)
        .set({
          video_job_id: result.data.taskId,
          veo_task_id: result.data.taskId,
          updated_at: new Date(),
        })
        .where(eq(scene_shots.id, shotId));
    }

    // If synchronous result with video URL
    if (result.data?.videoUrl) {
      await db
        .update(scene_shots)
        .set({
          video_url: result.data.videoUrl,
          video_status: 'ready',
          updated_at: new Date(),
        })
        .where(eq(scene_shots.id, shotId));
    }

    console.log('✅ MVP: Video generation triggered for shot:', shotId);
    revalidatePath(`/projects/${scene.project_id}/studio/video`, 'page');

    return { success: true, shotId };
  } catch (error) {
    console.error('❌ Error generating shot video (MVP):', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate video',
    };
  }
}

/**
 * Generate videos for all shots in a project (MVP: Batched, no extend)
 *
 * MVP: Process shots in batches of 3 to avoid overloading n8n
 *
 * @param projectId - Project to generate videos for
 * @param apiKeys - Optional user-provided API keys from localStorage
 */
export async function generateAllShotVideosMVP(
  projectId: string,
  apiKeys?: ApiKeys
): Promise<ShotActionResult> {
  try {
    console.log('🎬 MVP: Generating all shot videos for project:', projectId);

    const MAX_CONCURRENT = 3;

    // Get all shots for the project
    const projectScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.project_id, projectId))
      .orderBy(asc(scenes.scene_number));

    const allShots: SceneShot[] = [];

    for (const scene of projectScenes) {
      // Only process scenes with approved images
      if (!scene.approved_image_url) {
        console.log(`⏭️ Skipping scene ${scene.scene_number} - no approved image`);
        continue;
      }

      const shots = await db
        .select()
        .from(scene_shots)
        .where(eq(scene_shots.scene_id, scene.id))
        .orderBy(asc(scene_shots.shot_number));

      allShots.push(...shots);
    }

    // Filter to shots that haven't been processed yet (null or generating)
    const pendingShots = allShots.filter(
      (s) => s.video_status === null || s.video_status === 'generating'
    );

    console.log(`📊 Found ${pendingShots.length} pending shots to process`);

    // Process in batches of MAX_CONCURRENT
    const allShotIds: string[] = [];

    for (let i = 0; i < pendingShots.length; i += MAX_CONCURRENT) {
      const batch = pendingShots.slice(i, i + MAX_CONCURRENT);
      console.log(`🔄 Processing batch ${Math.floor(i / MAX_CONCURRENT) + 1}: ${batch.length} shots`);

      const results = await Promise.all(
        batch.map((shot) => generateShotVideoMVP(shot.id, apiKeys))
      );

      for (const result of results) {
        if (result.success && result.shotId) {
          allShotIds.push(result.shotId);
        }
      }
    }

    console.log(`✅ MVP: Video generation triggered for ${allShotIds.length} shots`);

    return {
      success: true,
      shotIds: allShotIds,
      data: { queued: allShotIds.length, total: pendingShots.length },
    };
  } catch (error) {
    console.error('❌ Error generating all shot videos (MVP):', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate videos',
    };
  }
}

// ============================================================================
// Shot Reset Actions (for fixing existing data)
// ============================================================================

/**
 * Reset shots for a scene - delete existing and recreate from full_data
 *
 * Use this to fix shots that were created with wrong/missing data.
 */
export async function resetShotsForScene(sceneId: string): Promise<ShotActionResult> {
  try {
    console.log('🔄 Resetting shots for scene:', sceneId);

    // Delete existing shots
    const deletedShots = await db
      .delete(scene_shots)
      .where(eq(scene_shots.scene_id, sceneId))
      .returning();

    console.log(`🗑️ Deleted ${deletedShots.length} existing shots`);

    // Recreate from scene data
    const result = await createShotsFromScene(sceneId);

    if (result.success) {
      console.log(`✅ Recreated ${result.shotIds?.length || 0} shots for scene`);
    }

    return result;
  } catch (error) {
    console.error('❌ Error resetting shots for scene:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset shots',
    };
  }
}

/**
 * Reset shots for all scenes in a project
 *
 * Use this to fix all shots that were created with wrong/missing data.
 */
export async function resetShotsForProject(projectId: string): Promise<ShotActionResult> {
  try {
    console.log('🔄 Resetting all shots for project:', projectId);

    const projectScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.project_id, projectId))
      .orderBy(asc(scenes.scene_number));

    const allShotIds: string[] = [];
    let totalDeleted = 0;

    for (const scene of projectScenes) {
      // Delete existing shots
      const deletedShots = await db
        .delete(scene_shots)
        .where(eq(scene_shots.scene_id, scene.id))
        .returning();

      totalDeleted += deletedShots.length;

      // Recreate from scene data
      const result = await createShotsFromScene(scene.id);
      if (result.success && result.shotIds) {
        allShotIds.push(...result.shotIds);
      }
    }

    console.log(`✅ Reset complete: deleted ${totalDeleted} old shots, created ${allShotIds.length} new shots`);

    revalidatePath(`/projects/${projectId}/studio/video`, 'page');

    return { success: true, shotIds: allShotIds };
  } catch (error) {
    console.error('❌ Error resetting shots for project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset shots',
    };
  }
}

// ============================================================================
// Shot Update Actions
// ============================================================================

/**
 * Update a shot's action prompt (video prompt)
 *
 * This allows users to edit the video generation prompt before generating.
 */
export async function updateShotPrompt(
  shotId: string,
  newPrompt: string
): Promise<ShotActionResult> {
  try {
    console.log('📝 Updating shot prompt:', shotId);

    const [shot] = await db
      .select()
      .from(scene_shots)
      .where(eq(scene_shots.id, shotId))
      .limit(1);

    if (!shot) {
      return { success: false, error: 'Shot not found' };
    }

    await db
      .update(scene_shots)
      .set({
        action_prompt: newPrompt,
        updated_at: new Date(),
      })
      .where(eq(scene_shots.id, shotId));

    // Get scene to revalidate the correct path
    const [scene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, shot.scene_id))
      .limit(1);

    if (scene) {
      revalidatePath(`/projects/${scene.project_id}/studio/video`, 'page');
    }

    console.log('✅ Shot prompt updated:', shotId);
    return { success: true, shotId };
  } catch (error) {
    console.error('❌ Error updating shot prompt:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update prompt',
    };
  }
}

/**
 * Update a shot's structured VEO 3.1 prompt data
 *
 * Updates both the structured video_prompt_veo3 JSONB field and
 * composes a new action_prompt from the structured data for fallback.
 *
 * @param shotId - Shot ID to update
 * @param promptData - The 7-component VEO 3.1 prompt structure
 */
export async function updateShotVeo3Prompt(
  shotId: string,
  promptData: Veo3PromptData
): Promise<ShotActionResult> {
  try {
    console.log('📝 Updating shot VEO3 prompt:', shotId);

    const [shot] = await db
      .select()
      .from(scene_shots)
      .where(eq(scene_shots.id, shotId))
      .limit(1);

    if (!shot) {
      return { success: false, error: 'Shot not found' };
    }

    // Compose a single-string prompt from structured data (for fallback)
    const composedPrompt = composeVeo3Prompt(promptData);

    await db
      .update(scene_shots)
      .set({
        video_prompt_veo3: promptData,
        action_prompt: composedPrompt,
        updated_at: new Date(),
      })
      .where(eq(scene_shots.id, shotId));

    // Get scene to revalidate the correct path
    const [scene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, shot.scene_id))
      .limit(1);

    if (scene) {
      revalidatePath(`/projects/${scene.project_id}/studio/video`, 'page');
    }

    console.log('✅ Shot VEO3 prompt updated:', shotId);
    return { success: true, shotId };
  } catch (error) {
    console.error('❌ Error updating shot VEO3 prompt:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update VEO3 prompt',
    };
  }
}

// ============================================================================
// Shot Cancel Actions
// ============================================================================

/**
 * Cancel video generation for a single shot
 *
 * Resets video_status from 'generating' to null so user can retry.
 */
export async function cancelShotVideoGeneration(
  shotId: string
): Promise<ShotActionResult> {
  try {
    console.log('🛑 Cancelling video generation for shot:', shotId);

    const [shot] = await db
      .select()
      .from(scene_shots)
      .where(eq(scene_shots.id, shotId))
      .limit(1);

    if (!shot) {
      return { success: false, error: 'Shot not found' };
    }

    if (shot.video_status !== 'generating') {
      return { success: false, error: 'Shot is not currently generating' };
    }

    await db
      .update(scene_shots)
      .set({
        video_status: null,
        video_job_id: null,
        error_message: 'Cancelled by user',
        updated_at: new Date(),
      })
      .where(eq(scene_shots.id, shotId));

    // Get scene to revalidate the correct path
    const [scene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, shot.scene_id))
      .limit(1);

    if (scene) {
      revalidatePath(`/projects/${scene.project_id}/studio/video`, 'page');
    }

    console.log('✅ Shot video generation cancelled:', shotId);
    return { success: true, shotId };
  } catch (error) {
    console.error('❌ Error cancelling shot video generation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel generation',
    };
  }
}

/**
 * Manually update shot video result
 *
 * Used to fix shots that failed to update via webhook but actually succeeded.
 * Sets video URL, status, and task ID directly.
 */
export async function updateShotVideoResult(
  shotId: string,
  videoUrl: string,
  taskId?: string
): Promise<ShotActionResult> {
  try {
    console.log('🔧 Manually updating shot video result:', shotId);

    const [shot] = await db
      .select()
      .from(scene_shots)
      .where(eq(scene_shots.id, shotId))
      .limit(1);

    if (!shot) {
      return { success: false, error: 'Shot not found' };
    }

    await db
      .update(scene_shots)
      .set({
        video_url: videoUrl,
        video_status: 'ready',
        veo_task_id: taskId || shot.veo_task_id,
        error_message: null,
        updated_at: new Date(),
      })
      .where(eq(scene_shots.id, shotId));

    // Get scene to revalidate the correct path
    const [scene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, shot.scene_id))
      .limit(1);

    if (scene) {
      revalidatePath(`/projects/${scene.project_id}/studio/video`, 'page');
    }

    console.log('✅ Shot video result updated:', shotId, { videoUrl });
    return { success: true, shotId };
  } catch (error) {
    console.error('❌ Error updating shot video result:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update shot video result',
    };
  }
}

/**
 * Cancel video generation for all shots in a project
 *
 * Resets all shots with video_status='generating' to null.
 */
export async function cancelAllProjectVideoGeneration(
  projectId: string
): Promise<ShotActionResult> {
  try {
    console.log('🛑 Cancelling all video generation for project:', projectId);

    // Get all scenes for this project
    const projectScenes = await db
      .select({ id: scenes.id })
      .from(scenes)
      .where(eq(scenes.project_id, projectId));

    const sceneIds = projectScenes.map((s) => s.id);

    if (sceneIds.length === 0) {
      return { success: true, shotIds: [] };
    }

    // Update all generating shots for these scenes
    const { inArray } = await import('drizzle-orm');

    const updatedShots = await db
      .update(scene_shots)
      .set({
        video_status: null,
        video_job_id: null,
        error_message: 'Cancelled by user',
        updated_at: new Date(),
      })
      .where(
        eq(scene_shots.video_status, 'generating')
      )
      .returning({ id: scene_shots.id, scene_id: scene_shots.scene_id });

    // Filter to only shots belonging to this project's scenes
    const projectShotIds = updatedShots
      .filter((shot) => sceneIds.includes(shot.scene_id))
      .map((shot) => shot.id);

    revalidatePath(`/projects/${projectId}/studio/video`, 'page');

    console.log(`✅ Cancelled ${projectShotIds.length} generating shots`);
    return { success: true, shotIds: projectShotIds };
  } catch (error) {
    console.error('❌ Error cancelling project video generation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel generation',
    };
  }
}
