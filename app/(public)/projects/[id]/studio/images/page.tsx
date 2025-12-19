import { db } from '@/lib/drizzle/db';
import {
  projects,
  scenes as scenesTable,
  sceneImageVariants,
} from '@/lib/drizzle/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Image as ImageIcon, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SceneImageCard } from '@/components/studio/scene-image-card';
import { BulkApproveImagesButton } from '@/components/studio/bulk-approve-images-button';
import { resolveBibleElements } from '@/app/actions/scene-images';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudioImagesPage({ params }: PageProps) {
  const { id } = await params;

  // Fetch project
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) {
    notFound();
  }

  // Fetch scenes
  const scenes = await db
    .select()
    .from(scenesTable)
    .where(eq(scenesTable.project_id, id))
    .orderBy(scenesTable.scene_number);

  // Fetch variants and Bible data for all scenes
  const scenesWithData = await Promise.all(
    scenes.map(async (scene) => {
      // Get variants for this scene
      const variants = await db
        .select()
        .from(sceneImageVariants)
        .where(eq(sceneImageVariants.scene_id, scene.id))
        .orderBy(sceneImageVariants.generation_order);

      // Resolve Bible elements for this scene
      const bibleData = await resolveBibleElements(id, scene);

      return {
        scene,
        variants,
        bibleData,
      };
    })
  );

  // Count approved scenes (those with a selected variant)
  const approvedScenes = scenesWithData.filter(
    (s) => s.variants.some((v) => v.is_selected) || s.scene.approved_image_url
  ).length;

  // Count scenes that have ready variants but no approved image (can be bulk approved)
  const readyToApproveCount = scenesWithData.filter((s) => {
    const hasApproved = s.variants.some((v) => v.is_selected) || s.scene.approved_image_url;
    const hasReady = s.variants.some((v) => v.status === 'ready' && v.image_url);
    return !hasApproved && hasReady;
  }).length;

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <ImageIcon className="text-[#f5c518]" size={32} />
          <h1 className="font-oswald text-4xl md:text-5xl uppercase font-bold tracking-tight text-white">
            Image Generation
          </h1>
        </div>

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Badge className="bg-[#1c1c1f] text-[#888] border border-[#333] font-courier text-sm">
            {scenes.length} Scenes
          </Badge>
          <Badge className="bg-[#1c1c1f] text-[#888] border border-[#333] font-courier text-sm">
            {approvedScenes} Approved
          </Badge>
          {readyToApproveCount > 0 && (
            <Badge className="bg-[#f5c518]/20 text-[#f5c518] border border-[#f5c518] font-courier text-sm">
              {readyToApproveCount} Ready
            </Badge>
          )}
          <div className="ml-auto">
            <BulkApproveImagesButton projectId={id} readyCount={readyToApproveCount} />
          </div>
        </div>

        {/* Instructions */}
        <div className="p-6 bg-[#1c1c1f] border-l-4 border-[#f5c518]">
          <h2 className="font-oswald uppercase text-lg text-[#f5c518] mb-2 tracking-wider">
            Scene Image Generation (HITL Checkpoint #2)
          </h2>
          <p className="font-courier text-[#888] text-sm leading-relaxed mb-3">
            <strong className="text-white">Dual-Model Generation:</strong> Each
            scene generates with both Seedream 4.5 and Nano Banana Pro
            simultaneously.
            <br />
            <strong className="text-white">Bible Integration:</strong> Character,
            location, and prop references from your approved Bible are
            automatically injected into each scene.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Sparkles className="text-[#f5c518]" size={16} />
            <span className="font-courier text-[#666] text-xs">
              Select the best image from each pair. Final selection triggers
              video + audio generation.
            </span>
          </div>
        </div>
      </div>

      {/* Scenes with Image Generation */}
      {scenesWithData.length > 0 && (
        <div className="space-y-6">
          {scenesWithData.map(({ scene, variants, bibleData }) => (
            <SceneImageCard
              key={scene.id}
              scene={scene}
              variants={variants}
              bibleData={bibleData}
            />
          ))}
        </div>
      )}

      {/* No Scenes - Show empty state */}
      {scenes.length === 0 && (
        <div className="text-center py-12">
          <p className="font-courier text-[#666]">
            No scenes found. Please complete scene validation first.
          </p>
        </div>
      )}
    </div>
  );
}






