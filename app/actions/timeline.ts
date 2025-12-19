'use server';

/**
 * Timeline Server Actions
 *
 * Server actions for managing timeline data and scene reordering.
 */

import { db } from '@/lib/drizzle/db';
import { projects, scenes, scene_shots } from '@/lib/drizzle/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

// ============================================================================
// Types
// ============================================================================

export type TimelineActionResult =
  | { success: true; data?: unknown }
  | { success: false; error: string };

/**
 * Scene data for timeline display
 */
export interface TimelineScene {
  id: string;
  scene_number: number;
  slugline: string;
  approved_image_url: string | null;
  shots: TimelineShot[];
}

/**
 * Shot data for timeline display
 */
export interface TimelineShot {
  id: string;
  shot_number: number;
  shot_duration_seconds: number;
  video_url: string | null;
  video_status: string | null;
  start_frame_image_url: string | null;
}

/**
 * Complete timeline data
 */
export interface TimelineData {
  project_id: string;
  project_title: string;
  scenes: TimelineScene[];
  total_duration_seconds: number;
  all_videos_ready: boolean;
}

// ============================================================================
// Timeline Data Fetching
// ============================================================================

/**
 * Get timeline data for a project
 *
 * Fetches all scenes with their shots, ordered by scene_order (custom) or scene_number (default).
 * Calculates total duration from all shot durations.
 *
 * @param projectId - The project ID
 * @returns Timeline data with scenes and shots
 */
export async function getTimelineData(projectId: string): Promise<TimelineActionResult> {
  try {
    console.log('📊 Fetching timeline data for project:', projectId);

    // Get project
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
      .where(eq(scenes.project_id, projectId))
      .orderBy(asc(scenes.scene_number));

    // Apply custom scene order if it exists
    let orderedScenes = projectScenes;
    if (project.scene_order && Array.isArray(project.scene_order)) {
      const sceneOrderIds = project.scene_order as string[];
      const sceneMap = new Map(projectScenes.map(s => [s.id, s]));

      // Order scenes according to scene_order array
      orderedScenes = sceneOrderIds
        .map(id => sceneMap.get(id))
        .filter((s): s is typeof projectScenes[0] => s !== undefined);

      // Append any scenes not in the custom order (shouldn't happen, but safety)
      const orderedIds = new Set(sceneOrderIds);
      const unorderedScenes = projectScenes.filter(s => !orderedIds.has(s.id));
      orderedScenes.push(...unorderedScenes);
    }

    // Fetch all shots for all scenes in a single query (avoids N+1 problem)
    const allSceneIds = orderedScenes.map(s => s.id);
    const allShots = allSceneIds.length > 0
      ? await db
          .select()
          .from(scene_shots)
          .where(inArray(scene_shots.scene_id, allSceneIds))
          .orderBy(asc(scene_shots.shot_number))
      : [];

    // Group shots by scene_id for O(1) lookup
    const shotsBySceneId = allShots.reduce((acc, shot) => {
      if (!acc[shot.scene_id]) acc[shot.scene_id] = [];
      acc[shot.scene_id].push(shot);
      return acc;
    }, {} as Record<string, typeof allShots>);

    // Build timeline scenes with grouped shots
    let totalDurationSeconds = 0;
    let allVideosReady = true;
    const timelineScenes: TimelineScene[] = [];

    for (const scene of orderedScenes) {
      const sceneShots = shotsBySceneId[scene.id] || [];

      // Calculate duration and check video status
      let sceneDuration = 0;
      const shots: TimelineShot[] = sceneShots.map((shot) => {
        sceneDuration += shot.shot_duration_seconds;

        if (shot.video_status !== 'ready' && shot.video_status !== 'approved') {
          allVideosReady = false;
        }

        return {
          id: shot.id,
          shot_number: shot.shot_number,
          shot_duration_seconds: shot.shot_duration_seconds,
          video_url: shot.video_url,
          video_status: shot.video_status,
          start_frame_image_url: shot.start_frame_image_url,
        };
      });

      totalDurationSeconds += sceneDuration;

      timelineScenes.push({
        id: scene.id,
        scene_number: scene.scene_number,
        slugline: scene.slugline,
        approved_image_url: scene.approved_image_url,
        shots,
      });
    }

    const timelineData: TimelineData = {
      project_id: projectId,
      project_title: project.title,
      scenes: timelineScenes,
      total_duration_seconds: totalDurationSeconds,
      all_videos_ready: allVideosReady,
    };

    console.log('✅ Timeline data fetched:', {
      sceneCount: timelineScenes.length,
      totalDuration: totalDurationSeconds,
      allVideosReady,
    });

    return { success: true, data: timelineData };
  } catch (error) {
    console.error('❌ Error fetching timeline data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch timeline data',
    };
  }
}

// ============================================================================
// Scene Order Management
// ============================================================================

/**
 * Update scene order for a project
 *
 * Saves the new scene order to projects.scene_order JSONB field.
 * Uses optimistic updates on the client for instant feedback.
 *
 * @param projectId - The project ID
 * @param orderedSceneIds - Array of scene IDs in the new order
 * @returns Success result
 */
export async function updateSceneOrder(
  projectId: string,
  orderedSceneIds: string[]
): Promise<TimelineActionResult> {
  try {
    console.log('🔄 Updating scene order for project:', projectId, {
      sceneCount: orderedSceneIds.length,
    });

    // Validate that all scene IDs belong to this project
    const projectScenes = await db
      .select({ id: scenes.id })
      .from(scenes)
      .where(eq(scenes.project_id, projectId));

    const projectSceneIds = new Set(projectScenes.map(s => s.id));
    const validSceneIds = orderedSceneIds.filter(id => projectSceneIds.has(id));

    if (validSceneIds.length !== orderedSceneIds.length) {
      console.warn('⚠️ Some scene IDs do not belong to this project. Filtered them out.');
    }

    // Update scene_order in database
    await db
      .update(projects)
      .set({
        scene_order: validSceneIds,
        updated_at: new Date(),
      })
      .where(eq(projects.id, projectId));

    console.log('✅ Scene order updated successfully');

    // Revalidate the timeline page
    revalidatePath(`/projects/${projectId}/studio/timeline`, 'page');

    return { success: true };
  } catch (error) {
    console.error('❌ Error updating scene order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update scene order',
    };
  }
}
