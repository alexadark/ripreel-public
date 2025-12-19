import { NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { projects, scenes } from "@/lib/drizzle/schema";
import { eq, count } from "drizzle-orm";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;

    console.log("📊 Status API called for project:", projectId);

    // Fetch project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      console.log("❌ Project not found:", projectId);
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Count scenes
    const [sceneCount] = await db
      .select({ count: count() })
      .from(scenes)
      .where(eq(scenes.project_id, projectId));

    const response = {
      status: project.status,
      sceneCount: sceneCount?.count || 0,
    };

    console.log("✅ Status API response:", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ Error in status API:", error);
    return NextResponse.json(
      { error: "Failed to fetch project status", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
