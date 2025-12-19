'use server';

/**
 * Final Reel Assembly Server Actions
 *
 * Server actions for triggering final reel assembly via FFmpeg API.
 * Gathers approved scene videos, orders them by scene_order, and
 * sends to n8n workflow for crossfade assembly.
 * After assembly, downloads the video and uploads to Supabase for permanent storage.
 */

import { db } from '@/lib/drizzle/db';
import {
  final_reels,
  scene_shots,
  scenes,
  projects,
} from '@/lib/drizzle/schema';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

// ============================================================================
// Types
// ============================================================================

export type AssemblyActionResult =
  | { success: true; reelId?: string; videoUrl?: string; youtubeUrl?: string; youtubeId?: string }
  | { success: false; error: string };

interface VideoForAssembly {
  url: string;
  duration: number;
}

interface AssemblyWebhookPayload {
  projectId: string;
  title: string;
  description: string;
  videos: VideoForAssembly[];
}

interface AssemblyWebhookResponse {
  success: boolean;
  videoUrl?: string; // Temporary MP4 download URL from FFmpeg API (expires in 2 hours)
  youtubeUrl?: string; // YouTube unlisted video URL
  youtubeId?: string; // YouTube video ID
  projectId?: string;
  error?: string;
}

// ============================================================================
// Supabase Storage Helper
// ============================================================================

/**
 * Download video from temporary URL and upload to Supabase Storage
 * @param tempUrl - Temporary URL from FFmpeg API
 * @param projectId - Project ID for file naming
 * @returns Permanent Supabase public URL
 */
async function uploadVideoToSupabase(tempUrl: string, projectId: string): Promise<string> {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('📥 Downloading video from temporary URL...');

  // Download the video from FFmpeg API
  const response = await fetch(tempUrl);

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
  }

  const videoBuffer = await response.arrayBuffer();
  const videoSize = videoBuffer.byteLength;
  console.log(`📦 Downloaded ${(videoSize / 1024 / 1024).toFixed(2)}MB`);

  // Generate unique filename
  const timestamp = Date.now();
  const filename = `${projectId}/final-reel-${timestamp}.mp4`;

  console.log('📤 Uploading to Supabase Storage...');

  // Upload to Supabase Storage (reels bucket)
  const { data, error } = await supabase.storage
    .from('reels')
    .upload(filename, videoBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('reels')
    .getPublicUrl(filename);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL');
  }

  console.log('✅ Uploaded to Supabase:', urlData.publicUrl);

  return urlData.publicUrl;
}

// ============================================================================
// Assembly Actions
// ============================================================================

/**
 * Trigger final reel assembly for a project
 *
 * Gathers all ready scene videos, orders them by scene_order,
 * and sends to n8n workflow for FFmpeg assembly with crossfades.
 *
 * @param projectId - The project to assemble
 * @returns Result with reelId and videoUrl on success
 */
export async function triggerFinalAssembly(
  projectId: string
): Promise<AssemblyActionResult> {
  try {
    console.log('🎬 Triggering final assembly for project:', projectId);

    // Get the project with scene_order
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    // Get all scenes for this project
    const projectScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.project_id, projectId));

    if (projectScenes.length === 0) {
      return { success: false, error: 'No scenes found for project' };
    }

    // Get all ready video shots from scene_shots table, ordered by shot_number
    const sceneIds = projectScenes.map((s) => s.id);
    const readyShots = await db
      .select({
        id: scene_shots.id,
        scene_id: scene_shots.scene_id,
        shot_number: scene_shots.shot_number,
        video_url: scene_shots.video_url,
        shot_duration_seconds: scene_shots.shot_duration_seconds,
      })
      .from(scene_shots)
      .where(
        and(
          inArray(scene_shots.scene_id, sceneIds),
          eq(scene_shots.video_status, 'ready'),
          isNotNull(scene_shots.video_url)
        )
      )
      .orderBy(scene_shots.scene_id, scene_shots.shot_number);

    if (readyShots.length < 2) {
      return {
        success: false,
        error: `Need at least 2 ready video shots for assembly. Found: ${readyShots.length}`,
      };
    }

    // Group shots by scene_id (already ordered by shot_number from query)
    // NOTE: We don't send durations - let FFmpeg probe actual video durations for accuracy
    const videoMap = new Map<string, VideoForAssembly[]>();
    for (const shot of readyShots) {
      if (shot.video_url) {
        const existing = videoMap.get(shot.scene_id) || [];
        existing.push({
          url: shot.video_url,
          duration: 0, // Let FFmpeg probe actual duration
        });
        videoMap.set(shot.scene_id, existing);
      }
    }

    // Order videos according to scene_order (or scene_number fallback)
    // Each scene may have multiple shots that need to be flattened in order
    const rawSceneOrder = (project.scene_order as (string | number)[]) || [];
    const orderedVideos: VideoForAssembly[] = [];

    // Create maps for both UUID and scene_number lookups
    const sceneNumberToId = new Map(projectScenes.map((s) => [s.scene_number, s.id]));
    const sceneIdToNumber = new Map(projectScenes.map((s) => [s.id, s.scene_number]));

    // Detect if scene_order contains UUIDs or scene numbers
    const hasUuidOrder = rawSceneOrder.length > 0 && typeof rawSceneOrder[0] === 'string' && rawSceneOrder[0].includes('-');

    if (hasUuidOrder) {
      // scene_order contains UUIDs - use directly
      for (const sceneId of rawSceneOrder as string[]) {
        const sceneShots = videoMap.get(sceneId);
        if (sceneShots) {
          orderedVideos.push(...sceneShots);
        }
      }
    } else if (rawSceneOrder.length > 0) {
      // scene_order contains scene numbers - convert to UUIDs
      for (const sceneNum of rawSceneOrder as number[]) {
        const sceneId = sceneNumberToId.get(sceneNum);
        if (sceneId) {
          const sceneShots = videoMap.get(sceneId);
          if (sceneShots) {
            orderedVideos.push(...sceneShots);
          }
        }
      }
    } else {
      // No scene_order - fallback: order by scene_number
      const sortedSceneIds = [...videoMap.keys()].sort((a, b) => {
        const numA = sceneIdToNumber.get(a) || 0;
        const numB = sceneIdToNumber.get(b) || 0;
        return numA - numB;
      });

      for (const sceneId of sortedSceneIds) {
        const sceneShots = videoMap.get(sceneId);
        if (sceneShots) {
          orderedVideos.push(...sceneShots);
        }
      }
    }

    if (orderedVideos.length < 2) {
      return {
        success: false,
        error: `Need at least 2 video shots with URLs. Found: ${orderedVideos.length}`,
      };
    }

    console.log(`📹 Assembling ${orderedVideos.length} video shots from ${videoMap.size} scenes`);

    // Check for existing final_reel record
    const [existingReel] = await db
      .select()
      .from(final_reels)
      .where(eq(final_reels.project_id, projectId))
      .limit(1);

    let reelId: string;

    if (existingReel) {
      // Update existing record
      await db
        .update(final_reels)
        .set({
          status: 'assembling',
          video_url: null,
          error_message: null,
          assembly_progress: { started_at: new Date().toISOString(), video_count: orderedVideos.length },
        })
        .where(eq(final_reels.id, existingReel.id));
      reelId = existingReel.id;
      console.log('📝 Updated existing reel record:', reelId);
    } else {
      // Create new record
      const [newReel] = await db
        .insert(final_reels)
        .values({
          project_id: projectId,
          status: 'assembling',
          assembly_progress: { started_at: new Date().toISOString(), video_count: orderedVideos.length },
        })
        .returning();
      reelId = newReel.id;
      console.log('📝 Created new reel record:', reelId);
    }

    // Get webhook URL from environment
    const webhookUrl = process.env.N8N_ASSEMBLY_WEBHOOK;
    if (!webhookUrl) {
      // Update status to failed
      await db
        .update(final_reels)
        .set({
          status: 'failed',
          error_message: 'Assembly webhook URL not configured',
        })
        .where(eq(final_reels.id, reelId));

      return { success: false, error: 'Assembly webhook URL not configured' };
    }

    // Prepare payload with title and description for YouTube
    const payload: AssemblyWebhookPayload = {
      projectId,
      title: `${project.title} - Film Reel`,
      description: `Film reel for "${project.title}"\n\nCreated with RipReel.io - AI-powered film production tool`,
      videos: orderedVideos,
    };

    console.log('🚀 Calling assembly webhook:', webhookUrl);
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));

    // Call n8n webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Webhook error:', response.status, errorText);

      await db
        .update(final_reels)
        .set({
          status: 'failed',
          error_message: `Webhook failed: ${response.status} ${errorText}`,
        })
        .where(eq(final_reels.id, reelId));

      return { success: false, error: `Assembly webhook failed: ${response.status}` };
    }

    const result: AssemblyWebhookResponse = await response.json();

    if (!result.success) {
      console.error('❌ Assembly failed:', result.error);

      await db
        .update(final_reels)
        .set({
          status: 'failed',
          error_message: result.error || 'Assembly failed',
        })
        .where(eq(final_reels.id, reelId));

      return { success: false, error: result.error || 'Assembly failed' };
    }

    // FFmpeg assembly successful! Now upload to Supabase for permanent storage
    let permanentVideoUrl = result.videoUrl;

    if (result.videoUrl) {
      try {
        console.log('📦 Uploading assembled video to Supabase...');

        await db
          .update(final_reels)
          .set({
            status: 'uploading',
            assembly_progress: {
              step: 'uploading_to_supabase',
              video_count: orderedVideos.length,
            },
          })
          .where(eq(final_reels.id, reelId));

        permanentVideoUrl = await uploadVideoToSupabase(result.videoUrl, projectId);
        console.log('✅ Video uploaded to Supabase:', permanentVideoUrl);
      } catch (uploadError) {
        console.error('⚠️ Supabase upload failed, using temporary URL:', uploadError);
        // Continue with temporary URL if upload fails
        // The video will still be available for 2 hours
      }
    }

    // Success! Update final_reels with permanent Supabase URL and YouTube URL
    await db
      .update(final_reels)
      .set({
        status: 'ready',
        video_url: permanentVideoUrl, // Permanent Supabase URL (or temp if upload failed)
        youtube_url: result.youtubeUrl, // YouTube unlisted URL
        youtube_id: result.youtubeId, // YouTube video ID for embedding
        assembly_progress: {
          completed_at: new Date().toISOString(),
          video_count: orderedVideos.length,
          uploaded_to_supabase: permanentVideoUrl !== result.videoUrl,
        },
      })
      .where(eq(final_reels.id, reelId));

    console.log('✅ Assembly complete');
    console.log('   - Video URL:', permanentVideoUrl);
    console.log('   - YouTube URL:', result.youtubeUrl);

    revalidatePath(`/projects/${projectId}/studio/export`, 'page');

    return {
      success: true,
      reelId,
      videoUrl: permanentVideoUrl,
      youtubeUrl: result.youtubeUrl,
      youtubeId: result.youtubeId
    };
  } catch (error) {
    console.error('❌ Error triggering assembly:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger assembly',
    };
  }
}

/**
 * Get assembly status for a project
 *
 * Returns the current final_reels record if it exists.
 */
export async function getAssemblyStatus(projectId: string) {
  const [reel] = await db
    .select()
    .from(final_reels)
    .where(eq(final_reels.project_id, projectId))
    .limit(1);

  return reel || null;
}

/**
 * Retry failed assembly
 *
 * Resets the reel status and re-triggers assembly.
 */
export async function retryAssembly(
  projectId: string
): Promise<AssemblyActionResult> {
  console.log('🔄 Retrying assembly for project:', projectId);
  return triggerFinalAssembly(projectId);
}
