import 'dotenv/config';
import { db } from '@/lib/drizzle/db';
import { bibleImageVariants } from '@/lib/drizzle/schema';
import { eq, like, and, or } from 'drizzle-orm';
import {
  uploadBibleFile,
  getCharacterShotPath,
  BIBLE_STORAGE_BUCKETS,
} from '@/lib/supabase/storage-bible';

/**
 * Fix variants that have temporary CDN URLs by:
 * 1. Trying to re-download and upload to Supabase
 * 2. If download fails (expired), mark as failed
 */
async function main() {
  console.log('🔧 Fixing variants with temporary CDN URLs...\n');

  // Find all variants with temp URLs
  const tempVariants = await db
    .select()
    .from(bibleImageVariants)
    .where(
      and(
        like(bibleImageVariants.image_url, '%tempfile.aiquickdraw.com%'),
        or(
          eq(bibleImageVariants.status, 'ready'),
          eq(bibleImageVariants.status, 'selected')
        )
      )
    );

  console.log(`Found ${tempVariants.length} variants with temp URLs to fix\n`);

  let fixed = 0;
  let failed = 0;

  for (const variant of tempVariants) {
    console.log(`\nProcessing: ${variant.id.substring(0, 8)}... (${variant.model})`);
    console.log(`  Current URL: ${variant.image_url?.substring(0, 50)}...`);

    try {
      // Try to download from temp URL
      console.log('  ⬇️ Downloading...');
      const response = await fetch(variant.image_url!);

      if (!response.ok) {
        console.log(`  ❌ Download failed: ${response.status} - marking as failed`);
        await db
          .update(bibleImageVariants)
          .set({ status: 'failed' })
          .where(eq(bibleImageVariants.id, variant.id));
        failed++;
        continue;
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      if (imageBuffer.length < 1000) {
        console.log(`  ❌ Downloaded data too small (${imageBuffer.length} bytes) - marking as failed`);
        await db
          .update(bibleImageVariants)
          .set({ status: 'failed' })
          .where(eq(bibleImageVariants.id, variant.id));
        failed++;
        continue;
      }

      console.log(`  📦 Downloaded ${imageBuffer.length} bytes`);

      // Generate new filename and upload to Supabase
      const timestamp = Date.now();
      const filename = `${variant.id}_${timestamp}.png`;
      const storagePath = getCharacterShotPath(
        variant.asset_id,
        (variant.shot_type || 'portrait') as 'portrait' | 'three_quarter' | 'full_body',
        filename
      );

      console.log(`  ⬆️ Uploading to Supabase: ${storagePath}`);
      const result = await uploadBibleFile(
        BIBLE_STORAGE_BUCKETS.characters,
        storagePath,
        imageBuffer,
        'image/png'
      );

      // Update variant with permanent URL
      await db
        .update(bibleImageVariants)
        .set({
          image_url: result.url,
          storage_path: result.path,
          updated_at: new Date(),
        })
        .where(eq(bibleImageVariants.id, variant.id));

      console.log(`  ✅ Fixed! New URL: ${result.url.substring(0, 50)}...`);
      fixed++;
    } catch (error) {
      console.error(`  ❌ Error:`, error);
      await db
        .update(bibleImageVariants)
        .set({ status: 'failed' })
        .where(eq(bibleImageVariants.id, variant.id));
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`❌ Failed (marked as failed): ${failed}`);
  console.log(`📊 Total processed: ${tempVariants.length}`);
}

main().catch(console.error).finally(() => process.exit(0));
