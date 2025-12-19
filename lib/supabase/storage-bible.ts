/**
 * Supabase Storage Setup for Bible Assets
 * Handles uploads for characters, locations, and props
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * Bible storage bucket names
 */
export const BIBLE_STORAGE_BUCKETS = {
  characters: 'bible-characters-uploads',
  locations: 'bible-locations-uploads',
  props: 'bible-props-uploads',
} as const;

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
 * Create Bible storage buckets
 * Run this during setup: npm run storage:setup
 */
export async function createBibleStorageBuckets(): Promise<void> {
  const supabase = getAdminClient();

  console.log('📦 Creating Bible storage buckets...');

  for (const [key, bucketName] of Object.entries(BIBLE_STORAGE_BUCKETS)) {
    console.log(`  Creating bucket: ${bucketName}`);

    const { data: existingBucket } = await supabase.storage.getBucket(
      bucketName
    );

    if (existingBucket) {
      console.log(`  ✅ Bucket ${bucketName} already exists`);
      continue;
    }

    const { error } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });

    if (error) {
      console.error(`  ❌ Error creating ${bucketName}:`, error);
      throw error;
    }

    console.log(`  ✅ Created bucket: ${bucketName}`);
  }

  console.log('✅ All Bible storage buckets created successfully!');
}

/**
 * Upload a file to Bible storage
 *
 * @param bucketName - Storage bucket name
 * @param path - File path within bucket
 * @param file - File to upload
 * @returns Public URL of uploaded file
 */
export async function uploadBibleFile(
  bucketName: string,
  path: string,
  file: File | Buffer,
  contentType?: string
): Promise<{ url: string; path: string }> {
  const supabase = getAdminClient();

  const fileOptions = contentType ? { contentType } : {};

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(path, file, {
      upsert: true, // Replace if exists
      ...fileOptions,
    });

  if (error) {
    console.error('❌ Error uploading file:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucketName).getPublicUrl(data.path);

  return {
    url: publicUrl,
    path: data.path,
  };
}

/**
 * Delete a file from Bible storage
 */
export async function deleteBibleFile(
  bucketName: string,
  path: string
): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase.storage.from(bucketName).remove([path]);

  if (error) {
    console.error('❌ Error deleting file:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Get storage path for character shot
 */
export function getCharacterShotPath(
  characterId: string,
  shotType: 'portrait' | 'three_quarter' | 'full_body',
  filename: string
): string {
  const timestamp = Date.now();
  const extension = filename.split('.').pop();
  return `${characterId}/${shotType}_${timestamp}.${extension}`;
}

/**
 * Get storage path for location image
 */
export function getLocationImagePath(
  locationId: string,
  filename: string
): string {
  const timestamp = Date.now();
  const extension = filename.split('.').pop();
  return `${locationId}/location_${timestamp}.${extension}`;
}

/**
 * Get storage path for prop image
 */
export function getPropImagePath(propId: string, filename: string): string {
  const timestamp = Date.now();
  const extension = filename.split('.').pop();
  return `${propId}/prop_${timestamp}.${extension}`;
}
