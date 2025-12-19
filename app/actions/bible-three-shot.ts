'use server';

import { db } from '@/lib/drizzle/db';
import {
  projectCharacters,
  projectLocations,
  projectProps,
  projects,
  bibleImageVariants,
  type NewBibleImageVariant,
} from '@/lib/drizzle/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { generateBibleImage } from '@/lib/n8n/mcp-client';
import type { ApiKeys } from '@/lib/n8n/types';
import { mapModelToN8NName, getDefaultAspectRatio } from '@/lib/bible/models';
import type { AIModel, ShotType } from '@/lib/bible/models';
import {
  uploadBibleFile,
  deleteBibleFile,
  getCharacterShotPath,
  getLocationImagePath,
  getPropImagePath,
  BIBLE_STORAGE_BUCKETS,
} from '@/lib/supabase/storage-bible';

// ============================================================================
// Helper: Get quality setting based on model
// ============================================================================

/**
 * Get quality setting based on model type
 * - Seedream: 'basic' (faster, good for web)
 * - Nano Banana: 'low' (n8n maps to '1K')
 * - Others: 'medium'
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

// ============================================================================
// Helper: Download temp URL and upload to Supabase
// ============================================================================

/**
 * Helper to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * FAST version: Download from temporary CDN URL and upload to Supabase.
 * No delays, no retries - for use in server actions where speed matters.
 * If this fails, the webhook will handle it as a backup.
 */
async function downloadAndUploadToSupabaseFast(
  tempImageUrl: string,
  assetType: 'character' | 'location' | 'prop',
  assetId: string,
  shotType?: string,
  variantId?: string
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

    // Validate we got actual image data
    if (imageBuffer.length < 1000) {
      console.error(`❌ [FAST] Data too small (${imageBuffer.length} bytes) - will rely on webhook`);
      return null;
    }

    // Generate filename
    const timestamp = Date.now();
    const filename = variantId
      ? `${variantId}_${timestamp}.png`
      : shotType
      ? `${assetId}_${shotType}_${timestamp}.png`
      : `${assetId}_${timestamp}.png`;

    // Get storage path and bucket based on asset type
    let storagePath: string;
    let bucket: string;

    if (assetType === 'character') {
      storagePath = getCharacterShotPath(assetId, (shotType || 'portrait') as 'portrait' | 'three_quarter' | 'full_body', filename);
      bucket = BIBLE_STORAGE_BUCKETS.characters;
    } else if (assetType === 'location') {
      storagePath = getLocationImagePath(assetId, filename);
      bucket = BIBLE_STORAGE_BUCKETS.locations;
    } else {
      storagePath = getPropImagePath(assetId, filename);
      bucket = BIBLE_STORAGE_BUCKETS.props;
    }

    // Upload to Supabase
    console.log(`⬆️ [FAST] Uploading to Supabase: ${storagePath}`);
    const result = await uploadBibleFile(bucket, storagePath, imageBuffer, 'image/png');

    console.log(`✅ [FAST] Permanently stored at: ${result.url.substring(0, 60)}...`);
    return result;
  } catch (error) {
    console.error(`❌ [FAST] Error (will rely on webhook):`, error);
    return null;
  }
}

/**
 * SLOW version with retries: For webhook use where we have more time.
 * Includes retry mechanism with exponential backoff to handle CDN timing issues.
 */
async function downloadAndUploadToSupabase(
  tempImageUrl: string,
  assetType: 'character' | 'location' | 'prop',
  assetId: string,
  shotType?: string,
  variantId?: string
): Promise<{ url: string; path: string } | null> {
  const MAX_RETRIES = 3;
  const INITIAL_DELAY_MS = 2000;

  // Wait initial delay to give CDN time to process the image
  console.log(`⏳ Waiting ${INITIAL_DELAY_MS}ms for CDN to process image...`);
  await delay(INITIAL_DELAY_MS);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`⬇️ [Attempt ${attempt}/${MAX_RETRIES}] Downloading from temp URL: ${tempImageUrl.substring(0, 50)}...`);

      const response = await fetch(tempImageUrl);

      if (!response.ok) {
        console.error(`❌ [Attempt ${attempt}] Failed to download: ${response.status} ${response.statusText}`);

        if (response.status === 500 && attempt < MAX_RETRIES) {
          const backoffDelay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`⏳ Retrying in ${backoffDelay}ms (exponential backoff)...`);
          await delay(backoffDelay);
          continue;
        }
        return null;
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      console.log(`📦 Downloaded ${imageBuffer.length} bytes`);

      if (imageBuffer.length < 1000) {
        console.error(`❌ [Attempt ${attempt}] Downloaded data too small (${imageBuffer.length} bytes)`);
        if (attempt < MAX_RETRIES) {
          const backoffDelay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`⏳ Retrying in ${backoffDelay}ms...`);
          await delay(backoffDelay);
          continue;
        }
        return null;
      }

      const timestamp = Date.now();
      const filename = variantId
        ? `${variantId}_${timestamp}.png`
        : shotType
        ? `${assetId}_${shotType}_${timestamp}.png`
        : `${assetId}_${timestamp}.png`;

      let storagePath: string;
      let bucket: string;

      if (assetType === 'character') {
        storagePath = getCharacterShotPath(assetId, (shotType || 'portrait') as 'portrait' | 'three_quarter' | 'full_body', filename);
        bucket = BIBLE_STORAGE_BUCKETS.characters;
      } else if (assetType === 'location') {
        storagePath = getLocationImagePath(assetId, filename);
        bucket = BIBLE_STORAGE_BUCKETS.locations;
      } else {
        storagePath = getPropImagePath(assetId, filename);
        bucket = BIBLE_STORAGE_BUCKETS.props;
      }

      console.log(`⬆️ Uploading to Supabase: ${storagePath}`);
      const result = await uploadBibleFile(bucket, storagePath, imageBuffer, 'image/png');

      console.log(`✅ Permanently stored at: ${result.url.substring(0, 60)}...`);
      return result;
    } catch (error) {
      console.error(`❌ [Attempt ${attempt}] Error:`, error);

      if (attempt < MAX_RETRIES) {
        const backoffDelay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying in ${backoffDelay}ms due to error...`);
        await delay(backoffDelay);
        continue;
      }

      console.error(`❌ Failed to upload to Supabase after ${MAX_RETRIES} attempts:`, error);
      return null;
    }
  }

  return null;
}

// ============================================================================
// Types
// ============================================================================

export type BibleActionResult =
  | { success: true; data?: unknown }
  | { success: false; error: string };

// ============================================================================
// Character Three-Shot Actions
// ============================================================================

/**
 * Generate a specific character shot (portrait, three_quarter, or full_body)
 *
 * @param characterId - Character to generate shot for
 * @param shotType - Type of shot to generate
 * @param model - AI model to use
 * @param apiKeys - Optional user-provided API keys from localStorage
 */
export async function generateCharacterShot(
  characterId: string,
  shotType: ShotType,
  model: AIModel,
  apiKeys?: ApiKeys
): Promise<BibleActionResult> {
  try {
    console.log(`🎨 Generating ${shotType} for character:`, characterId);

    const [character] = await db
      .select()
      .from(projectCharacters)
      .where(eq(projectCharacters.id, characterId))
      .limit(1);

    if (!character) {
      return { success: false, error: 'Character not found' };
    }

    // Get the appropriate prompt for this shot type
    const promptField = `${shotType}_prompt` as keyof typeof character;
    const shotPrompt = character[promptField] as string;

    console.log('📋 Debug info:', {
      characterName: character.name,
      shotType,
      promptField,
      shotPrompt: shotPrompt || 'MISSING',
      visual_dna: character.visual_dna ? 'EXISTS' : 'MISSING',
    });

    if (!shotPrompt) {
      return {
        success: false,
        error: `No ${shotType} prompt found for this character`,
      };
    }

    // Combine visual_dna with shot-specific prompt
    const fullPrompt = `${character.visual_dna}, ${shotPrompt}`;

    console.log('🎨 Full prompt to send:', fullPrompt.substring(0, 100) + '...');

    // Update status to generating
    const statusField = `${shotType}_status` as const;
    await db
      .update(projectCharacters)
      .set({
        [statusField]: 'generating',
        selected_model: model,
        updated_at: new Date(),
      })
      .where(eq(projectCharacters.id, characterId));

    // Invoke n8n workflow with combined prompt
    const mappedModel = mapModelToN8NName(model);
    console.log('🚀 Calling n8n workflow with:', {
      asset_type: 'character',
      asset_id: characterId,
      model: mappedModel,
      aspect_ratio: getDefaultAspectRatio(shotType),
      quality: getQualityForModel(mappedModel),
      shot_type: shotType,
      promptLength: fullPrompt.length,
    });

    const result = await generateBibleImage({
      asset_type: 'character',
      asset_id: characterId,
      prompt: fullPrompt,
      model: mappedModel,
      aspect_ratio: getDefaultAspectRatio(shotType),
      quality: getQualityForModel(mappedModel),
      shot_type: shotType,
    }, apiKeys);

    console.log('📥 n8n response:', result);

    if (!result.success) {
      // Update status to failed
      await db
        .update(projectCharacters)
        .set({
          [statusField]: 'failed',
          updated_at: new Date(),
        })
        .where(eq(projectCharacters.id, characterId));

      return { success: false, error: result.error || 'Generation failed' };
    }

    // Store task ID
    const jobIdField = `${shotType}_n8n_job_id` as const;
    await db
      .update(projectCharacters)
      .set({
        [jobIdField]: result.data?.taskId,
        updated_at: new Date(),
      })
      .where(eq(projectCharacters.id, characterId));

    console.log(`✅ ${shotType} generation started`, result.data);
    revalidatePath(`/projects/${character.project_id}/studio/bible`, 'page');

    return { success: true, data: result.data };
  } catch (error) {
    console.error(`❌ Error generating ${shotType}:`, error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : `Failed to generate ${shotType}`,
    };
  }
}

/**
 * Upload a file for a specific character shot
 */
export async function uploadCharacterShot(
  characterId: string,
  shotType: ShotType,
  fileData: {
    buffer: Buffer;
    filename: string;
    contentType: string;
  }
): Promise<BibleActionResult> {
  try {
    console.log(`📤 Uploading ${shotType} for character:`, characterId);

    const [character] = await db
      .select()
      .from(projectCharacters)
      .where(eq(projectCharacters.id, characterId))
      .limit(1);

    if (!character) {
      return { success: false, error: 'Character not found' };
    }

    // Generate storage path
    const storagePath = getCharacterShotPath(
      characterId,
      shotType,
      fileData.filename
    );

    // Upload to Supabase
    const { url, path } = await uploadBibleFile(
      BIBLE_STORAGE_BUCKETS.characters,
      storagePath,
      fileData.buffer,
      fileData.contentType
    );

    // Update database
    const imageUrlField = `${shotType}_image_url` as const;
    const storagePathField = `${shotType}_storage_path` as const;
    const statusField = `${shotType}_status` as const;

    await db
      .update(projectCharacters)
      .set({
        [imageUrlField]: url,
        [storagePathField]: path,
        [statusField]: 'ready',
        upload_source: {
          ...character.upload_source,
          [shotType]: true,
        },
        updated_at: new Date(),
      })
      .where(eq(projectCharacters.id, characterId));

    console.log(`✅ ${shotType} uploaded successfully`);
    revalidatePath(`/projects/${character.project_id}/studio/bible`, 'page');

    return { success: true, data: { imageUrl: url } };
  } catch (error) {
    console.error(`❌ Error uploading ${shotType}:`, error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : `Failed to upload ${shotType}`,
    };
  }
}

/**
 * Refine an existing character shot using image-to-image
 * Creates a NEW VARIANT instead of replacing the existing image
 *
 * @param characterId - Character to refine shot for
 * @param shotType - Type of shot to refine
 * @param model - AI model to use for refinement
 * @param refinementPrompt - Optional prompt describing refinements
 * @param apiKeys - Optional user-provided API keys from localStorage
 */
export async function refineCharacterShot(
  characterId: string,
  shotType: ShotType,
  model: AIModel,
  refinementPrompt?: string,
  apiKeys?: ApiKeys
): Promise<BibleActionResult> {
  try {
    console.log(`🔄 Refining ${shotType} for character:`, characterId);

    const [character] = await db
      .select()
      .from(projectCharacters)
      .where(eq(projectCharacters.id, characterId))
      .limit(1);

    if (!character) {
      return { success: false, error: 'Character not found' };
    }

    // Get existing image URL for I2I source
    const imageUrlField = `${shotType}_image_url` as keyof typeof character;
    const sourceImageUrl = character[imageUrlField] as string;

    if (!sourceImageUrl) {
      return {
        success: false,
        error: `No existing image for ${shotType}. Upload or generate first.`,
      };
    }

    // Get shot-specific prompt (for reference/storage)
    const promptField = `${shotType}_prompt` as keyof typeof character;
    const shotPrompt = character[promptField] as string;

    // For I2I refinement, we send ONLY the refinement instructions
    // The source image already contains all visual context
    // If no refinement prompt provided, use a generic "enhance" instruction
    const promptToSend = refinementPrompt || 'enhance image quality and details';

    // Store original context for reference
    const originalContext = `${character.visual_dna}, ${shotPrompt}`;

    // Convert T2I model to I2I model
    const i2iModel = model.replace('text-to-image', 'image-to-image') as AIModel;

    // Create a new variant record for the refined image
    const [variant] = await db
      .insert(bibleImageVariants)
      .values({
        asset_type: 'character',
        asset_id: characterId,
        shot_type: shotType,
        image_url: '',
        storage_path: '',
        model: i2iModel,
        prompt: promptToSend, // Store the refinement instructions sent to n8n
        status: 'generating',
        is_selected: false,
        generation_order: 0, // Will be updated based on existing variants
      })
      .returning();

    console.log(`📸 Created refinement variant: ${variant.id}`);
    console.log(`📝 Original context: ${originalContext.substring(0, 100)}...`);
    console.log(`📝 Refinement prompt being sent: "${promptToSend}"`);

    // Invoke n8n workflow with source image for I2I
    const mappedModel = mapModelToN8NName(i2iModel);
    console.log(`🚀 Invoking I2I workflow with source image: ${sourceImageUrl.substring(0, 50)}...`);

    const result = await generateBibleImage({
      asset_type: 'character',
      asset_id: characterId,
      prompt: promptToSend, // For I2I, send ONLY the refinement instructions
      model: mappedModel,
      aspect_ratio: getDefaultAspectRatio(shotType),
      quality: getQualityForModel(mappedModel),
      shot_type: shotType,
      variant_id: variant.id,
      source_image_url: sourceImageUrl, // KEY: Pass source image for I2I
    }, apiKeys);

    if (!result.success) {
      // Update variant status to failed
      await db
        .update(bibleImageVariants)
        .set({
          status: 'failed',
          error_message: result.error || 'Refinement failed',
          updated_at: new Date(),
        })
        .where(eq(bibleImageVariants.id, variant.id));

      return { success: false, error: result.error || 'Refinement failed' };
    }

    // Store task ID and try fast upload if we got immediate response
    const responseData = Array.isArray(result.data) ? result.data[0] : result.data;

    if (responseData?.taskId) {
      await db
        .update(bibleImageVariants)
        .set({ n8n_job_id: responseData.taskId })
        .where(eq(bibleImageVariants.id, variant.id));
    }

    // If we got imageUrl directly, upload to Supabase (FAST mode)
    if (responseData?.imageUrl) {
      console.log(`📸 Got temp URL, uploading to Supabase (FAST mode)...`);

      const uploaded = await downloadAndUploadToSupabaseFast(
        responseData.imageUrl,
        'character',
        characterId,
        shotType,
        variant.id
      );

      if (uploaded) {
        await db
          .update(bibleImageVariants)
          .set({
            image_url: uploaded.url,
            storage_path: uploaded.path,
            status: 'ready',
            n8n_job_id: responseData.taskId,
            updated_at: new Date(),
          })
          .where(eq(bibleImageVariants.id, variant.id));
        console.log(`✅ Refinement variant saved with permanent Supabase URL`);
      }
    }

    console.log(`✅ ${shotType} refinement started as variant ${variant.id}`);
    revalidatePath(`/projects/${character.project_id}/studio/bible`, 'page');

    return { success: true, data: { variantId: variant.id, ...responseData } };
  } catch (error) {
    console.error(`❌ Error refining ${shotType}:`, error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : `Failed to refine ${shotType}`,
    };
  }
}

/**
 * Approve a specific character shot
 */
export async function approveCharacterShot(
  characterId: string,
  shotType: ShotType
): Promise<BibleActionResult> {
  try {
    console.log(`✅ Approving ${shotType} for character:`, characterId);

    const [character] = await db
      .select()
      .from(projectCharacters)
      .where(eq(projectCharacters.id, characterId))
      .limit(1);

    if (!character) {
      return { success: false, error: 'Character not found' };
    }

    // Update status to approved
    const statusField = `${shotType}_status` as const;
    await db
      .update(projectCharacters)
      .set({
        [statusField]: 'approved',
        updated_at: new Date(),
      })
      .where(eq(projectCharacters.id, characterId));

    // NOTE: Auto-propagation removed - user now chooses model via dialog in UI
    // The UI (shot-card.tsx) will show a dialog and call generateMultipleVariantsFromReference
    // with the user's chosen model when portrait is approved

    // Check if all shots are approved
    const { complete } = await checkCharacterComplete(characterId);

    // If all three shots approved, update legacy approved_at and check project status
    if (complete) {
      await db
        .update(projectCharacters)
        .set({
          approved_at: new Date(),
          image_status: 'approved', // Update legacy field
        })
        .where(eq(projectCharacters.id, characterId));

      // Check if all Bible assets are approved
      await checkAndUpdateProjectStatus(character.project_id);
    }

    console.log(`✅ ${shotType} approved`);
    revalidatePath(`/projects/${character.project_id}/studio/bible`, 'page');

    return { success: true };
  } catch (error) {
    console.error(`❌ Error approving ${shotType}:`, error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : `Failed to approve ${shotType}`,
    };
  }
}

/**
 * Unapprove a character shot (revert to ready status)
 *
 * Allows user to change their selection after approval
 */
export async function unapproveCharacterShot(
  characterId: string,
  shotType: ShotType
): Promise<BibleActionResult> {
  try {
    console.log(`↩️ Unapproving ${shotType} for character:`, characterId);

    const [character] = await db
      .select()
      .from(projectCharacters)
      .where(eq(projectCharacters.id, characterId))
      .limit(1);

    if (!character) {
      return { success: false, error: 'Character not found' };
    }

    // Update status back to ready
    const statusField = `${shotType}_status` as const;
    await db
      .update(projectCharacters)
      .set({
        [statusField]: 'ready',
        approved_at: null, // Clear overall approval
        image_status: 'ready', // Reset legacy field
        updated_at: new Date(),
      })
      .where(eq(projectCharacters.id, characterId));

    console.log(`↩️ ${shotType} unapproved - status set to ready`);
    revalidatePath(`/projects/${character.project_id}/studio/bible`, 'page');

    return { success: true };
  } catch (error) {
    console.error(`❌ Error unapproving ${shotType}:`, error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : `Failed to unapprove ${shotType}`,
    };
  }
}

/**
 * Reset variants stuck in "generating" status to "failed"
 *
 * This fixes existing projects where variants got stuck due to timeouts
 * or other issues. Variants older than the threshold are reset to allow retry.
 */
export async function resetStuckVariants(
  assetType: 'character' | 'location' | 'prop',
  assetId: string,
  shotType?: ShotType,
  /** Max age in minutes before a generating variant is considered stuck (default: 5) */
  maxAgeMinutes: number = 5
): Promise<BibleActionResult> {
  try {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    console.log(`🔧 Resetting stuck variants for ${assetType}:${assetId} older than ${cutoffTime.toISOString()}`);

    // Find variants stuck in "generating" status
    const generatingVariants = await db
      .select()
      .from(bibleImageVariants)
      .where(
        and(
          eq(bibleImageVariants.asset_type, assetType),
          eq(bibleImageVariants.asset_id, assetId),
          eq(bibleImageVariants.status, 'generating'),
          ...(shotType ? [eq(bibleImageVariants.shot_type, shotType)] : [])
        )
      );

    // Filter by age (created_at older than cutoff)
    const variantsToReset = generatingVariants.filter(v => v.created_at < cutoffTime);

    if (variantsToReset.length === 0) {
      console.log('✅ No stuck variants found');
      return { success: true, data: { resetCount: 0 } };
    }

    // Reset stuck variants to failed
    for (const variant of variantsToReset) {
      await db
        .update(bibleImageVariants)
        .set({
          status: 'failed',
          error_message: 'Generation timed out - automatically reset',
          updated_at: new Date(),
        })
        .where(eq(bibleImageVariants.id, variant.id));
    }

    console.log(`🔧 Reset ${variantsToReset.length} stuck variant(s)`);

    // Get project_id to revalidate
    let projectId: string | undefined;
    if (assetType === 'character') {
      const [character] = await db
        .select({ project_id: projectCharacters.project_id })
        .from(projectCharacters)
        .where(eq(projectCharacters.id, assetId))
        .limit(1);
      projectId = character?.project_id;
    } else if (assetType === 'location') {
      const [location] = await db
        .select({ project_id: projectLocations.project_id })
        .from(projectLocations)
        .where(eq(projectLocations.id, assetId))
        .limit(1);
      projectId = location?.project_id;
    } else if (assetType === 'prop') {
      const [prop] = await db
        .select({ project_id: projectProps.project_id })
        .from(projectProps)
        .where(eq(projectProps.id, assetId))
        .limit(1);
      projectId = prop?.project_id;
    }

    if (projectId) {
      revalidatePath(`/projects/${projectId}/studio/bible`, 'page');
    }

    return { success: true, data: { resetCount: variantsToReset.length } };
  } catch (error) {
    console.error('❌ Error resetting stuck variants:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset stuck variants',
    };
  }
}

/**
 * Check if all three character shots are approved
 */
export async function checkCharacterComplete(
  characterId: string
): Promise<{ complete: boolean; approved_shots: number }> {
  const [character] = await db
    .select()
    .from(projectCharacters)
    .where(eq(projectCharacters.id, characterId))
    .limit(1);

  if (!character) {
    return { complete: false, approved_shots: 0 };
  }

  // MVP Simplification: Portrait only (no three_quarter or full_body)
  const isApproved = character.portrait_status === 'approved';

  return {
    complete: isApproved,
    approved_shots: isApproved ? 1 : 0,
  };
}

/**
 * Update the prompt for a specific character shot
 */
export async function updateCharacterPrompt(
  characterId: string,
  shotType: ShotType,
  newPrompt: string
): Promise<BibleActionResult> {
  try {
    console.log(`📝 Updating ${shotType} prompt for character:`, characterId);

    const [character] = await db
      .select()
      .from(projectCharacters)
      .where(eq(projectCharacters.id, characterId))
      .limit(1);

    if (!character) {
      return { success: false, error: 'Character not found' };
    }

    // Update the appropriate prompt field
    const promptField = `${shotType}_prompt` as const;
    await db
      .update(projectCharacters)
      .set({
        [promptField]: newPrompt,
        updated_at: new Date(),
      })
      .where(eq(projectCharacters.id, characterId));

    console.log(`✅ ${shotType} prompt updated`);
    revalidatePath(`/projects/${character.project_id}/studio/bible`, 'page');

    return { success: true };
  } catch (error) {
    console.error(`❌ Error updating ${shotType} prompt:`, error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : `Failed to update ${shotType} prompt`,
    };
  }
}

// ============================================================================
// Location Actions (with upload support)
// ============================================================================

/**
 * Generate location image
 *
 * @param locationId - Location to generate image for
 * @param model - AI model to use
 * @param apiKeys - Optional user-provided API keys from localStorage
 */
export async function generateLocationImageWithModel(
  locationId: string,
  model: AIModel,
  apiKeys?: ApiKeys
): Promise<BibleActionResult> {
  try {
    console.log('🎨 Generating location image:', locationId);

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
        selected_model: model,
        updated_at: new Date(),
      })
      .where(eq(projectLocations.id, locationId));

    // Invoke n8n workflow
    const mappedModel = mapModelToN8NName(model);
    const result = await generateBibleImage({
      asset_type: 'location',
      asset_id: locationId,
      prompt: location.visual_description,
      model: mappedModel,
      aspect_ratio: '16:9',
      quality: getQualityForModel(mappedModel),
    }, apiKeys);

    if (!result.success) {
      await db
        .update(projectLocations)
        .set({
          image_status: 'failed',
          updated_at: new Date(),
        })
        .where(eq(projectLocations.id, locationId));

      return { success: false, error: result.error || 'Generation failed' };
    }

    await db
      .update(projectLocations)
      .set({
        n8n_job_id: result.data?.taskId,
        updated_at: new Date(),
      })
      .where(eq(projectLocations.id, locationId));

    console.log('✅ Location image generation started');
    revalidatePath(`/projects/${location.project_id}/studio/bible`, 'page');

    return { success: true, data: result.data };
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
 * Upload location image
 */
export async function uploadLocationImage(
  locationId: string,
  fileData: {
    buffer: Buffer;
    filename: string;
    contentType: string;
  }
): Promise<BibleActionResult> {
  try {
    console.log('📤 Uploading location image:', locationId);

    const [location] = await db
      .select()
      .from(projectLocations)
      .where(eq(projectLocations.id, locationId))
      .limit(1);

    if (!location) {
      return { success: false, error: 'Location not found' };
    }

    const storagePath = getLocationImagePath(locationId, fileData.filename);

    const { url, path } = await uploadBibleFile(
      BIBLE_STORAGE_BUCKETS.locations,
      storagePath,
      fileData.buffer,
      fileData.contentType
    );

    await db
      .update(projectLocations)
      .set({
        approved_image_url: url,
        approved_image_storage_path: path,
        image_status: 'ready',
        is_uploaded: { uploaded: true },
        updated_at: new Date(),
      })
      .where(eq(projectLocations.id, locationId));

    console.log('✅ Location image uploaded successfully');
    revalidatePath(`/projects/${location.project_id}/studio/bible`, 'page');

    return { success: true, data: { url } };
  } catch (error) {
    console.error('❌ Error uploading location image:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to upload location image',
    };
  }
}

/**
 * Refine location image using image-to-image
 * Creates a NEW VARIANT instead of replacing the existing image
 *
 * @param locationId - Location to refine image for
 * @param model - AI model to use for refinement
 * @param refinementPrompt - Optional prompt describing refinements
 * @param apiKeys - Optional user-provided API keys from localStorage
 */
export async function refineLocationImage(
  locationId: string,
  model: AIModel,
  refinementPrompt?: string,
  apiKeys?: ApiKeys
): Promise<BibleActionResult> {
  try {
    console.log('🔄 Refining location image:', locationId);

    const [location] = await db
      .select()
      .from(projectLocations)
      .where(eq(projectLocations.id, locationId))
      .limit(1);

    if (!location) {
      return { success: false, error: 'Location not found' };
    }

    const sourceImageUrl = location.approved_image_url;
    if (!sourceImageUrl) {
      return {
        success: false,
        error: 'No existing image. Upload or generate first.',
      };
    }

    // For I2I refinement, we send ONLY the refinement instructions
    // The source image already contains all visual context
    // If no refinement prompt provided, use a generic "enhance" instruction
    const promptToSend = refinementPrompt || 'enhance image quality and details';

    // Store original context for reference
    const originalContext = location.visual_description;

    // Convert T2I model to I2I model
    const i2iModel = model.replace('text-to-image', 'image-to-image') as AIModel;

    // Create a new variant record for the refined image
    const [variant] = await db
      .insert(bibleImageVariants)
      .values({
        asset_type: 'location',
        asset_id: locationId,
        shot_type: null,
        image_url: '',
        storage_path: '',
        model: i2iModel,
        prompt: promptToSend, // Store the refinement instructions sent to n8n
        status: 'generating',
        is_selected: false,
        generation_order: 0,
      })
      .returning();

    console.log(`📸 Created location refinement variant: ${variant.id}`);
    console.log(`📝 Original context: ${originalContext.substring(0, 100)}...`);
    console.log(`📝 Refinement prompt being sent: "${promptToSend}"`);

    const mappedModel = mapModelToN8NName(i2iModel);
    console.log(`🚀 Invoking I2I workflow with source image: ${sourceImageUrl.substring(0, 50)}...`);

    const result = await generateBibleImage({
      asset_type: 'location',
      asset_id: locationId,
      prompt: promptToSend, // For I2I, send ONLY the refinement instructions
      model: mappedModel,
      aspect_ratio: '16:9',
      quality: getQualityForModel(mappedModel),
      variant_id: variant.id,
      source_image_url: sourceImageUrl, // KEY: Pass source image for I2I
    }, apiKeys);

    if (!result.success) {
      await db
        .update(bibleImageVariants)
        .set({
          status: 'failed',
          error_message: result.error || 'Refinement failed',
          updated_at: new Date(),
        })
        .where(eq(bibleImageVariants.id, variant.id));

      return { success: false, error: result.error || 'Refinement failed' };
    }

    // Store task ID and try fast upload if we got immediate response
    const responseData = Array.isArray(result.data) ? result.data[0] : result.data;

    if (responseData?.taskId) {
      await db
        .update(bibleImageVariants)
        .set({ n8n_job_id: responseData.taskId })
        .where(eq(bibleImageVariants.id, variant.id));
    }

    if (responseData?.imageUrl) {
      console.log(`📸 Got temp URL, uploading to Supabase (FAST mode)...`);

      const uploaded = await downloadAndUploadToSupabaseFast(
        responseData.imageUrl,
        'location',
        locationId,
        undefined,
        variant.id
      );

      if (uploaded) {
        await db
          .update(bibleImageVariants)
          .set({
            image_url: uploaded.url,
            storage_path: uploaded.path,
            status: 'ready',
            n8n_job_id: responseData.taskId,
            updated_at: new Date(),
          })
          .where(eq(bibleImageVariants.id, variant.id));
        console.log(`✅ Location refinement variant saved with permanent Supabase URL`);
      }
    }

    console.log(`✅ Location image refinement started as variant ${variant.id}`);
    revalidatePath(`/projects/${location.project_id}/studio/bible`, 'page');

    return { success: true, data: { variantId: variant.id, ...responseData } };
  } catch (error) {
    console.error('❌ Error refining location image:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to refine location image',
    };
  }
}

// ============================================================================
// Prop Actions (with upload and refine support)
// ============================================================================

/**
 * Generate prop image with model selection
 *
 * @param propId - Prop to generate image for
 * @param model - AI model to use
 * @param apiKeys - Optional user-provided API keys from localStorage
 */
export async function generatePropImageWithModel(
  propId: string,
  model: AIModel,
  apiKeys?: ApiKeys
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
        selected_model: model,
        updated_at: new Date(),
      })
      .where(eq(projectProps.id, propId));

    const mappedModel = mapModelToN8NName(model);
    const result = await generateBibleImage({
      asset_type: 'prop',
      asset_id: propId,
      prompt: prop.visual_description,
      model: mappedModel,
      aspect_ratio: '1:1',
      quality: getQualityForModel(mappedModel),
    }, apiKeys);

    if (!result.success) {
      await db
        .update(projectProps)
        .set({
          image_status: 'failed',
          updated_at: new Date(),
        })
        .where(eq(projectProps.id, propId));

      return { success: false, error: result.error || 'Generation failed' };
    }

    await db
      .update(projectProps)
      .set({
        n8n_job_id: result.data?.taskId,
        updated_at: new Date(),
      })
      .where(eq(projectProps.id, propId));

    console.log('✅ Prop image generation started');
    revalidatePath(`/projects/${prop.project_id}/studio/bible`, 'page');

    return { success: true, data: result.data };
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
 * Upload prop image
 */
export async function uploadPropImage(
  propId: string,
  fileData: {
    buffer: Buffer;
    filename: string;
    contentType: string;
  }
): Promise<BibleActionResult> {
  try {
    console.log('📤 Uploading prop image:', propId);

    const [prop] = await db
      .select()
      .from(projectProps)
      .where(eq(projectProps.id, propId))
      .limit(1);

    if (!prop) {
      return { success: false, error: 'Prop not found' };
    }

    const storagePath = getPropImagePath(propId, fileData.filename);

    const { url, path } = await uploadBibleFile(
      BIBLE_STORAGE_BUCKETS.props,
      storagePath,
      fileData.buffer,
      fileData.contentType
    );

    await db
      .update(projectProps)
      .set({
        approved_image_url: url,
        approved_image_storage_path: path,
        image_status: 'ready',
        is_uploaded: { uploaded: true },
        updated_at: new Date(),
      })
      .where(eq(projectProps.id, propId));

    console.log('✅ Prop image uploaded successfully');
    revalidatePath(`/projects/${prop.project_id}/studio/bible`, 'page');

    return { success: true, data: { url } };
  } catch (error) {
    console.error('❌ Error uploading prop image:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to upload prop image',
    };
  }
}

/**
 * Refine prop image using image-to-image
 * Creates a NEW VARIANT instead of replacing the existing image
 *
 * @param propId - Prop to refine image for
 * @param model - AI model to use for refinement
 * @param refinementPrompt - Optional prompt describing refinements
 * @param apiKeys - Optional user-provided API keys from localStorage
 */
export async function refinePropImage(
  propId: string,
  model: AIModel,
  refinementPrompt?: string,
  apiKeys?: ApiKeys
): Promise<BibleActionResult> {
  try {
    console.log('🔄 Refining prop image:', propId);

    const [prop] = await db
      .select()
      .from(projectProps)
      .where(eq(projectProps.id, propId))
      .limit(1);

    if (!prop) {
      return { success: false, error: 'Prop not found' };
    }

    const sourceImageUrl = prop.approved_image_url;
    if (!sourceImageUrl) {
      return {
        success: false,
        error: 'No existing image. Upload or generate first.',
      };
    }

    // For I2I refinement, we send ONLY the refinement instructions
    // The source image already contains all visual context
    // If no refinement prompt provided, use a generic "enhance" instruction
    const promptToSend = refinementPrompt || 'enhance image quality and details';

    // Store original context for reference
    const originalContext = prop.visual_description;

    // Convert T2I model to I2I model
    const i2iModel = model.replace('text-to-image', 'image-to-image') as AIModel;

    // Create a new variant record for the refined image
    const [variant] = await db
      .insert(bibleImageVariants)
      .values({
        asset_type: 'prop',
        asset_id: propId,
        shot_type: null,
        image_url: '',
        storage_path: '',
        model: i2iModel,
        prompt: promptToSend, // Store the refinement instructions sent to n8n
        status: 'generating',
        is_selected: false,
        generation_order: 0,
      })
      .returning();

    console.log(`📸 Created prop refinement variant: ${variant.id}`);
    console.log(`📝 Original context: ${originalContext.substring(0, 100)}...`);
    console.log(`📝 Refinement prompt being sent: "${promptToSend}"`);

    const mappedModel = mapModelToN8NName(i2iModel);
    console.log(`🚀 Invoking I2I workflow with source image: ${sourceImageUrl.substring(0, 50)}...`);

    const result = await generateBibleImage({
      asset_type: 'prop',
      asset_id: propId,
      prompt: promptToSend, // For I2I, send ONLY the refinement instructions
      model: mappedModel,
      aspect_ratio: '1:1',
      quality: getQualityForModel(mappedModel),
      variant_id: variant.id,
      source_image_url: sourceImageUrl, // KEY: Pass source image for I2I
    }, apiKeys);

    if (!result.success) {
      await db
        .update(bibleImageVariants)
        .set({
          status: 'failed',
          error_message: result.error || 'Refinement failed',
          updated_at: new Date(),
        })
        .where(eq(bibleImageVariants.id, variant.id));

      return { success: false, error: result.error || 'Refinement failed' };
    }

    // Store task ID and try fast upload if we got immediate response
    const responseData = Array.isArray(result.data) ? result.data[0] : result.data;

    if (responseData?.taskId) {
      await db
        .update(bibleImageVariants)
        .set({ n8n_job_id: responseData.taskId })
        .where(eq(bibleImageVariants.id, variant.id));
    }

    if (responseData?.imageUrl) {
      console.log(`📸 Got temp URL, uploading to Supabase (FAST mode)...`);

      const uploaded = await downloadAndUploadToSupabaseFast(
        responseData.imageUrl,
        'prop',
        propId,
        undefined,
        variant.id
      );

      if (uploaded) {
        await db
          .update(bibleImageVariants)
          .set({
            image_url: uploaded.url,
            storage_path: uploaded.path,
            status: 'ready',
            n8n_job_id: responseData.taskId,
            updated_at: new Date(),
          })
          .where(eq(bibleImageVariants.id, variant.id));
        console.log(`✅ Prop refinement variant saved with permanent Supabase URL`);
      }
    }

    console.log(`✅ Prop image refinement started as variant ${variant.id}`);
    revalidatePath(`/projects/${prop.project_id}/studio/bible`, 'page');

    return { success: true, data: { variantId: variant.id, ...responseData } };
  } catch (error) {
    console.error('❌ Error refining prop image:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to refine prop image',
    };
  }
}

// ============================================================================
// Multi-Variant Generation (Generate multiple images to choose from)
// ============================================================================

/**
 * Generate multiple image variants with different AI models
 * User can then select the best one
 *
 * @param assetType - Type of asset (character, location, prop)
 * @param assetId - ID of the asset
 * @param shotType - Shot type (for characters)
 * @param selectedModels - Optional list of models to use. Defaults to both Seedream + Nano Banana
 *   - ['seedream'] = Seedream 4.5 only
 *   - ['nano-banana'] = Nano Banana Pro only
 *   - ['seedream', 'nano-banana'] or undefined = Both models (default)
 * @param apiKeys - Optional user-provided API keys from localStorage
 */
export async function generateMultipleVariants(
  assetType: 'character' | 'location' | 'prop',
  assetId: string,
  shotType?: ShotType,
  selectedModels?: ('seedream' | 'nano-banana')[],
  apiKeys?: ApiKeys
): Promise<BibleActionResult> {
  try {
    console.log(`🎨 Generating multiple variants for ${assetType}:`, assetId);

    // Map selected models to full AIModel names
    const modelMap: Record<string, AIModel> = {
      'seedream': 'seedream-4.5-text-to-image',
      'nano-banana': 'nano-banana-pro-text-to-image',
    };

    // Default to both models if not specified
    const modelsToUse = selectedModels && selectedModels.length > 0
      ? selectedModels
      : ['seedream', 'nano-banana'];

    const models: AIModel[] = modelsToUse.map(m => modelMap[m]);
    console.log(`📸 Using models: ${modelsToUse.join(', ')}`);

    // Get asset and prompt
    let prompt = '';
    let visualDna = '';
    let projectId = '';

    // MVP: Character shotType is always 'portrait' (three_quarter and full_body removed)
    if (assetType === 'character') {
      const [character] = await db
        .select()
        .from(projectCharacters)
        .where(eq(projectCharacters.id, assetId))
        .limit(1);

      if (!character) {
        return { success: false, error: 'Character not found' };
      }

      // MVP: Always use portrait_prompt
      const shotPrompt = character.portrait_prompt;
      if (!shotPrompt) {
        return {
          success: false,
          error: 'No portrait prompt found for this character',
        };
      }

      prompt = shotPrompt;
      visualDna = character.visual_dna || '';
      projectId = character.project_id;
    } else if (assetType === 'location') {
      const [location] = await db
        .select()
        .from(projectLocations)
        .where(eq(projectLocations.id, assetId))
        .limit(1);

      if (!location) {
        return { success: false, error: 'Location not found' };
      }

      prompt = location.visual_description || '';
      projectId = location.project_id;
    } else if (assetType === 'prop') {
      const [prop] = await db
        .select()
        .from(projectProps)
        .where(eq(projectProps.id, assetId))
        .limit(1);

      if (!prop) {
        return { success: false, error: 'Prop not found' };
      }

      prompt = prop.visual_description || '';
      projectId = prop.project_id;
    }

    const fullPrompt = visualDna ? `${visualDna}, ${prompt}` : prompt;

    // Step 1: Create ALL variant records first
    console.log(`📸 Creating ${models.length} variant records...`);
    const createdVariants = await Promise.all(
      models.map(async (model, i) => {
        const [variant] = await db
          .insert(bibleImageVariants)
          .values({
            asset_type: assetType,
            asset_id: assetId,
            shot_type: shotType || null,
            image_url: '',
            storage_path: '',
            model,
            prompt: fullPrompt,
            status: 'generating',
            is_selected: false,
            generation_order: i,
          })
          .returning();

        console.log(`📸 Created variant ${i + 1}/${models.length}: ${variant.id} (${model})`);
        return variant;
      })
    );

    // Step 2: Trigger ALL generations in PARALLEL
    console.log(`🚀 Starting PARALLEL generation for ${models.length} variants...`);

    const generationPromises = createdVariants.map(async (variant, i) => {
      const model = models[i];
      const mappedModel = mapModelToN8NName(model);

      console.log(`🚀 [${model}] Invoking n8n workflow...`);

      const result = await generateBibleImage({
        asset_type: assetType,
        asset_id: assetId,
        prompt: fullPrompt,
        model: mappedModel,
        aspect_ratio: shotType
          ? getDefaultAspectRatio(shotType)
          : assetType === 'location' ? '16:9' : '1:1',
        quality: getQualityForModel(mappedModel),
        shot_type: shotType,
        variant_id: variant.id,
      }, apiKeys);

      // Log FULL response structure
      console.log(`📦 [${model}] n8n response:`, JSON.stringify(result, null, 2));

      if (result.success && result.data) {
        // n8n returns data as an array - get first element
        const responseData = Array.isArray(result.data) ? result.data[0] : result.data;

        console.log(`📋 [${model}] Response data:`, responseData);
        console.log(`📋 [${model}] taskId:`, responseData.taskId || 'MISSING');
        console.log(`📋 [${model}] imageUrl:`, responseData.imageUrl ? `${responseData.imageUrl.substring(0, 50)}...` : 'MISSING');

        // Store taskId
        if (responseData.taskId) {
          await db
            .update(bibleImageVariants)
            .set({ n8n_job_id: responseData.taskId })
            .where(eq(bibleImageVariants.id, variant.id));
          console.log(`✅ [${model}] Stored taskId: ${responseData.taskId}`);
        } else {
          console.log(`⚠️ [${model}] No taskId in response!`);
        }

        // If we got imageUrl directly (synchronous response), upload to Supabase immediately
        if (responseData.imageUrl) {
          console.log(`📸 [${model}] Got temp URL, uploading to Supabase (FAST mode)...`);

          // Use FAST version - no delays, webhook handles failures
          const uploaded = await downloadAndUploadToSupabaseFast(
            responseData.imageUrl,
            assetType,
            assetId,
            shotType,
            variant.id
          );

          if (uploaded) {
            // Save permanent Supabase URL
            await db
              .update(bibleImageVariants)
              .set({
                image_url: uploaded.url,
                storage_path: uploaded.path,
                status: 'ready',
                n8n_job_id: responseData.taskId,
                updated_at: new Date(),
              })
              .where(eq(bibleImageVariants.id, variant.id));
            console.log(`✅ [${model}] Variant saved with permanent Supabase URL`);
          } else {
            // Keep as 'generating' - webhook will handle it
            console.log(`⏳ [${model}] Fast upload failed, staying in GENERATING for webhook`);
            await db
              .update(bibleImageVariants)
              .set({
                n8n_job_id: responseData.taskId,
                updated_at: new Date(),
              })
              .where(eq(bibleImageVariants.id, variant.id));
          }
        } else {
          console.log(`⏳ [${model}] No imageUrl yet, staying in GENERATING`);
        }
      } else {
        console.log(`❌ [${model}] Generation failed:`, result.error);
      }

      return variant.id;
    });

    // Wait for ALL generations to complete
    console.log(`⏳ Waiting for all ${models.length} generations to complete in parallel...`);
    const variantIds = await Promise.all(generationPromises);
    console.log(`✅ All ${models.length} generations completed!`, variantIds);

    revalidatePath(`/projects/${projectId}/studio/bible`, 'page');

    return { success: true, data: { variantIds } };
  } catch (error) {
    console.error('❌ Error generating multiple variants:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to generate variants',
    };
  }
}

/**
 * Generate multiple image variants using Image-to-Image from a reference
 * Used when portrait is uploaded → generate three_quarter and full_body from it
 *
 * @param characterId - The character to generate variants for
 * @param shotType - The shot type to generate (three_quarter or full_body)
 * @param referenceImageUrl - The portrait image URL to use as reference
 * @param selectedModels - Optional array of model names to use ('seedream' | 'nano-banana'). Defaults to both.
 */
/**
 * @deprecated MVP Simplification: Three-quarter and full-body shots removed.
 * Use generateMultipleVariants() for portrait generation instead.
 */
export async function generateMultipleVariantsFromReference(
  characterId: string,
  shotType: 'three_quarter' | 'full_body',
  referenceImageUrl: string,
  selectedModels?: ('seedream' | 'nano-banana')[]
): Promise<BibleActionResult> {
  // MVP: This function is deprecated - we only use portrait now
  console.warn('⚠️ generateMultipleVariantsFromReference is deprecated for MVP. Use portrait only.');
  return {
    success: false,
    error: 'MVP Simplification: Three-quarter and full-body shots have been removed. Use portrait only.',
  };

  /* DEPRECATED CODE - Original implementation preserved for reference
  try {
    console.log(`🎨 Generating I2I variants for ${shotType} from reference`);

    // Map selected models to I2I model names, default to both if not specified
    const modelsToUse = selectedModels || ['seedream', 'nano-banana'];
    const i2iModels: AIModel[] = modelsToUse.map((m) =>
      m === 'seedream' ? 'seedream-4.5-image-to-image' : 'nano-banana-pro-image-to-image'
    );

    // Get character data
    const [character] = await db
      .select()
      .from(projectCharacters)
      .where(eq(projectCharacters.id, characterId))
      .limit(1);

    if (!character) {
      return { success: false, error: 'Character not found' };
    }

    // Get the shot-specific prompt, or generate a default from the portrait prompt
    let shotPrompt = character[`${shotType}_prompt`] as string | null;

    // If no shot prompt exists, generate a default based on portrait prompt and visual DNA
    if (!shotPrompt) {
      const portraitPrompt = character.portrait_prompt || '';
      const visualDna = character.visual_dna || '';

      // Generate appropriate default prompt based on shot type
      if (shotType === 'three_quarter') {
        shotPrompt = `Three-quarter view, medium shot from waist up, 45-degree angle. ${portraitPrompt ? `Same character as: ${portraitPrompt}` : ''}`;
        console.log(`📝 Generated default three_quarter prompt from portrait`);
      } else {
        shotPrompt = `Full body shot, head to toe, showing complete outfit and silhouette. ${portraitPrompt ? `Same character as: ${portraitPrompt}` : ''}`;
        console.log(`📝 Generated default full_body prompt from portrait`);
      }

      // Save the generated prompt for future use
      const promptField = `${shotType}_prompt` as const;
      await db
        .update(projectCharacters)
        .set({
          [promptField]: shotPrompt,
          updated_at: new Date(),
        })
        .where(eq(projectCharacters.id, characterId));

      console.log(`💾 Saved generated ${shotType} prompt to database`);
    }

    const fullPrompt = `${character.visual_dna}, ${shotPrompt}. Based on reference character portrait. Maintain character consistency. Single subject only, one person, no collage, no multiple images, no grid, no split screen.`;

    // Step 1: Create ALL variant records first
    console.log(`📸 Creating ${i2iModels.length} I2I variant records...`);
    const createdVariants = await Promise.all(
      i2iModels.map(async (model, i) => {
        const [variant] = await db
          .insert(bibleImageVariants)
          .values({
            asset_type: 'character',
            asset_id: characterId,
            shot_type: shotType,
            image_url: '',
            storage_path: '',
            model,
            prompt: fullPrompt,
            status: 'generating',
            is_selected: false,
            generation_order: i,
          })
          .returning();

        console.log(`📸 Created I2I variant ${i + 1}/${i2iModels.length}: ${variant.id} (${model})`);
        return variant;
      })
    );

    // Step 2: Trigger ALL I2I generations in PARALLEL
    console.log(`🚀 Starting PARALLEL I2I generation for ${i2iModels.length} variants...`);

    const generationPromises = createdVariants.map(async (variant, i) => {
      const model = i2iModels[i];
      const mappedModel = mapModelToN8NName(model);

      console.log(`🚀 [${model}] Invoking I2I n8n workflow...`);

      const result = await generateBibleImage({
        asset_type: 'character',
        asset_id: characterId,
        prompt: fullPrompt,
        model: mappedModel,
        aspect_ratio: getDefaultAspectRatio(shotType),
        quality: getQualityForModel(mappedModel),
        shot_type: shotType,
        variant_id: variant.id,
        source_image_url: referenceImageUrl, // KEY: Reference image for I2I
      });

      console.log(`📦 [${model}] I2I response:`, JSON.stringify(result, null, 2));

      if (result.success && result.data) {
        const responseData = Array.isArray(result.data) ? result.data[0] : result.data;

        console.log(`📋 [${model}] Response data:`, responseData);
        console.log(`📋 [${model}] taskId:`, responseData.taskId || 'MISSING');
        console.log(`📋 [${model}] imageUrl:`, responseData.imageUrl ? `${responseData.imageUrl.substring(0, 50)}...` : 'MISSING');

        // Store taskId
        if (responseData.taskId) {
          await db
            .update(bibleImageVariants)
            .set({ n8n_job_id: responseData.taskId })
            .where(eq(bibleImageVariants.id, variant.id));
          console.log(`✅ [${model}] Stored taskId: ${responseData.taskId}`);
        }

        // Update variant if imageUrl received - upload to Supabase (FAST mode)
        if (responseData.imageUrl) {
          console.log(`📸 [${model}] Got temp URL, uploading to Supabase (FAST mode)...`);

          const uploaded = await downloadAndUploadToSupabaseFast(
            responseData.imageUrl,
            'character',
            characterId,
            shotType,
            variant.id
          );

          if (uploaded) {
            await db
              .update(bibleImageVariants)
              .set({
                image_url: uploaded.url,
                storage_path: uploaded.path,
                status: 'ready',
                n8n_job_id: responseData.taskId,
                updated_at: new Date(),
              })
              .where(eq(bibleImageVariants.id, variant.id));
            console.log(`✅ [${model}] I2I variant saved with permanent Supabase URL`);
          } else {
            // Keep as 'generating' - webhook will handle it
            console.log(`⏳ [${model}] Fast upload failed, staying in GENERATING for webhook`);
            await db
              .update(bibleImageVariants)
              .set({
                n8n_job_id: responseData.taskId,
                updated_at: new Date(),
              })
              .where(eq(bibleImageVariants.id, variant.id));
          }
        }
      } else {
        console.log(`❌ [${model}] I2I generation failed:`, result.error);
      }

      return variant.id;
    });

    const variantIds = await Promise.all(generationPromises);
    console.log(`✅ All ${i2iModels.length} I2I generations completed!`, variantIds);

    revalidatePath(`/projects/${character.project_id}/studio/bible`, 'page');

    return { success: true, data: { variantIds } };
  } catch (error) {
    console.error('❌ Error generating I2I variants:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to generate I2I variants',
    };
  }
  END DEPRECATED CODE */
}

/**
 * Select a variant as the chosen image
 * Copies to main asset record and marks as selected
 */
export async function selectVariant(variantId: string): Promise<BibleActionResult> {
  try {
    console.log('✅ Selecting variant:', variantId);

    const [variant] = await db
      .select()
      .from(bibleImageVariants)
      .where(eq(bibleImageVariants.id, variantId))
      .limit(1);

    if (!variant) {
      return { success: false, error: 'Variant not found' };
    }

    // Allow selecting variants that are 'ready' or 'selected' (to allow changing selection)
    if (variant.status !== 'ready' && variant.status !== 'selected') {
      return {
        success: false,
        error: `Variant is ${variant.status}, not ready to select`,
      };
    }

    // Unselect other variants for same asset+shot and reset their status back to 'ready'
    await db
      .update(bibleImageVariants)
      .set({ is_selected: false, status: 'ready', updated_at: new Date() })
      .where(
        and(
          eq(bibleImageVariants.asset_type, variant.asset_type),
          eq(bibleImageVariants.asset_id, variant.asset_id),
          variant.shot_type
            ? eq(bibleImageVariants.shot_type, variant.shot_type)
            : isNull(bibleImageVariants.shot_type)
        )
      );

    // Mark this variant as selected
    await db
      .update(bibleImageVariants)
      .set({ is_selected: true, status: 'selected', updated_at: new Date() })
      .where(eq(bibleImageVariants.id, variantId));

    // Copy to main asset record
    if (variant.asset_type === 'character' && variant.shot_type) {
      const statusField = `${variant.shot_type}_status` as const;
      const urlField = `${variant.shot_type}_image_url` as const;
      const pathField = `${variant.shot_type}_storage_path` as const;

      await db
        .update(projectCharacters)
        .set({
          [statusField]: 'ready',
          [urlField]: variant.image_url,
          [pathField]: variant.storage_path,
          selected_model: variant.model,
          updated_at: new Date(),
        })
        .where(eq(projectCharacters.id, variant.asset_id));

      const [character] = await db
        .select()
        .from(projectCharacters)
        .where(eq(projectCharacters.id, variant.asset_id))
        .limit(1);

      revalidatePath(`/projects/${character.project_id}/studio/bible`, 'page');
    } else if (variant.asset_type === 'location') {
      await db
        .update(projectLocations)
        .set({
          image_status: 'ready',
          approved_image_url: variant.image_url,
          approved_image_storage_path: variant.storage_path,
          selected_model: variant.model,
          updated_at: new Date(),
        })
        .where(eq(projectLocations.id, variant.asset_id));

      const [location] = await db
        .select()
        .from(projectLocations)
        .where(eq(projectLocations.id, variant.asset_id))
        .limit(1);

      revalidatePath(`/projects/${location.project_id}/studio/bible`, 'page');
    } else if (variant.asset_type === 'prop') {
      await db
        .update(projectProps)
        .set({
          image_status: 'ready',
          approved_image_url: variant.image_url,
          approved_image_storage_path: variant.storage_path,
          selected_model: variant.model,
          updated_at: new Date(),
        })
        .where(eq(projectProps.id, variant.asset_id));

      const [prop] = await db
        .select()
        .from(projectProps)
        .where(eq(projectProps.id, variant.asset_id))
        .limit(1);

      revalidatePath(`/projects/${prop.project_id}/studio/bible`, 'page');
    }

    console.log('✅ Variant selected and copied to main record');
    return { success: true };
  } catch (error) {
    console.error('❌ Error selecting variant:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to select variant',
    };
  }
}

/**
 * @deprecated MVP Simplification: Three-quarter and full-body shots removed.
 * Generate a character shot using another shot as reference (I2I)
 * Used for portrait-to-shot propagation
 */
export async function generateCharacterShotFromReference(
  _characterId: string,
  _shotType: 'three_quarter' | 'full_body',
  _referenceImageUrl: string,
  _model?: AIModel
): Promise<BibleActionResult> {
  console.warn('⚠️ generateCharacterShotFromReference is deprecated for MVP. Use portrait only.');
  return {
    success: false,
    error: 'MVP Simplification: Three-quarter and full-body shots have been removed. Use portrait only.',
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if all required Bible assets are approved and update project status
 */
async function checkAndUpdateProjectStatus(projectId: string): Promise<void> {
  const characters = await db
    .select()
    .from(projectCharacters)
    .where(eq(projectCharacters.project_id, projectId));

  const locations = await db
    .select()
    .from(projectLocations)
    .where(eq(projectLocations.project_id, projectId));

  // MVP Simplification: Only portrait needed
  const allCharactersComplete = characters.every(
    (c) => c.portrait_status === 'approved'
  );

  // Check if all locations are approved
  const allLocationsApproved = locations.every(
    (l) => l.image_status === 'approved'
  );

  if (
    allCharactersComplete &&
    allLocationsApproved &&
    characters.length > 0 &&
    locations.length > 0
  ) {
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

// ============================================================================
// Single Variant Addition (Add one variant with selected model)
// ============================================================================

/**
 * Add a single variant with a specific model
 * Used for "Add Variant" button - adds to existing variants instead of replacing
 *
 * @param assetType - Type of asset (character, location, prop)
 * @param assetId - ID of the asset
 * @param shotType - Shot type (for characters)
 * @param model - Which model to use
 * @param apiKeys - Optional user-provided API keys from localStorage
 */
export async function addSingleVariant(
  assetType: 'character' | 'location' | 'prop',
  assetId: string,
  shotType: ShotType | undefined,
  model: 'seedream' | 'nano-banana',
  apiKeys?: ApiKeys
): Promise<BibleActionResult> {
  try {
    console.log(`🎨 Adding single variant for ${assetType}:`, assetId, `with model: ${model}`);

    // Map model name to full AIModel
    const modelMap: Record<string, AIModel> = {
      'seedream': 'seedream-4.5-text-to-image',
      'nano-banana': 'nano-banana-pro-text-to-image',
    };
    const fullModel = modelMap[model];

    // Get asset and prompt
    let prompt = '';
    let visualDna = '';
    let projectId = '';

    if (assetType === 'character' && shotType) {
      // MVP Simplification: Only portrait is supported
      if (shotType !== 'portrait') {
        return {
          success: false,
          error: 'MVP Simplification: Only portrait shots are supported for characters',
        };
      }

      const [character] = await db
        .select()
        .from(projectCharacters)
        .where(eq(projectCharacters.id, assetId))
        .limit(1);

      if (!character) {
        return { success: false, error: 'Character not found' };
      }

      const shotPrompt = character.portrait_prompt;
      if (!shotPrompt) {
        return {
          success: false,
          error: 'No portrait prompt found for this character',
        };
      }

      prompt = shotPrompt;
      visualDna = character.visual_dna || '';
      projectId = character.project_id;
    } else if (assetType === 'location') {
      const [location] = await db
        .select()
        .from(projectLocations)
        .where(eq(projectLocations.id, assetId))
        .limit(1);

      if (!location) {
        return { success: false, error: 'Location not found' };
      }

      prompt = location.visual_description || '';
      projectId = location.project_id;
    } else if (assetType === 'prop') {
      const [prop] = await db
        .select()
        .from(projectProps)
        .where(eq(projectProps.id, assetId))
        .limit(1);

      if (!prop) {
        return { success: false, error: 'Prop not found' };
      }

      prompt = prop.visual_description || '';
      projectId = prop.project_id;
    }

    const fullPrompt = visualDna ? `${visualDna}, ${prompt}` : prompt;

    // Get current max generation_order for this asset
    const existingVariants = await db
      .select({ generation_order: bibleImageVariants.generation_order })
      .from(bibleImageVariants)
      .where(
        and(
          eq(bibleImageVariants.asset_type, assetType),
          eq(bibleImageVariants.asset_id, assetId),
          shotType
            ? eq(bibleImageVariants.shot_type, shotType)
            : isNull(bibleImageVariants.shot_type)
        )
      );

    const maxOrder = existingVariants.length > 0
      ? Math.max(...existingVariants.map(v => v.generation_order || 0))
      : -1;

    // Create variant record
    const [variant] = await db
      .insert(bibleImageVariants)
      .values({
        asset_type: assetType,
        asset_id: assetId,
        shot_type: shotType || null,
        image_url: '',
        storage_path: '',
        model: fullModel,
        prompt: fullPrompt,
        status: 'generating',
        is_selected: false,
        generation_order: maxOrder + 1,
      })
      .returning();

    console.log(`📸 Created single variant: ${variant.id} (${model})`);

    // Invoke n8n workflow
    const mappedModel = mapModelToN8NName(fullModel);
    const result = await generateBibleImage({
      asset_type: assetType,
      asset_id: assetId,
      prompt: fullPrompt,
      model: mappedModel,
      aspect_ratio: shotType
        ? getDefaultAspectRatio(shotType)
        : assetType === 'location' ? '16:9' : '1:1',
      quality: getQualityForModel(mappedModel),
      shot_type: shotType,
      variant_id: variant.id,
    }, apiKeys);

    if (!result.success) {
      await db
        .update(bibleImageVariants)
        .set({
          status: 'failed',
          error_message: result.error || 'Generation failed',
          updated_at: new Date(),
        })
        .where(eq(bibleImageVariants.id, variant.id));

      return { success: false, error: result.error || 'Generation failed' };
    }

    // Store task ID and try fast upload
    const responseData = Array.isArray(result.data) ? result.data[0] : result.data;

    if (responseData?.taskId) {
      await db
        .update(bibleImageVariants)
        .set({ n8n_job_id: responseData.taskId })
        .where(eq(bibleImageVariants.id, variant.id));
    }

    if (responseData?.imageUrl) {
      console.log(`📸 Got temp URL, uploading to Supabase (FAST mode)...`);

      const uploaded = await downloadAndUploadToSupabaseFast(
        responseData.imageUrl,
        assetType,
        assetId,
        shotType,
        variant.id
      );

      if (uploaded) {
        await db
          .update(bibleImageVariants)
          .set({
            image_url: uploaded.url,
            storage_path: uploaded.path,
            status: 'ready',
            n8n_job_id: responseData.taskId,
            updated_at: new Date(),
          })
          .where(eq(bibleImageVariants.id, variant.id));
        console.log(`✅ Single variant saved with permanent Supabase URL`);
      }
    }

    console.log(`✅ Single variant generation started: ${variant.id}`);
    revalidatePath(`/projects/${projectId}/studio/bible`, 'page');

    return { success: true, data: { variantId: variant.id, ...responseData } };
  } catch (error) {
    console.error('❌ Error adding single variant:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to add variant',
    };
  }
}

// ============================================================================
// Variant Deletion
// ============================================================================

/**
 * Delete a variant (cannot delete the currently selected variant)
 */
export async function deleteVariant(variantId: string): Promise<BibleActionResult> {
  try {
    console.log('🗑️ Deleting variant:', variantId);

    const [variant] = await db
      .select()
      .from(bibleImageVariants)
      .where(eq(bibleImageVariants.id, variantId))
      .limit(1);

    if (!variant) {
      return { success: false, error: 'Variant not found' };
    }

    // Cannot delete selected variant
    if (variant.is_selected) {
      return {
        success: false,
        error: 'Cannot delete the selected variant. Select a different variant first.',
      };
    }

    // Delete from Supabase Storage if storage path exists
    if (variant.storage_path) {
      try {
        let bucket = '';
        if (variant.asset_type === 'character') {
          bucket = BIBLE_STORAGE_BUCKETS.characters;
        } else if (variant.asset_type === 'location') {
          bucket = BIBLE_STORAGE_BUCKETS.locations;
        } else {
          bucket = BIBLE_STORAGE_BUCKETS.props;
        }

        await deleteBibleFile(bucket, variant.storage_path);
        console.log(`🗑️ Deleted file from Supabase: ${variant.storage_path}`);
      } catch (storageError) {
        console.error('⚠️ Failed to delete from storage (continuing):', storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete from database
    await db
      .delete(bibleImageVariants)
      .where(eq(bibleImageVariants.id, variantId));

    console.log(`✅ Variant deleted: ${variantId}`);

    // Get project ID for revalidation
    let projectId = '';
    if (variant.asset_type === 'character') {
      const [character] = await db
        .select({ project_id: projectCharacters.project_id })
        .from(projectCharacters)
        .where(eq(projectCharacters.id, variant.asset_id))
        .limit(1);
      projectId = character?.project_id || '';
    } else if (variant.asset_type === 'location') {
      const [location] = await db
        .select({ project_id: projectLocations.project_id })
        .from(projectLocations)
        .where(eq(projectLocations.id, variant.asset_id))
        .limit(1);
      projectId = location?.project_id || '';
    } else {
      const [prop] = await db
        .select({ project_id: projectProps.project_id })
        .from(projectProps)
        .where(eq(projectProps.id, variant.asset_id))
        .limit(1);
      projectId = prop?.project_id || '';
    }

    if (projectId) {
      revalidatePath(`/projects/${projectId}/studio/bible`, 'page');
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting variant:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to delete variant',
    };
  }
}

// ============================================================================
// Fix Duplicate Selected Variants (Data Recovery)
// ============================================================================

/**
 * Fix situation where multiple variants are marked as selected for the same asset/shot.
 * Keeps only the most recently updated one as selected.
 */
export async function fixDuplicateSelectedVariants(
  assetType: 'character' | 'location' | 'prop',
  assetId: string,
  shotType?: 'portrait' | 'three_quarter' | 'full_body'
): Promise<BibleActionResult> {
  try {
    console.log('🔧 Fixing duplicate selected variants:', { assetType, assetId, shotType });

    // Find all selected variants for this asset/shot
    const selectedVariants = await db
      .select()
      .from(bibleImageVariants)
      .where(
        and(
          eq(bibleImageVariants.asset_type, assetType),
          eq(bibleImageVariants.asset_id, assetId),
          shotType
            ? eq(bibleImageVariants.shot_type, shotType)
            : isNull(bibleImageVariants.shot_type),
          eq(bibleImageVariants.is_selected, true)
        )
      )
      .orderBy(bibleImageVariants.updated_at);

    if (selectedVariants.length <= 1) {
      console.log('✅ No duplicates found, nothing to fix');
      return { success: true, data: { fixedCount: 0 } };
    }

    console.log(`⚠️ Found ${selectedVariants.length} selected variants, keeping most recent`);

    // Keep the last one (most recently updated), deselect the rest
    const variantsToDeselect = selectedVariants.slice(0, -1);
    const keptVariant = selectedVariants[selectedVariants.length - 1];

    for (const variant of variantsToDeselect) {
      await db
        .update(bibleImageVariants)
        .set({ is_selected: false, status: 'ready', updated_at: new Date() })
        .where(eq(bibleImageVariants.id, variant.id));
      console.log(`🔄 Deselected variant: ${variant.id}`);
    }

    // Get project ID for revalidation
    let projectId = '';
    if (assetType === 'character') {
      const [character] = await db
        .select({ project_id: projectCharacters.project_id })
        .from(projectCharacters)
        .where(eq(projectCharacters.id, assetId))
        .limit(1);
      projectId = character?.project_id || '';
    } else if (assetType === 'location') {
      const [location] = await db
        .select({ project_id: projectLocations.project_id })
        .from(projectLocations)
        .where(eq(projectLocations.id, assetId))
        .limit(1);
      projectId = location?.project_id || '';
    } else {
      const [prop] = await db
        .select({ project_id: projectProps.project_id })
        .from(projectProps)
        .where(eq(projectProps.id, assetId))
        .limit(1);
      projectId = prop?.project_id || '';
    }

    if (projectId) {
      revalidatePath(`/projects/${projectId}/studio/bible`, 'page');
    }

    console.log(`✅ Fixed duplicates. Kept variant: ${keptVariant.id}`);
    return {
      success: true,
      data: { fixedCount: variantsToDeselect.length, keptVariantId: keptVariant.id },
    };
  } catch (error) {
    console.error('❌ Error fixing duplicate selected variants:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fix duplicate selected variants',
    };
  }
}

/**
 * Force delete a variant (even if selected) - USE WITH CAUTION
 * This is for emergency data recovery situations.
 */
export async function forceDeleteVariant(variantId: string): Promise<BibleActionResult> {
  try {
    console.log('⚠️ Force deleting variant:', variantId);

    const [variant] = await db
      .select()
      .from(bibleImageVariants)
      .where(eq(bibleImageVariants.id, variantId))
      .limit(1);

    if (!variant) {
      return { success: false, error: 'Variant not found' };
    }

    // Delete from Supabase Storage if storage path exists
    if (variant.storage_path) {
      try {
        let bucket = '';
        if (variant.asset_type === 'character') {
          bucket = BIBLE_STORAGE_BUCKETS.characters;
        } else if (variant.asset_type === 'location') {
          bucket = BIBLE_STORAGE_BUCKETS.locations;
        } else {
          bucket = BIBLE_STORAGE_BUCKETS.props;
        }

        await deleteBibleFile(bucket, variant.storage_path);
        console.log(`🗑️ Deleted file from Supabase: ${variant.storage_path}`);
      } catch (storageError) {
        console.error('⚠️ Failed to delete from storage (continuing):', storageError);
      }
    }

    // Delete from database
    await db
      .delete(bibleImageVariants)
      .where(eq(bibleImageVariants.id, variantId));

    console.log(`✅ Force deleted variant: ${variantId}`);

    // If this was a selected variant, clear the main asset record's image
    if (variant.is_selected) {
      if (variant.asset_type === 'character' && variant.shot_type) {
        const statusField = `${variant.shot_type}_status` as const;
        const urlField = `${variant.shot_type}_image_url` as const;
        const pathField = `${variant.shot_type}_storage_path` as const;

        await db
          .update(projectCharacters)
          .set({
            [statusField]: 'pending',
            [urlField]: '',
            [pathField]: '',
            updated_at: new Date(),
          })
          .where(eq(projectCharacters.id, variant.asset_id));
      } else if (variant.asset_type === 'location') {
        await db
          .update(projectLocations)
          .set({
            image_status: 'pending',
            approved_image_url: '',
            approved_image_storage_path: '',
            updated_at: new Date(),
          })
          .where(eq(projectLocations.id, variant.asset_id));
      } else if (variant.asset_type === 'prop') {
        await db
          .update(projectProps)
          .set({
            image_status: 'pending',
            approved_image_url: '',
            approved_image_storage_path: '',
            updated_at: new Date(),
          })
          .where(eq(projectProps.id, variant.asset_id));
      }
    }

    // Get project ID for revalidation
    let projectId = '';
    if (variant.asset_type === 'character') {
      const [character] = await db
        .select({ project_id: projectCharacters.project_id })
        .from(projectCharacters)
        .where(eq(projectCharacters.id, variant.asset_id))
        .limit(1);
      projectId = character?.project_id || '';
    } else if (variant.asset_type === 'location') {
      const [location] = await db
        .select({ project_id: projectLocations.project_id })
        .from(projectLocations)
        .where(eq(projectLocations.id, variant.asset_id))
        .limit(1);
      projectId = location?.project_id || '';
    } else {
      const [prop] = await db
        .select({ project_id: projectProps.project_id })
        .from(projectProps)
        .where(eq(projectProps.id, variant.asset_id))
        .limit(1);
      projectId = prop?.project_id || '';
    }

    if (projectId) {
      revalidatePath(`/projects/${projectId}/studio/bible`, 'page');
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error force deleting variant:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to force delete variant',
    };
  }
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Bulk approve all Bible images for a project
 * For each asset without an approved image:
 * - Select the first ready variant
 * - Approve the asset
 */
export async function bulkApproveBibleImages(
  projectId: string
): Promise<BibleActionResult & { approvedCount?: number }> {
  try {
    console.log('📦 Bulk approving Bible images for project:', projectId);

    let approvedCount = 0;

    // Get all characters for this project
    const characters = await db
      .select()
      .from(projectCharacters)
      .where(eq(projectCharacters.project_id, projectId));

    // Get all variants for characters
    const characterVariants = await db
      .select()
      .from(bibleImageVariants)
      .where(eq(bibleImageVariants.asset_type, 'character'));

    // Process each character's shots
    const shotTypes = ['portrait', 'three_quarter', 'full_body'] as const;

    for (const character of characters) {
      for (const shotType of shotTypes) {
        const statusField = `${shotType}_status` as keyof typeof character;
        const currentStatus = character[statusField];

        // Skip if already approved
        if (currentStatus === 'approved') {
          continue;
        }

        // Get variants for this character and shot
        const variants = characterVariants.filter(
          (v) => v.asset_id === character.id && v.shot_type === shotType
        );

        // Check if there's a selected variant
        const hasSelected = variants.some((v) => v.is_selected);
        if (!hasSelected) {
          // Find first ready variant
          const readyVariant = variants.find(
            (v) => v.status === 'ready' && v.image_url
          );
          if (readyVariant) {
            // Select the variant
            await selectVariant(readyVariant.id);
          } else {
            continue; // No ready variant to select
          }
        }

        // Approve the shot
        await approveCharacterShot(character.id, shotType);
        approvedCount++;
      }
    }

    // Get all locations for this project
    const locations = await db
      .select()
      .from(projectLocations)
      .where(eq(projectLocations.project_id, projectId));

    // Get all variants for locations
    const locationVariants = await db
      .select()
      .from(bibleImageVariants)
      .where(eq(bibleImageVariants.asset_type, 'location'));

    for (const location of locations) {
      // Skip if already approved
      if (location.image_status === 'approved') {
        continue;
      }

      // Get variants for this location
      const variants = locationVariants.filter(
        (v) => v.asset_id === location.id
      );

      // Check if there's a selected variant
      const hasSelected = variants.some((v) => v.is_selected);
      if (!hasSelected) {
        // Find first ready variant
        const readyVariant = variants.find(
          (v) => v.status === 'ready' && v.image_url
        );
        if (readyVariant) {
          await selectVariant(readyVariant.id);
        } else {
          continue;
        }
      }

      // Approve the location
      await db
        .update(projectLocations)
        .set({
          image_status: 'approved',
          approved_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(projectLocations.id, location.id));
      approvedCount++;
    }

    // Get all props for this project
    const props = await db
      .select()
      .from(projectProps)
      .where(eq(projectProps.project_id, projectId));

    // Get all variants for props
    const propVariants = await db
      .select()
      .from(bibleImageVariants)
      .where(eq(bibleImageVariants.asset_type, 'prop'));

    for (const prop of props) {
      // Skip if already approved
      if (prop.image_status === 'approved') {
        continue;
      }

      // Get variants for this prop
      const variants = propVariants.filter((v) => v.asset_id === prop.id);

      // Check if there's a selected variant
      const hasSelected = variants.some((v) => v.is_selected);
      if (!hasSelected) {
        // Find first ready variant
        const readyVariant = variants.find(
          (v) => v.status === 'ready' && v.image_url
        );
        if (readyVariant) {
          await selectVariant(readyVariant.id);
        } else {
          continue;
        }
      }

      // Approve the prop
      await db
        .update(projectProps)
        .set({
          image_status: 'approved',
          approved_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(projectProps.id, prop.id));
      approvedCount++;
    }

    console.log(`📦 Bulk approval complete: ${approvedCount} items approved`);
    revalidatePath(`/projects/${projectId}/studio/bible`, 'page');

    // Check and update project status
    await checkAndUpdateProjectStatus(projectId);

    return { success: true, approvedCount };
  } catch (error) {
    console.error('❌ Error bulk approving Bible images:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to bulk approve',
    };
  }
}
