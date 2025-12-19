import { db } from '@/lib/drizzle/db';
import {
  projects,
  scenes as scenesTable,
  projectCharacters,
  projectLocations,
  projectProps
} from '@/lib/drizzle/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Film, CheckCircle, Clock } from 'lucide-react';
import { EditableSceneCard } from '@/components/scenes/editable-scene-card';
import { ScenesLoader } from '@/components/scenes/scenes-loader';
import { ApproveAllButton } from '@/components/scenes/approve-all-button';
import { AutoGenerateButton } from '@/components/scenes/auto-generate-button';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudioScenesPage({ params }: PageProps) {
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

  // Fetch Bible assets for context
  const characters = await db
    .select()
    .from(projectCharacters)
    .where(eq(projectCharacters.project_id, id))
    .orderBy(projectCharacters.name);

  const locations = await db
    .select()
    .from(projectLocations)
    .where(eq(projectLocations.project_id, id))
    .orderBy(projectLocations.name);

  const props = await db
    .select()
    .from(projectProps)
    .where(eq(projectProps.project_id, id))
    .orderBy(projectProps.name);

  // Calculate stats
  const totalScenes = scenes.length;
  const approvedScenes = scenes.filter(
    (s) => s.validation_status === 'approved'
  ).length;
  const pendingScenes = totalScenes - approvedScenes;
  const allScenesApproved = totalScenes > 0 && approvedScenes === totalScenes;
  const totalDuration = scenes.reduce((sum, scene) => {
    return sum + (scene.full_data?.duration_estimate || 0);
  }, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Instructions */}
      <div className="mb-8 p-6 bg-[#1c1c1f] border-l-4 border-[#f5c518]">
        <h2 className="font-oswald uppercase text-lg text-[#f5c518] mb-2 tracking-wider">
          Scene Validation (HITL Checkpoint #1)
        </h2>
        <p className="font-courier text-[#888] text-sm leading-relaxed">
          Review each scene parsed by n8n. The AI has extracted scene details including
          characters, props, visual mood, and audio requirements. Verify accuracy and
          approve scenes to proceed to image generation.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-[#1c1c1f] border border-[#333] rounded mb-6">
        <div className="flex items-center gap-2 text-[#888]">
          <Film size={16} />
          <span className="font-courier text-sm">
            {totalScenes} {totalScenes === 1 ? "Scene" : "Scenes"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[#888]">
          <Clock size={16} />
          <span className="font-courier text-sm">
            ~{Math.ceil(totalDuration / 60)}min total
          </span>
        </div>
        <div className="flex items-center gap-2 text-[#888]">
          <CheckCircle size={16} />
          <span className="font-courier text-sm">
            {approvedScenes}/{totalScenes} approved
          </span>
        </div>
        <div className="ml-auto">
          <AutoGenerateButton projectId={id} sceneCount={totalScenes} />
        </div>
      </div>

      {/* Scenes List with Loading State */}
      <ScenesLoader initialProject={project} initialScenes={scenes} />

      {scenes.length > 0 && (
        <div className="space-y-4">
          {scenes.map((scene) => (
            <EditableSceneCard
              key={scene.id}
              scene={scene}
              characters={characters}
              locations={locations}
              props={props}
            />
          ))}
        </div>
      )}

      {/* Action Buttons */}
      {scenes.length > 0 && (
        <div className="mt-8 flex justify-center items-center gap-4 flex-wrap">
          <ApproveAllButton
            projectId={id}
            pendingCount={pendingScenes}
            disabled={pendingScenes === 0}
          />
          <Link
            href={allScenesApproved ? `/projects/${id}/studio/images` : '#'}
            className={cn(
              'inline-flex items-center gap-3 font-oswald text-lg uppercase tracking-widest px-8 py-4 transition-all',
              allScenesApproved
                ? 'bg-[#f5c518] hover:bg-white text-black hover:scale-105'
                : 'bg-[#333] text-[#666] cursor-not-allowed pointer-events-none'
            )}
            aria-disabled={!allScenesApproved}
          >
            Continue to Images
          </Link>
        </div>
      )}
    </div>
  );
}
