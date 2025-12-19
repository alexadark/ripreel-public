'use server';

import { db } from '@/lib/drizzle/db';
import {
  projectCharacters,
  projectLocations,
  projectProps,
  projects,
} from '@/lib/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

// ============================================================================
// Types
// ============================================================================

export type BibleActionResult =
  | { success: true; data?: unknown }
  | { success: false; error: string };

export type BibleApprovalStatus = {
  characters: { total: number; approved: number };
  locations: { total: number; approved: number };
  props: { total: number; approved: number };
  allApproved: boolean;
};

// ============================================================================
// Character Actions
// ============================================================================

/**
 * Generate a character portrait image
 * Triggers n8n workflow to create portrait based on visual_dna
 */
export async function generateCharacterPortrait(
  characterId: string
): Promise<BibleActionResult> {
  try {
    console.log('🎨 Generating character portrait:', characterId);

    const [character] = await db
      .select()
      .from(projectCharacters)
      .where(eq(projectCharacters.id, characterId))
      .limit(1);

    if (!character) {
      return { success: false, error: 'Character not found' };
    }

    // Update status to generating
    await db
      .update(projectCharacters)
      .set({
        image_status: 'generating',
        updated_at: new Date(),
      })
      .where(eq(projectCharacters.id, characterId));

    // TODO: Trigger n8n workflow for character portrait generation
    // For now, we just mark as generating and the webhook will update when complete
    // The workflow should receive:
    // - character_id
    // - visual_dna (detailed description)
    // - project visual_style
    // - callback_url for webhook

    console.log('✅ Character portrait generation started');
    revalidatePath(`/projects/${character.project_id}/studio/bible`, 'page');

    return { success: true };
  } catch (error) {
    console.error('❌ Error generating character portrait:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to generate portrait',
    };
  }
}

/**
 * Approve a character portrait
 * Marks the character as approved with its image URL
 */
export async function approveCharacterPortrait(
  characterId: string,
  imageUrl?: string
): Promise<BibleActionResult> {
  try {
    console.log('✅ Approving character portrait:', characterId);

    const [character] = await db
      .select()
      .from(projectCharacters)
      .where(eq(projectCharacters.id, characterId))
      .limit(1);

    if (!character) {
      return { success: false, error: 'Character not found' };
    }

    // Update to approved
    await db
      .update(projectCharacters)
      .set({
        image_status: 'approved',
        approved_image_url: imageUrl || character.approved_image_url,
        approved_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(projectCharacters.id, characterId));

    // Check if all Bible assets are now approved
    await checkAndUpdateProjectStatus(character.project_id);

    console.log('✅ Character portrait approved');
    revalidatePath(`/projects/${character.project_id}/studio/bible`, 'page');

    return { success: true };
  } catch (error) {
    console.error('❌ Error approving character portrait:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to approve portrait',
    };
  }
}

/**
 * Update character fields
 */
export async function updateCharacter(
  characterId: string,
  updates: {
    name?: string;
    role?: 'lead' | 'supporting' | 'background';
    visual_dna?: string;
    backstory?: string;
  }
): Promise<BibleActionResult> {
  try {
    const [character] = await db
      .select()
      .from(projectCharacters)
      .where(eq(projectCharacters.id, characterId))
      .limit(1);

    if (!character) {
      return { success: false, error: 'Character not found' };
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.visual_dna !== undefined)
      updateData.visual_dna = updates.visual_dna;
    if (updates.backstory !== undefined)
      updateData.backstory = updates.backstory;

    await db
      .update(projectCharacters)
      .set(updateData)
      .where(eq(projectCharacters.id, characterId));

    revalidatePath(`/projects/${character.project_id}/studio/bible`, 'page');
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating character:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update character',
    };
  }
}

/**
 * Update character visual DNA description (kept for backward compatibility)
 */
export async function updateCharacterVisualDna(
  characterId: string,
  visualDna: string
): Promise<BibleActionResult> {
  return updateCharacter(characterId, { visual_dna: visualDna });
}

// ============================================================================
// Location Actions
// ============================================================================

/**
 * Generate a location reference image
 */
export async function generateLocationImage(
  locationId: string,
  timeVariant?: 'day' | 'night' | 'dawn' | 'dusk'
): Promise<BibleActionResult> {
  try {
    console.log('🎨 Generating location image:', locationId, timeVariant);

    const [location] = await db
      .select()
      .from(projectLocations)
      .where(eq(projectLocations.id, locationId))
      .limit(1);

    if (!location) {
      return { success: false, error: 'Location not found' };
    }

    // Update status to generating
    await db
      .update(projectLocations)
      .set({
        image_status: 'generating',
        updated_at: new Date(),
      })
      .where(eq(projectLocations.id, locationId));

    // TODO: Trigger n8n workflow for location image generation
    // The workflow should receive:
    // - location_id
    // - visual_description
    // - time_variant (optional)
    // - project visual_style
    // - callback_url

    console.log('✅ Location image generation started');
    revalidatePath(`/projects/${location.project_id}/studio/bible`, 'page');

    return { success: true };
  } catch (error) {
    console.error('❌ Error generating location image:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to generate location image',
    };
  }
}

/**
 * Approve a location image
 */
export async function approveLocationImage(
  locationId: string,
  imageUrl?: string
): Promise<BibleActionResult> {
  try {
    console.log('✅ Approving location image:', locationId);

    const [location] = await db
      .select()
      .from(projectLocations)
      .where(eq(projectLocations.id, locationId))
      .limit(1);

    if (!location) {
      return { success: false, error: 'Location not found' };
    }

    await db
      .update(projectLocations)
      .set({
        image_status: 'approved',
        approved_image_url: imageUrl || location.approved_image_url,
        approved_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(projectLocations.id, locationId));

    await checkAndUpdateProjectStatus(location.project_id);

    console.log('✅ Location image approved');
    revalidatePath(`/projects/${location.project_id}/studio/bible`, 'page');

    return { success: true };
  } catch (error) {
    console.error('❌ Error approving location image:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to approve location image',
    };
  }
}

/**
 * Update location fields
 */
export async function updateLocation(
  locationId: string,
  updates: {
    name?: string;
    type?: 'interior' | 'exterior';
    visual_description?: string;
    time_variants?: {
      day?: string;
      night?: string;
      dawn?: string;
      dusk?: string;
    } | null;
  }
): Promise<BibleActionResult> {
  try {
    const [location] = await db
      .select()
      .from(projectLocations)
      .where(eq(projectLocations.id, locationId))
      .limit(1);

    if (!location) {
      return { success: false, error: 'Location not found' };
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.visual_description !== undefined)
      updateData.visual_description = updates.visual_description;
    if (updates.time_variants !== undefined)
      updateData.time_variants = updates.time_variants;

    await db
      .update(projectLocations)
      .set(updateData)
      .where(eq(projectLocations.id, locationId));

    revalidatePath(`/projects/${location.project_id}/studio/bible`, 'page');
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating location:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update location',
    };
  }
}

/**
 * Update location visual description (kept for backward compatibility)
 */
export async function updateLocationDescription(
  locationId: string,
  visualDescription: string
): Promise<BibleActionResult> {
  return updateLocation(locationId, { visual_description: visualDescription });
}

// ============================================================================
// Prop Actions
// ============================================================================

/**
 * Generate a prop reference image (optional, mainly for high importance props)
 */
export async function generatePropImage(
  propId: string
): Promise<BibleActionResult> {
  try {
    console.log('🎨 Generating prop image:', propId);

    const [prop] = await db
      .select()
      .from(projectProps)
      .where(eq(projectProps.id, propId))
      .limit(1);

    if (!prop) {
      return { success: false, error: 'Prop not found' };
    }

    await db
      .update(projectProps)
      .set({
        image_status: 'generating',
        updated_at: new Date(),
      })
      .where(eq(projectProps.id, propId));

    // TODO: Trigger n8n workflow for prop image generation

    console.log('✅ Prop image generation started');
    revalidatePath(`/projects/${prop.project_id}/studio/bible`, 'page');

    return { success: true };
  } catch (error) {
    console.error('❌ Error generating prop image:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to generate prop image',
    };
  }
}

/**
 * Update prop fields
 */
export async function updateProp(
  propId: string,
  updates: {
    name?: string;
    importance?: 'high' | 'medium' | 'low';
    visual_description?: string;
  }
): Promise<BibleActionResult> {
  try {
    const [prop] = await db
      .select()
      .from(projectProps)
      .where(eq(projectProps.id, propId))
      .limit(1);

    if (!prop) {
      return { success: false, error: 'Prop not found' };
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.importance !== undefined)
      updateData.importance = updates.importance;
    if (updates.visual_description !== undefined)
      updateData.visual_description = updates.visual_description;

    await db
      .update(projectProps)
      .set(updateData)
      .where(eq(projectProps.id, propId));

    revalidatePath(`/projects/${prop.project_id}/studio/bible`, 'page');
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating prop:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update prop',
    };
  }
}

/**
 * Approve a prop (with or without image)
 */
export async function approveProp(
  propId: string,
  imageUrl?: string
): Promise<BibleActionResult> {
  try {
    console.log('✅ Approving prop:', propId);

    const [prop] = await db
      .select()
      .from(projectProps)
      .where(eq(projectProps.id, propId))
      .limit(1);

    if (!prop) {
      return { success: false, error: 'Prop not found' };
    }

    await db
      .update(projectProps)
      .set({
        image_status: 'approved',
        approved_image_url: imageUrl || prop.approved_image_url,
        approved_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(projectProps.id, propId));

    await checkAndUpdateProjectStatus(prop.project_id);

    console.log('✅ Prop approved');
    revalidatePath(`/projects/${prop.project_id}/studio/bible`, 'page');

    return { success: true };
  } catch (error) {
    console.error('❌ Error approving prop:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve prop',
    };
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Approve all Bible assets for a project
 * Only approves items that have images ready
 */
export async function approveAllBibleAssets(
  projectId: string
): Promise<BibleActionResult> {
  try {
    console.log('✅ Approving all Bible assets for project:', projectId);
    const now = new Date();

    // Approve all characters with ready images
    await db
      .update(projectCharacters)
      .set({
        image_status: 'approved',
        approved_at: now,
        updated_at: now,
      })
      .where(
        and(
          eq(projectCharacters.project_id, projectId),
          eq(projectCharacters.image_status, 'ready')
        )
      );

    // Approve all locations with ready images
    await db
      .update(projectLocations)
      .set({
        image_status: 'approved',
        approved_at: now,
        updated_at: now,
      })
      .where(
        and(
          eq(projectLocations.project_id, projectId),
          eq(projectLocations.image_status, 'ready')
        )
      );

    // Approve all props with ready images (or pending if they don't need images)
    await db
      .update(projectProps)
      .set({
        image_status: 'approved',
        approved_at: now,
        updated_at: now,
      })
      .where(
        and(
          eq(projectProps.project_id, projectId),
          eq(projectProps.image_status, 'ready')
        )
      );

    await checkAndUpdateProjectStatus(projectId);

    console.log('✅ All Bible assets approved');
    revalidatePath(`/projects/${projectId}/studio/bible`, 'page');

    return { success: true };
  } catch (error) {
    console.error('❌ Error approving all Bible assets:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to approve all assets',
    };
  }
}

/**
 * Get Bible approval status for a project
 */
export async function getBibleApprovalStatus(
  projectId: string
): Promise<BibleApprovalStatus> {
  const characters = await db
    .select()
    .from(projectCharacters)
    .where(eq(projectCharacters.project_id, projectId));

  const locations = await db
    .select()
    .from(projectLocations)
    .where(eq(projectLocations.project_id, projectId));

  const props = await db
    .select()
    .from(projectProps)
    .where(eq(projectProps.project_id, projectId));

  const charApproved = characters.filter(
    (c) => c.image_status === 'approved'
  ).length;
  const locApproved = locations.filter(
    (l) => l.image_status === 'approved'
  ).length;
  const propApproved = props.filter(
    (p) => p.image_status === 'approved'
  ).length;

  // For MVP: Characters and locations must be approved, props are optional
  const allApproved =
    characters.length > 0 &&
    charApproved === characters.length &&
    locations.length > 0 &&
    locApproved === locations.length;

  return {
    characters: { total: characters.length, approved: charApproved },
    locations: { total: locations.length, approved: locApproved },
    props: { total: props.length, approved: propApproved },
    allApproved,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if all required Bible assets are approved and update project status
 */
async function checkAndUpdateProjectStatus(projectId: string): Promise<void> {
  const status = await getBibleApprovalStatus(projectId);

  if (status.allApproved) {
    console.log(
      '🎉 All Bible assets approved - updating project status to scene_validation'
    );
    await db
      .update(projects)
      .set({
        status: 'scene_validation',
        updated_at: new Date(),
      })
      .where(eq(projects.id, projectId));
  }
}

/**
 * Skip Bible review and go directly to scene validation
 * For projects that don't need Bible asset generation
 */
export async function skipBibleReview(
  projectId: string
): Promise<BibleActionResult> {
  try {
    console.log('⏭️ Skipping Bible review for project:', projectId);

    // Mark all Bible assets as approved without images
    const now = new Date();

    await db
      .update(projectCharacters)
      .set({ image_status: 'approved', approved_at: now, updated_at: now })
      .where(eq(projectCharacters.project_id, projectId));

    await db
      .update(projectLocations)
      .set({ image_status: 'approved', approved_at: now, updated_at: now })
      .where(eq(projectLocations.project_id, projectId));

    await db
      .update(projectProps)
      .set({ image_status: 'approved', approved_at: now, updated_at: now })
      .where(eq(projectProps.project_id, projectId));

    // Update project status
    await db
      .update(projects)
      .set({ status: 'scene_validation', updated_at: now })
      .where(eq(projects.id, projectId));

    console.log('✅ Bible review skipped');
    revalidatePath(`/projects/${projectId}/studio/bible`, 'page');
    revalidatePath(`/projects/${projectId}/studio/scenes`, 'page');

    return { success: true };
  } catch (error) {
    console.error('❌ Error skipping Bible review:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to skip Bible review',
    };
  }
}

/**
 * Update prop generation method to DESCRIBE
 * For props that should only have text descriptions, not generated images
 */
export async function updatePropToDescribe(
  propId: string
): Promise<BibleActionResult> {
  try {
    const [prop] = await db
      .select()
      .from(projectProps)
      .where(eq(projectProps.id, propId))
      .limit(1);

    if (!prop) {
      return { success: false, error: 'Prop not found' };
    }

    await db
      .update(projectProps)
      .set({
        generation_method: 'DESCRIBE',
        image_status: 'approved', // DESCRIBE props are auto-approved
        updated_at: new Date(),
      })
      .where(eq(projectProps.id, propId));

    console.log(`✅ Prop "${prop.name}" updated to DESCRIBE`);
    revalidatePath(`/projects/${prop.project_id}/studio/bible`, 'page');

    return { success: true };
  } catch (error) {
    console.error('❌ Error updating prop to DESCRIBE:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update prop',
    };
  }
}

/**
 * Batch update props to DESCRIBE by prop names
 * Use this to fix existing projects where props were not properly classified
 */
export async function batchUpdatePropsToDescribe(
  projectId: string,
  propNames: string[]
): Promise<BibleActionResult> {
  try {
    const props = await db
      .select()
      .from(projectProps)
      .where(eq(projectProps.project_id, projectId));

    let updatedCount = 0;

    for (const prop of props) {
      // Check if prop name matches any in the list (case-insensitive)
      const shouldBeDescribe = propNames.some(
        name => prop.name.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(prop.name.toLowerCase())
      );

      if (shouldBeDescribe && prop.generation_method !== 'DESCRIBE') {
        await db
          .update(projectProps)
          .set({
            generation_method: 'DESCRIBE',
            image_status: 'approved',
            updated_at: new Date(),
          })
          .where(eq(projectProps.id, prop.id));

        console.log(`✅ Prop "${prop.name}" updated to DESCRIBE`);
        updatedCount++;
      }
    }

    revalidatePath(`/projects/${projectId}/studio/bible`, 'page');

    return {
      success: true,
      data: { updatedCount, totalProps: props.length }
    };
  } catch (error) {
    console.error('❌ Error batch updating props:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update props',
    };
  }
}

/**
 * List all props for a project with their generation_method
 */
export async function listProjectProps(
  projectId: string
): Promise<BibleActionResult> {
  try {
    const props = await db
      .select({
        id: projectProps.id,
        name: projectProps.name,
        generation_method: projectProps.generation_method,
        image_status: projectProps.image_status,
        visual_description: projectProps.visual_description,
      })
      .from(projectProps)
      .where(eq(projectProps.project_id, projectId));

    return {
      success: true,
      data: props
    };
  } catch (error) {
    console.error('❌ Error listing props:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to list props',
    };
  }
}
