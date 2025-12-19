'use server';

import { db } from '@/lib/drizzle/db';
import {
  scenes,
  sceneImageVariants,
  projectCharacters,
  projectLocations,
  projectProps,
  projects,
  type Scene,
  type SceneImageVariant,
  type NewSceneImageVariant,
} from '@/lib/drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { generateImage } from '@/lib/n8n/mcp-client';
import type { ApiKeys } from '@/lib/n8n/types';
import { mapModelToN8NName, getDefaultAspectRatio } from '@/lib/bible/models';
import type { AIModel } from '@/lib/bible/models';
import { env } from '@/lib/env';
import { createClient } from '@supabase/supabase-js';
import { createShotsWithAI } from './shots';

// ============================================================================
// Types
// ============================================================================

export type SceneImageActionResult =
  | { success: true; data?: unknown }
  | { success: false; error: string };

/**
 * Resolved Bible elements for a scene
 * MVP Simplification: Portrait only, no props (described inline in scene prompts)
 */
export interface BibleInjectionData {
  characters: Array<{
    id: string;
    name: string;
    visual_dna: string;
    portrait_url: string | null;
    // MVP: Portrait only - three_quarter and full_body removed
  }>;
  location: {
    id: string;
    name: string;
    visual_description: string;
    image_url: string | null;
  } | null;
  // MVP: Props deprecated - described inline in scene prompts
  props: Array<{
    id: string;
    name: string;
    visual_description: string;
    image_url: string | null;
  }>;
}

/**
 * Scene variants data for UI
 */
export interface SceneVariantsData {
  sceneId: string;
  variants: SceneImageVariant[];
  selectedVariant: SceneImageVariant | null;
  hasApprovedImage: boolean;
}

// ============================================================================
// Supabase Storage Helpers
// ============================================================================

const SCENE_IMAGES_BUCKET = 'scene-images';

/**
 * Initialize Supabase client with service role for bucket management
 */
function getAdminClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * FAST version: Download from temporary CDN URL and upload to Supabase.
 * No delays, no retries - for use in server actions where speed matters.
 * If this fails, the webhook will handle it as a backup.
 */
async function downloadAndUploadToSupabaseFast(
  tempImageUrl: string,
  sceneId: string,
  variantId: string
): Promise<{ url: string; path: string } | null> {
  try {
    console.log(`⬇️ [FAST] Downloading from temp URL: ${tempImageUrl.substring(0, 50)}...`);

    const response = await fetch(tempImageUrl, {
      signal: AbortSignal.timeout(60000) // 60 second timeout - temp URLs can be slow
    });

    if (!response.ok) {
      console.error(`❌ [FAST] Failed to download: ${response.status} - will rely on webhook`);
      return null;
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`📦 [FAST] Downloaded ${imageBuffer.length} bytes`);

    // Validate image size (should be at least 1KB)
    if (imageBuffer.length < 1000) {
      console.error(`❌ [FAST] Image too small (${imageBuffer.length} bytes) - will rely on webhook`);
      return null;
    }

    // Generate storage path
    const timestamp = Date.now();
    const storagePath = `scenes/${sceneId}/${variantId}_${timestamp}.png`;

    console.log(`⬆️ [FAST] Uploading to Supabase: ${storagePath}`);

    const supabase = getAdminClient();
    const { data, error } = await supabase.storage
      .from(SCENE_IMAGES_BUCKET)
      .upload(storagePath, imageBuffer, {
        upsert: true,
        contentType: 'image/png',
      });

    if (error) {
      console.error(`❌ [FAST] Upload failed:`, error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(SCENE_IMAGES_BUCKET)
      .getPublicUrl(data.path);

    console.log(`✅ [FAST] Uploaded successfully: ${publicUrl.substring(0, 50)}...`);

    return { url: publicUrl, path: data.path };
  } catch (error) {
    console.error(`❌ [FAST] Error in downloadAndUploadToSupabaseFast:`, error);
    return null;
  }
}

// ============================================================================
// Bible Element Resolution
// ============================================================================

/**
 * Resolve Bible elements for a scene
 *
 * Matches character, location, and prop names from raw_scene_data
 * to approved Bible assets in the project.
 *
 * MVP: Uses bibleImageVariants table for images (not legacy fields)
 */
export async function resolveBibleElements(
  projectId: string,
  scene: Scene
): Promise<BibleInjectionData> {
  // Import bibleImageVariants for variant-based image lookup
  const { bibleImageVariants } = await import('@/lib/drizzle/schema');

  // Use full_data (where scene data is stored) OR raw_scene_data as fallback
  const rawData = scene.full_data || scene.raw_scene_data;

  console.log('🔍 [DEBUG] Scene data source:', {
    sceneId: scene.id,
    has_full_data: !!scene.full_data,
    has_raw_scene_data: !!scene.raw_scene_data,
    using: scene.full_data ? 'full_data' : 'raw_scene_data',
  });

  if (!rawData) {
    console.log('⚠️ [DEBUG] No scene data found - returning empty Bible elements');
    return { characters: [], location: null, props: [] };
  }

  // Get all project Bible assets
  const [allCharacters, allLocations, allProps] = await Promise.all([
    db
      .select()
      .from(projectCharacters)
      .where(eq(projectCharacters.project_id, projectId)),
    db
      .select()
      .from(projectLocations)
      .where(eq(projectLocations.project_id, projectId)),
    db.select().from(projectProps).where(eq(projectProps.project_id, projectId)),
  ]);

  // Get all variants for this project's characters and locations
  const characterIds = allCharacters.map((c) => c.id);
  const locationIds = allLocations.map((l) => l.id);

  const [characterVariants, locationVariants] = await Promise.all([
    characterIds.length > 0
      ? db
          .select()
          .from(bibleImageVariants)
          .where(
            and(
              eq(bibleImageVariants.asset_type, 'character'),
              inArray(bibleImageVariants.asset_id, characterIds)
            )
          )
      : Promise.resolve([]),
    locationIds.length > 0
      ? db
          .select()
          .from(bibleImageVariants)
          .where(
            and(
              eq(bibleImageVariants.asset_type, 'location'),
              inArray(bibleImageVariants.asset_id, locationIds)
            )
          )
      : Promise.resolve([]),
  ]);

  // DEBUG: Log what we found
  console.log('🔍 [DEBUG] Bible variants found:', {
    characterVariants: characterVariants.length,
    locationVariants: locationVariants.length,
    characterVariantDetails: characterVariants.map(v => ({
      id: v.id,
      asset_id: v.asset_id,
      status: v.status,
      is_selected: v.is_selected,
      has_image: !!v.image_url,
      image_url_preview: v.image_url?.substring(0, 50),
    })),
    locationVariantDetails: locationVariants.map(v => ({
      id: v.id,
      asset_id: v.asset_id,
      status: v.status,
      is_selected: v.is_selected,
      has_image: !!v.image_url,
      image_url_preview: v.image_url?.substring(0, 50),
    })),
  });

  // Helper: Get best image URL for an asset from variants
  // Priority: selected > ready (with image_url)
  function getBestVariantImageUrl(
    assetId: string,
    variants: typeof characterVariants
  ): string | null {
    const assetVariants = variants.filter((v) => v.asset_id === assetId);

    // First try to find selected variant
    const selected = assetVariants.find(
      (v) => (v.is_selected || v.status === 'selected') && v.image_url
    );
    if (selected?.image_url) return selected.image_url;

    // Then try any ready variant with image
    const ready = assetVariants.find(
      (v) => v.status === 'ready' && v.image_url
    );
    if (ready?.image_url) return ready.image_url;

    return null;
  }

  // Match characters by name (case-insensitive)
  // Support both legacy and N8N field names
  // characters_present can be strings OR objects with { name: string }
  const rawCharacters = rawData.characters_present || rawData.bible_character_ids || [];
  const characterNames: string[] = rawCharacters.map((c: string | { name?: string }) =>
    typeof c === 'string' ? c : (c.name || '')
  ).filter(Boolean);

  const matchedCharacters: BibleInjectionData['characters'] = [];

  // DEBUG: Log scene data and character matching
  console.log('🔍 [DEBUG] Scene raw data:', {
    sceneId: scene.id,
    characters_present: rawData.characters_present,
    bible_character_ids: rawData.bible_character_ids,
    extractedCharacterNames: characterNames,
    location: rawData.location,
    bible_location_id: rawData.bible_location_id,
    allCharacterNames: allCharacters.map(c => c.name),
    allLocationNames: allLocations.map(l => l.name),
  });
  for (const charName of characterNames) {
    const normalizedName = charName.toLowerCase().trim();
    const match = allCharacters.find(
      (c) => c.name.toLowerCase().trim() === normalizedName
    );
    if (match) {
      // Get portrait image from variants (MVP: portrait only)
      const portraitUrl = getBestVariantImageUrl(match.id, characterVariants);

      matchedCharacters.push({
        id: match.id,
        name: match.name,
        visual_dna: match.visual_dna || '',
        portrait_url: portraitUrl,
        // MVP: Portrait only - no three_quarter or full_body
      });
    }
  }

  // Match location by name (case-insensitive)
  // Support both legacy and N8N field names
  const locationName = (rawData.location || rawData.bible_location_id || '').toLowerCase().trim();
  let matchedLocation: BibleInjectionData['location'] = null;
  if (locationName) {
    const match = allLocations.find(
      (l) => l.name.toLowerCase().trim() === locationName
    );
    if (match) {
      // Get location image from variants
      const imageUrl = getBestVariantImageUrl(match.id, locationVariants);

      matchedLocation = {
        id: match.id,
        name: match.name,
        visual_description: match.visual_description || '',
        image_url: imageUrl,
      };
    }
  }

  // Match props by name (case-insensitive)
  // Support both legacy and N8N field names
  const propNames = rawData.props_used || rawData.bible_prop_ids || [];
  const matchedProps: BibleInjectionData['props'] = [];
  for (const propName of propNames) {
    const normalizedName = propName.toLowerCase().trim();
    const match = allProps.find(
      (p) => p.name.toLowerCase().trim() === normalizedName
    );
    if (match) {
      matchedProps.push({
        id: match.id,
        name: match.name,
        visual_description: match.visual_description || '',
        image_url: match.approved_image_url, // Props still use legacy field
      });
    }
  }

  return {
    characters: matchedCharacters,
    location: matchedLocation,
    props: matchedProps,
  };
}

// ============================================================================
// Prompt Composition
// ============================================================================

/**
 * Compose a SHORT scene prompt for image-to-image generation
 *
 * Since we're using Bible reference images (characters, locations, props),
 * we DON'T include visual descriptions in the prompt. Instead, we focus on:
 * - Scene action (what's happening)
 * - Shot type & composition
 * - Visual atmosphere & lighting
 * - Wardrobe (scene-specific clothing)
 * - Time of day
 *
 * The AI model will use the reference images for visual consistency.
 */
function composeScenePromptShort(
  scene: Scene,
  projectVisualStyle: string
): string {
  const parts: string[] = [];
  const rawData = scene.raw_scene_data;

  if (!rawData) {
    return scene.full_data?.image_generation_prompt || scene.slugline;
  }

  // 1. Project visual style (brief)
  if (projectVisualStyle) {
    parts.push(projectVisualStyle);
  }

  // 2. Action/scene description - THE CORE of the prompt
  const actionDescription = rawData.action_description || rawData.action_summary;
  if (actionDescription) {
    parts.push(actionDescription);
  }

  // 3. Shot type (from N8N)
  if (rawData.shot_type) {
    parts.push(rawData.shot_type);
  }

  // 4. Wardrobe - scene-specific clothing (NOT character visual DNA)
  if (rawData.wardrobe_description) {
    parts.push(rawData.wardrobe_description);
  }

  // 5. Composition instruction (framing, camera angles)
  if (rawData.composition_instruction) {
    parts.push(rawData.composition_instruction);
  } else if (rawData.visual_mood?.composition) {
    parts.push(rawData.visual_mood.composition);
  }

  // 6. Visual atmosphere (mood, feeling)
  if (rawData.visual_atmosphere) {
    parts.push(rawData.visual_atmosphere);
  } else if (rawData.visual_mood?.atmosphere) {
    parts.push(rawData.visual_mood.atmosphere);
  }

  // 7. Time of day
  if (rawData.time_of_day) {
    parts.push(rawData.time_of_day);
  }

  // 8. Anti-collage instruction - prevent multi-panel/storyboard outputs
  parts.push('Single cohesive cinematic frame, no collage, no multiple panels, no split screen, no storyboard');

  return parts.join('. ');
}

/**
 * Collect all Bible reference image URLs for injection
 * Returns an array of image URLs to use as reference for image-to-image generation
 */
function collectBibleReferenceImages(bibleData: BibleInjectionData): string[] {
  const images: string[] = [];

  // Add location image first (establishes the setting)
  if (bibleData.location?.image_url) {
    images.push(bibleData.location.image_url);
  }

  // MVP Simplification: Portrait only
  for (const character of bibleData.characters) {
    if (character.portrait_url) {
      images.push(character.portrait_url);
    }
  }

  // Add prop images
  for (const prop of bibleData.props) {
    if (prop.image_url) {
      images.push(prop.image_url);
    }
  }

  return images;
}

/**
 * Fallback: Compose a minimal scene prompt for text-to-image
 *
 * Used ONLY when no Bible reference images exist (rare edge case).
 * Keeps prompt short to avoid model rejection - just names + action.
 *
 * NOTE: Your workflow should always have Bible images. This is just a safety net.
 */
function composeScenePromptFallback(
  scene: Scene,
  bibleData: BibleInjectionData,
  projectVisualStyle: string
): string {
  const parts: string[] = [];
  const rawData = scene.raw_scene_data;

  if (!rawData) {
    return scene.slugline;
  }

  // 1. Visual style (brief)
  if (projectVisualStyle) {
    parts.push(projectVisualStyle);
  }

  // 2. Location NAME only (not description)
  const locationName = bibleData.location?.name || rawData.location || rawData.bible_location_id;
  if (locationName) {
    parts.push(locationName);
  }

  // 3. Character NAMES only (not visual DNA)
  const characterNames = bibleData.characters.length > 0
    ? bibleData.characters.map((c) => c.name)
    : rawData.characters_present || rawData.bible_character_ids || [];
  if (characterNames.length > 0) {
    parts.push(characterNames.join(' and '));
  }

  // 4. Action - core of the scene
  const actionDescription = rawData.action_description || rawData.action_summary;
  if (actionDescription) {
    parts.push(actionDescription);
  }

  // 5. Shot type
  if (rawData.shot_type) {
    parts.push(rawData.shot_type);
  }

  // 6. Time of day
  if (rawData.time_of_day) {
    parts.push(rawData.time_of_day);
  }

  // 7. Anti-collage instruction - prevent multi-panel/storyboard outputs
  parts.push('Single cohesive cinematic frame, no collage, no multiple panels, no split screen, no storyboard');

  return parts.join('. ');
}

// ============================================================================
// Variant Generation
// ============================================================================

/**
 * Model selection options for scene image generation
 */
export type SceneModelSelection = 'seedream' | 'nano-banana' | 'both';

/**
 * Get quality setting based on model type
 */
function getQualityForModel(model: string): string {
  const modelLower = model.toLowerCase();
  if (modelLower.includes('seedream')) {
    return 'basic';
  }
  if (modelLower.includes('nano-banana')) {
    return 'low';
  }
  return 'medium';
}

/**
 * Get models based on selection and whether we have reference images
 * - With reference images: Use image-to-image models
 * - Without reference images: Use text-to-image models (fallback)
 */
function getModelsForSelection(
  selection: SceneModelSelection,
  hasReferenceImages: boolean
): AIModel[] {
  if (hasReferenceImages) {
    // Image-to-image models for Bible injection
    switch (selection) {
      case 'seedream':
        return ['seedream-4.5-image-to-image'];
      case 'nano-banana':
        return ['nano-banana-pro-image-to-image'];
      case 'both':
      default:
        return ['seedream-4.5-image-to-image', 'nano-banana-pro-image-to-image'];
    }
  } else {
    // Text-to-image fallback when no reference images
    switch (selection) {
      case 'seedream':
        return ['seedream-4.5-text-to-image'];
      case 'nano-banana':
        return ['nano-banana-pro-text-to-image'];
      case 'both':
      default:
        return ['seedream-4.5-text-to-image', 'nano-banana-pro-text-to-image'];
    }
  }
}

/**
 * Generate scene image variants with Bible reference injection
 *
 * Two generation modes:
 * 1. IMAGE-TO-IMAGE (preferred): When Bible assets have images
 *    - Uses SHORT prompt (action, shot type, composition)
 *    - Injects Bible reference images (characters, location, props)
 *    - Model uses visual references for consistency
 *
 * 2. TEXT-TO-IMAGE (fallback): When no Bible images available
 *    - Uses FULL prompt with character/location/prop descriptions
 *    - Relies purely on text descriptions
 *
 * @param sceneId - Scene to generate images for
 * @param modelSelection - Which model(s) to use: 'seedream', 'nano-banana', or 'both'
 * @param apiKeys - Optional user-provided API keys from localStorage
 */
export async function generateSceneVariants(
  sceneId: string,
  modelSelection: SceneModelSelection = 'both',
  apiKeys?: ApiKeys
): Promise<SceneImageActionResult> {
  try {
    console.log('🎬 Generating scene variants for:', sceneId, 'with model:', modelSelection);

    // Get scene
    const [scene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, sceneId))
      .limit(1);

    if (!scene) {
      return { success: false, error: 'Scene not found' };
    }

    // Get project for visual style
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, scene.project_id))
      .limit(1);

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    // Resolve Bible elements
    const bibleData = await resolveBibleElements(scene.project_id, scene);

    console.log('📚 Bible elements resolved:', {
      characters: bibleData.characters.length,
      location: bibleData.location?.name || 'none',
      props: bibleData.props.length,
    });

    // Collect Bible reference images for injection
    const referenceImages = collectBibleReferenceImages(bibleData);
    const hasReferenceImages = referenceImages.length > 0;

    console.log('🖼️ Reference images collected:', {
      count: referenceImages.length,
      hasImages: hasReferenceImages,
      urls: referenceImages.slice(0, 3), // Log first 3 URLs
    });

    // Choose prompt strategy based on whether we have reference images
    let prompt: string;
    if (hasReferenceImages) {
      // SHORT prompt - action/composition only (reference images provide visual context)
      prompt = composeScenePromptShort(scene, project.visual_style || '');
      console.log('📝 Using SHORT prompt (I2I with reference images)');
    } else {
      // MINIMAL fallback prompt - just names + action (avoid long descriptions)
      prompt = composeScenePromptFallback(scene, bibleData, project.visual_style || '');
      console.log('⚠️ Using FALLBACK prompt (T2I - no reference images found)');
    }

    console.log('📝 Composed prompt:', prompt.substring(0, 300) + (prompt.length > 300 ? '...' : ''));

    // Get models based on selection and generation mode
    const models = getModelsForSelection(modelSelection, hasReferenceImages);

    console.log('🎯 Models selected:', models, hasReferenceImages ? '(I2I)' : '(T2I)');

    // Extract Bible element IDs for tracking
    const injectedCharacterIds = bibleData.characters.map((c) => c.id);
    const injectedLocationIds = bibleData.location
      ? [bibleData.location.id]
      : [];
    const injectedPropIds = bibleData.props.map((p) => p.id);

    // Create variant records
    console.log(`📸 Creating ${models.length} variant records...`);
    const createdVariants = await Promise.all(
      models.map(async (model, i) => {
        const [variant] = await db
          .insert(sceneImageVariants)
          .values({
            scene_id: sceneId,
            model,
            prompt,
            status: 'generating',
            is_selected: false,
            generation_order: i,
            injected_characters: injectedCharacterIds,
            injected_locations: injectedLocationIds,
            injected_props: injectedPropIds,
          })
          .returning();

        console.log(
          `📸 Created variant ${i + 1}/${models.length}: ${variant.id} (${model})`
        );
        return variant;
      })
    );

    // Trigger parallel generation
    console.log(`🚀 Starting PARALLEL generation for ${models.length} variants...`);

    const generationPromises = createdVariants.map(async (variant, i) => {
      const model = models[i];
      const mappedModel = mapModelToN8NName(model);

      console.log(`🚀 [${model}] Invoking n8n workflow...`);

      // Build generation payload
      const generationPayload: Parameters<typeof generateImage>[0] = {
        prompt,
        model: mappedModel,
        aspect_ratio: '16:9', // Scene images are widescreen
        quality: getQualityForModel(mappedModel),
        variant_id: variant.id,
        next_js_callback_url: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/n8n/scene-image-variant`,
      };

      // Add reference images for I2I
      if (hasReferenceImages) {
        generationPayload.reference_images = referenceImages;
        console.log(`🖼️ [${model}] Injecting ${referenceImages.length} reference images`);
      }

      const result = await generateImage(generationPayload, apiKeys);

      console.log(`📦 [${model}] n8n response:`, JSON.stringify(result, null, 2));

      if (result.success && result.data) {
        const responseData = Array.isArray(result.data)
          ? result.data[0]
          : result.data;

        console.log(`📋 [${model}] Response data:`, responseData);
        console.log(`📋 [${model}] taskId:`, responseData.taskId || 'MISSING');
        console.log(`📋 [${model}] imageUrl:`, responseData.imageUrl ? `${responseData.imageUrl.substring(0, 50)}...` : 'MISSING');

        // Store taskId
        if (responseData.taskId) {
          await db
            .update(sceneImageVariants)
            .set({ n8n_job_id: responseData.taskId })
            .where(eq(sceneImageVariants.id, variant.id));
          console.log(`✅ [${model}] Stored taskId: ${responseData.taskId}`);
        }

        // If we got imageUrl directly (synchronous response), upload to Supabase immediately
        if (responseData.imageUrl) {
          console.log(`📸 [${model}] Got temp URL, uploading to Supabase (FAST mode)...`);

          const uploaded = await downloadAndUploadToSupabaseFast(
            responseData.imageUrl,
            sceneId,
            variant.id
          );

          if (uploaded) {
            // Save permanent Supabase URL and mark as ready
            await db
              .update(sceneImageVariants)
              .set({
                image_url: uploaded.url,
                storage_path: uploaded.path,
                status: 'ready',
                n8n_job_id: responseData.taskId,
                updated_at: new Date(),
              })
              .where(eq(sceneImageVariants.id, variant.id));
            console.log(`✅ [${model}] Variant saved with permanent Supabase URL`);
          } else {
            // Upload failed - mark as failed (webhook won't help since n8n doesn't call it)
            console.log(`⚠️ [${model}] Fast upload failed, marking as failed`);
            await db
              .update(sceneImageVariants)
              .set({
                status: 'failed',
                error_message: 'Failed to upload image to storage',
                updated_at: new Date(),
              })
              .where(eq(sceneImageVariants.id, variant.id));
          }
        } else {
          console.log(`⚠️ [${model}] No imageUrl in response - image may have failed`);
        }
      } else {
        console.log(`❌ [${model}] Generation failed:`, result.error);
        // Mark as failed
        await db
          .update(sceneImageVariants)
          .set({
            status: 'failed',
            error_message: result.error || 'Generation failed',
            updated_at: new Date(),
          })
          .where(eq(sceneImageVariants.id, variant.id));
      }

      return variant.id;
    });

    const variantIds = await Promise.all(generationPromises);
    console.log(`✅ All ${models.length} generation requests sent!`, variantIds);

    revalidatePath(`/projects/${project.id}/studio/images`, 'page');

    return { success: true, data: { variantIds } };
  } catch (error) {
    console.error('❌ Error generating scene variants:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to generate variants',
    };
  }
}

// ============================================================================
// Variant Selection
// ============================================================================

/**
 * Select a variant as the approved scene image
 *
 * Marks the variant as selected, updates the scene with the approved image,
 * and triggers video + audio generation.
 */
export async function selectSceneVariant(
  variantId: string
): Promise<SceneImageActionResult> {
  try {
    console.log('✅ Selecting scene variant:', variantId);

    // Get variant
    const [variant] = await db
      .select()
      .from(sceneImageVariants)
      .where(eq(sceneImageVariants.id, variantId))
      .limit(1);

    if (!variant) {
      return { success: false, error: 'Variant not found' };
    }

    if (variant.status !== 'ready') {
      return {
        success: false,
        error: `Variant is ${variant.status}, not ready to select`,
      };
    }

    // Get scene for project_id
    const [scene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, variant.scene_id))
      .limit(1);

    if (!scene) {
      return { success: false, error: 'Scene not found' };
    }

    // Unselect other variants for same scene
    await db
      .update(sceneImageVariants)
      .set({ is_selected: false, updated_at: new Date() })
      .where(eq(sceneImageVariants.scene_id, variant.scene_id));

    // Mark this variant as selected
    await db
      .update(sceneImageVariants)
      .set({ is_selected: true, status: 'selected', updated_at: new Date() })
      .where(eq(sceneImageVariants.id, variantId));

    // Update scene with approved image
    await db
      .update(scenes)
      .set({
        approved_image_id: variant.id,
        approved_image_url: variant.image_url,
        approved_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(scenes.id, variant.scene_id));

    console.log('✅ Variant selected and scene updated');

    // Trigger scene-to-shots: Create shots for this scene
    // Each shot will use this approved scene image for video generation
    console.log('🎬 Triggering scene-to-shots for scene:', scene.id);
    const shotsResult = await createShotsWithAI(scene.id);
    if (shotsResult.success) {
      console.log(`✅ Created ${shotsResult.shotIds?.length || 0} shots for scene`);
    } else {
      console.log('⚠️ Shot creation failed:', shotsResult.error);
      // Don't fail the variant selection if shot creation fails
    }

    // NOTE: Video generation happens per-shot, not per-scene
    // User can trigger video generation from the video studio after reviewing shots

    revalidatePath(`/projects/${scene.project_id}/studio/images`, 'page');
    revalidatePath(`/projects/${scene.project_id}/studio/video`, 'page');

    return { success: true };
  } catch (error) {
    console.error('❌ Error selecting variant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to select variant',
    };
  }
}

/**
 * Unselect/unapprove a variant
 *
 * Reverts the variant to 'ready' status and clears the approved image from the scene.
 * This allows users to change their mind about which image to use.
 */
export async function unselectSceneVariant(
  variantId: string
): Promise<SceneImageActionResult> {
  try {
    console.log('↩️ Unselecting scene variant:', variantId);

    // Get variant
    const [variant] = await db
      .select()
      .from(sceneImageVariants)
      .where(eq(sceneImageVariants.id, variantId))
      .limit(1);

    if (!variant) {
      return { success: false, error: 'Variant not found' };
    }

    if (!variant.is_selected) {
      return { success: false, error: 'Variant is not currently selected' };
    }

    // Get scene for project_id
    const [scene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, variant.scene_id))
      .limit(1);

    if (!scene) {
      return { success: false, error: 'Scene not found' };
    }

    // Revert variant to ready status
    await db
      .update(sceneImageVariants)
      .set({
        is_selected: false,
        status: 'ready',
        updated_at: new Date(),
      })
      .where(eq(sceneImageVariants.id, variantId));

    // Clear approved image from scene
    await db
      .update(scenes)
      .set({
        approved_image_id: null,
        approved_image_url: null,
        approved_at: null,
        updated_at: new Date(),
      })
      .where(eq(scenes.id, variant.scene_id));

    console.log('✅ Variant unselected and scene cleared');

    revalidatePath(`/projects/${scene.project_id}/studio/images`, 'page');

    return { success: true };
  } catch (error) {
    console.error('❌ Error unselecting variant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unselect variant',
    };
  }
}

// ============================================================================
// Variant Refinement (Image-to-Image)
// ============================================================================

/**
 * Refine a scene variant using image-to-image
 *
 * Takes an existing variant as the source image and creates a new variant
 * with the refinement prompt. This allows users to iteratively improve
 * scene images.
 *
 * @param variantId - ID of the variant to use as source image
 * @param modelSelection - Model to use: 'seedream' or 'nano-banana'
 * @param refinementPrompt - What to change about the image
 * @param apiKeys - Optional user-provided API keys from localStorage
 */
export async function refineSceneVariant(
  variantId: string,
  modelSelection: 'seedream' | 'nano-banana',
  refinementPrompt: string,
  apiKeys?: ApiKeys
): Promise<SceneImageActionResult> {
  try {
    console.log('🔧 Refining scene variant:', variantId, 'with model:', modelSelection);

    // Get the source variant
    const [sourceVariant] = await db
      .select()
      .from(sceneImageVariants)
      .where(eq(sceneImageVariants.id, variantId))
      .limit(1);

    if (!sourceVariant) {
      return { success: false, error: 'Source variant not found' };
    }

    if (!sourceVariant.image_url) {
      return { success: false, error: 'Source variant has no image to refine' };
    }

    // Get scene
    const [scene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, sourceVariant.scene_id))
      .limit(1);

    if (!scene) {
      return { success: false, error: 'Scene not found' };
    }

    // Get project for visual style
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, scene.project_id))
      .limit(1);

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    // For I2I refinement, we send ONLY the refinement instructions
    // The source image already contains all visual context from the original generation
    // This is how I2I models work: base image + modification prompt
    console.log('📝 Refinement prompt:', refinementPrompt);

    // Determine I2I model based on selection
    const model: AIModel = modelSelection === 'seedream'
      ? 'seedream-4.5-image-to-image'
      : 'nano-banana-pro-image-to-image';

    // Get current max generation_order for this scene
    const existingVariants = await db
      .select()
      .from(sceneImageVariants)
      .where(eq(sceneImageVariants.scene_id, scene.id));

    const maxOrder = existingVariants.reduce((max, v) => Math.max(max, v.generation_order ?? 0), 0);

    // Create new variant record
    // Store the refinement prompt (what we're actually sending to n8n)
    // The source image provides the visual context, so we only need the modification instructions
    const [newVariant] = await db
      .insert(sceneImageVariants)
      .values({
        scene_id: scene.id,
        model,
        prompt: refinementPrompt, // Store the actual refinement instructions sent to n8n
        status: 'generating',
        is_selected: false,
        generation_order: maxOrder + 1,
        parent_variant_id: variantId, // Track refinement chain
        injected_characters: sourceVariant.injected_characters,
        injected_locations: sourceVariant.injected_locations,
        injected_props: sourceVariant.injected_props,
      })
      .returning();

    console.log(`📸 Created refinement variant: ${newVariant.id}`);

    // Trigger n8n with the source image
    const mappedModel = mapModelToN8NName(model);

    console.log(`🚀 Invoking n8n workflow for refinement...`);
    console.log(`📝 Source variant prompt length: ${sourceVariant.prompt?.length || 0}`);
    console.log(`📝 Refinement prompt being sent: "${refinementPrompt}"`);

    const generationPayload: Parameters<typeof generateImage>[0] = {
      prompt: refinementPrompt, // For I2I, send ONLY the refinement instructions
      model: mappedModel,
      aspect_ratio: '16:9',
      quality: getQualityForModel(mappedModel),
      variant_id: newVariant.id,
      source_image_url: sourceVariant.image_url, // Use source image for I2I
      next_js_callback_url: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/n8n/scene-image-variant`,
    };

    console.log(`📤 Sending to n8n:`, JSON.stringify({
      prompt: generationPayload.prompt,
      model: generationPayload.model,
      source_image_url: generationPayload.source_image_url?.substring(0, 50) + '...',
    }, null, 2));

    const result = await generateImage(generationPayload, apiKeys);

    console.log(`📦 n8n response:`, JSON.stringify(result, null, 2));

    if (result.success && result.data) {
      const responseData = Array.isArray(result.data) ? result.data[0] : result.data;

      console.log(`📋 Refinement Response data:`, responseData);
      console.log(`📋 taskId:`, responseData.taskId || 'MISSING');
      console.log(`📋 imageUrl:`, responseData.imageUrl ? `${responseData.imageUrl.substring(0, 50)}...` : 'MISSING');

      if (responseData.taskId) {
        await db
          .update(sceneImageVariants)
          .set({ n8n_job_id: responseData.taskId })
          .where(eq(sceneImageVariants.id, newVariant.id));
        console.log(`✅ Stored taskId: ${responseData.taskId}`);
      }

      // If we got imageUrl directly (synchronous response), upload to Supabase immediately
      if (responseData.imageUrl) {
        console.log(`📸 Got temp URL, uploading to Supabase (FAST mode)...`);

        const uploaded = await downloadAndUploadToSupabaseFast(
          responseData.imageUrl,
          scene.id,
          newVariant.id
        );

        if (uploaded) {
          // Save permanent Supabase URL and mark as ready
          await db
            .update(sceneImageVariants)
            .set({
              image_url: uploaded.url,
              storage_path: uploaded.path,
              status: 'ready',
              n8n_job_id: responseData.taskId,
              updated_at: new Date(),
            })
            .where(eq(sceneImageVariants.id, newVariant.id));
          console.log(`✅ Refinement variant saved with permanent Supabase URL`);
        } else {
          // Upload failed - mark as failed
          console.log(`⚠️ Fast upload failed, marking as failed`);
          await db
            .update(sceneImageVariants)
            .set({
              status: 'failed',
              error_message: 'Failed to upload image to storage',
              updated_at: new Date(),
            })
            .where(eq(sceneImageVariants.id, newVariant.id));
        }
      } else {
        console.log(`⚠️ No imageUrl in response - image may have failed`);
      }
    } else {
      console.log(`❌ Refinement generation failed:`, result.error);
      await db
        .update(sceneImageVariants)
        .set({
          status: 'failed',
          error_message: result.error || 'Refinement failed',
          updated_at: new Date(),
        })
        .where(eq(sceneImageVariants.id, newVariant.id));
    }

    revalidatePath(`/projects/${project.id}/studio/images`, 'page');

    return { success: true, data: { variantId: newVariant.id } };
  } catch (error) {
    console.error('❌ Error refining scene variant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to refine variant',
    };
  }
}

// ============================================================================
// Variant Management
// ============================================================================

/**
 * Delete failed variants for a scene
 *
 * Removes all variants with status 'failed' from the database.
 * Useful for cleaning up after failed generation attempts.
 */
export async function deleteFailedVariants(
  sceneId: string
): Promise<SceneImageActionResult> {
  try {
    console.log('🗑️ Deleting failed variants for scene:', sceneId);

    // Get scene for project_id (for revalidation)
    const [scene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, sceneId))
      .limit(1);

    if (!scene) {
      return { success: false, error: 'Scene not found' };
    }

    // Delete failed variants
    const deleted = await db
      .delete(sceneImageVariants)
      .where(
        and(
          eq(sceneImageVariants.scene_id, sceneId),
          eq(sceneImageVariants.status, 'failed')
        )
      )
      .returning();

    console.log(`✅ Deleted ${deleted.length} failed variants`);

    revalidatePath(`/projects/${scene.project_id}/studio/images`, 'page');

    return { success: true, data: { deletedCount: deleted.length } };
  } catch (error) {
    console.error('❌ Error deleting failed variants:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete variants',
    };
  }
}

/**
 * Delete all non-selected variants for a scene
 *
 * Removes all variants that are not selected (including failed, generating, and ready).
 * Useful for cleaning up stuck or unwanted variants.
 */
export async function deleteAllVariants(
  sceneId: string
): Promise<SceneImageActionResult> {
  try {
    console.log('🗑️ Deleting all non-selected variants for scene:', sceneId);

    // Get scene for project_id (for revalidation)
    const [scene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, sceneId))
      .limit(1);

    if (!scene) {
      return { success: false, error: 'Scene not found' };
    }

    // Delete all non-selected variants
    const deleted = await db
      .delete(sceneImageVariants)
      .where(
        and(
          eq(sceneImageVariants.scene_id, sceneId),
          eq(sceneImageVariants.is_selected, false)
        )
      )
      .returning();

    console.log(`✅ Deleted ${deleted.length} variants`);

    revalidatePath(`/projects/${scene.project_id}/studio/images`, 'page');

    return { success: true, data: { deletedCount: deleted.length } };
  } catch (error) {
    console.error('❌ Error deleting variants:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete variants',
    };
  }
}

/**
 * Delete a specific variant
 */
export async function deleteVariant(
  variantId: string
): Promise<SceneImageActionResult> {
  try {
    console.log('🗑️ Deleting variant:', variantId);

    // Get variant for scene_id
    const [variant] = await db
      .select()
      .from(sceneImageVariants)
      .where(eq(sceneImageVariants.id, variantId))
      .limit(1);

    if (!variant) {
      return { success: false, error: 'Variant not found' };
    }

    // Don't allow deleting selected variants
    if (variant.is_selected) {
      return { success: false, error: 'Cannot delete selected variant' };
    }

    // Get scene for project_id
    const [scene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, variant.scene_id))
      .limit(1);

    // Delete the variant
    await db
      .delete(sceneImageVariants)
      .where(eq(sceneImageVariants.id, variantId));

    console.log(`✅ Deleted variant ${variantId}`);

    if (scene) {
      revalidatePath(`/projects/${scene.project_id}/studio/images`, 'page');
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting variant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete variant',
    };
  }
}

/**
 * Retry a failed variant - deletes the failed one and generates a new one with the same model
 * @param variantId - ID of the failed variant to retry
 * @param apiKeys - Optional user-provided API keys from localStorage
 */
export async function retryVariant(
  variantId: string,
  apiKeys?: ApiKeys
): Promise<SceneImageActionResult> {
  try {
    console.log('🔄 Retrying variant:', variantId);

    // Get the failed variant
    const [variant] = await db
      .select()
      .from(sceneImageVariants)
      .where(eq(sceneImageVariants.id, variantId))
      .limit(1);

    if (!variant) {
      return { success: false, error: 'Variant not found' };
    }

    if (variant.status !== 'failed') {
      return { success: false, error: 'Can only retry failed variants' };
    }

    // Map stored model back to selection
    const modelSelection: SceneModelSelection = variant.model.includes('seedream')
      ? 'seedream'
      : 'nano-banana';

    const sceneId = variant.scene_id;

    // Delete the failed variant
    await db
      .delete(sceneImageVariants)
      .where(eq(sceneImageVariants.id, variantId));

    console.log(`🗑️ Deleted failed variant ${variantId}, regenerating with ${modelSelection}...`);

    // Generate new variant with the same model
    const result = await generateSceneVariants(sceneId, modelSelection, apiKeys);

    return result;
  } catch (error) {
    console.error('❌ Error retrying variant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retry variant',
    };
  }
}

// ============================================================================
// Data Fetching
// ============================================================================

/**
 * Get variants for a scene
 */
export async function getSceneVariants(
  sceneId: string
): Promise<SceneVariantsData> {
  const variants = await db
    .select()
    .from(sceneImageVariants)
    .where(eq(sceneImageVariants.scene_id, sceneId))
    .orderBy(sceneImageVariants.generation_order);

  const selectedVariant = variants.find((v) => v.is_selected) || null;
  const hasApprovedImage = selectedVariant !== null;

  return {
    sceneId,
    variants,
    selectedVariant,
    hasApprovedImage,
  };
}

/**
 * Get Bible injection preview for a scene
 * Used by UI to show what will be injected before generation
 */
export async function getBibleInjectionPreview(
  sceneId: string
): Promise<BibleInjectionData | null> {
  const [scene] = await db
    .select()
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .limit(1);

  if (!scene) {
    return null;
  }

  return resolveBibleElements(scene.project_id, scene);
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Bulk approve all scene images for a project
 * For each scene without an approved image, selects the first ready variant
 */
export async function bulkApproveSceneImages(
  projectId: string
): Promise<SceneImageActionResult & { approvedCount?: number }> {
  try {
    console.log('📦 Bulk approving scene images for project:', projectId);

    // Get all scenes for this project
    const projectScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.project_id, projectId))
      .orderBy(scenes.scene_number);

    if (projectScenes.length === 0) {
      return { success: false, error: 'No scenes found for project' };
    }

    let approvedCount = 0;

    for (const scene of projectScenes) {
      // Get variants for this scene
      const variants = await db
        .select()
        .from(sceneImageVariants)
        .where(eq(sceneImageVariants.scene_id, scene.id))
        .orderBy(sceneImageVariants.generation_order);

      // Skip if already has a selected variant
      const hasSelected = variants.some((v) => v.is_selected);
      if (hasSelected) {
        console.log(`⏭️ Scene ${scene.scene_number} already has approved image`);
        continue;
      }

      // Find first ready variant
      const readyVariant = variants.find((v) => v.status === 'ready' && v.image_url);
      if (!readyVariant) {
        console.log(`⏭️ Scene ${scene.scene_number} has no ready variants`);
        continue;
      }

      // Select the variant
      await db
        .update(sceneImageVariants)
        .set({ is_selected: true })
        .where(eq(sceneImageVariants.id, readyVariant.id));

      // Update scene with approved image
      await db
        .update(scenes)
        .set({ approved_image_url: readyVariant.image_url })
        .where(eq(scenes.id, scene.id));

      console.log(`✅ Auto-approved Scene ${scene.scene_number} with variant ${readyVariant.id}`);
      approvedCount++;
    }

    console.log(`📦 Bulk approval complete: ${approvedCount} scenes approved`);
    revalidatePath(`/projects/${projectId}/studio/images`, 'page');

    return { success: true, approvedCount };
  } catch (error) {
    console.error('❌ Error bulk approving scene images:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to bulk approve',
    };
  }
}
