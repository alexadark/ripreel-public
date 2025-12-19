import { db } from "@/lib/drizzle/db";
import {
  scenes as scenesTable,
  scene_shots,
  final_reels,
  projects,
} from "@/lib/drizzle/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ExportPanel } from "@/components/export/export-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudioExportPage({ params }: PageProps) {
  const { id } = await params;

  // Fetch project
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  // Fetch scenes
  const scenes = await db
    .select()
    .from(scenesTable)
    .where(eq(scenesTable.project_id, id))
    .orderBy(scenesTable.scene_number);

  // Count ready video shots from scene_shots table
  const sceneIds = scenes.map((s) => s.id);
  let readyVideoCount = 0;

  if (sceneIds.length > 0) {
    const readyShots = await db
      .select({ id: scene_shots.id })
      .from(scene_shots)
      .where(
        and(
          inArray(scene_shots.scene_id, sceneIds),
          eq(scene_shots.video_status, "ready"),
          isNotNull(scene_shots.video_url)
        )
      );
    readyVideoCount = readyShots.length;
  }

  // Fetch final reel status
  const [finalReel] = await db
    .select()
    .from(final_reels)
    .where(eq(final_reels.project_id, id))
    .limit(1);

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Download className="text-[#f5c518]" size={32} />
          <h1 className="font-oswald text-4xl md:text-5xl uppercase font-bold tracking-tight text-white">
            Export & Download
          </h1>
        </div>

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Badge className="bg-[#1c1c1f] text-[#888] border border-[#333] font-courier text-sm">
            {scenes.length} Scenes
          </Badge>
          <Badge className="bg-[#1c1c1f] text-[#00f2ea] border border-[#00f2ea]/30 font-courier text-sm">
            {readyVideoCount} Ready Shots
          </Badge>
        </div>

        {/* Instructions */}
        <div className="p-6 bg-[#1c1c1f] border-l-4 border-[#f5c518]">
          <h2 className="font-oswald uppercase text-lg text-[#f5c518] mb-2 tracking-wider">
            Final Assembly
          </h2>
          <p className="font-courier text-[#888] text-sm leading-relaxed">
            Assemble your scene videos into a final reel with crossfade transitions.
            The video will be uploaded to YouTube as an unlisted video for easy sharing,
            and you can also download the MP4 file directly.
          </p>
        </div>
      </div>

      {/* Export Panel */}
      <ExportPanel
        projectId={id}
        projectTitle={project?.title || "Untitled Project"}
        readyVideoCount={readyVideoCount}
        totalSceneCount={scenes.length}
        finalReel={
          finalReel
            ? {
                id: finalReel.id,
                status: finalReel.status,
                video_url: finalReel.video_url,
                youtube_url: finalReel.youtube_url,
                youtube_id: finalReel.youtube_id,
                error_message: finalReel.error_message,
                created_at: finalReel.created_at,
              }
            : null
        }
      />
    </div>
  );
}

