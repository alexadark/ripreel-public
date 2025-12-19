import { db } from "@/lib/drizzle/db";
import { scenes as scenesTable, scene_shots } from "@/lib/drizzle/schema";
import { eq, inArray, asc } from "drizzle-orm";
import { Video } from "lucide-react";
import { VideoGenerationDashboard } from "@/components/studio/video-generation-dashboard";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudioVideoPage({ params }: PageProps) {
  const { id } = await params;

  // Fetch scenes
  const scenes = await db
    .select()
    .from(scenesTable)
    .where(eq(scenesTable.project_id, id))
    .orderBy(asc(scenesTable.scene_number));

  // Fetch shots for all scenes
  const sceneIds = scenes.map((s) => s.id);
  const shots = sceneIds.length > 0
    ? await db
        .select()
        .from(scene_shots)
        .where(inArray(scene_shots.scene_id, sceneIds))
        .orderBy(asc(scene_shots.shot_number))
    : [];

  // Create shots map grouped by scene_id
  const shotsMap = new Map<string, typeof shots>();
  for (const shot of shots) {
    const existing = shotsMap.get(shot.scene_id) ?? [];
    existing.push(shot);
    shotsMap.set(shot.scene_id, existing);
  }

  // Combine scenes with their shots
  const scenesWithShots = scenes.map((scene) => ({
    scene,
    shots: shotsMap.get(scene.id) ?? [],
  }));

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Video className="text-[#f5c518]" size={32} />
          <h1 className="font-oswald text-4xl md:text-5xl uppercase font-bold tracking-tight text-white">
            Video Generation
          </h1>
        </div>

        {/* Instructions */}
        <div className="p-6 bg-[#1c1c1f] border-l-4 border-[#f5c518]">
          <h2 className="font-oswald uppercase text-lg text-[#f5c518] mb-2 tracking-wider">
            Shot-Based Video Generation
          </h2>
          <p className="font-courier text-[#888] text-sm leading-relaxed">
            Each scene is divided into shots (max 8 seconds each). Generate videos for each shot
            using the scene&apos;s approved image as the starting frame. Videos are created with
            Google VEO 3.1 including audio from the prompt.
          </p>
        </div>
      </div>

      {/* Video Generation Dashboard */}
      <VideoGenerationDashboard
        projectId={id}
        scenesWithShots={scenesWithShots}
      />
    </div>
  );
}
