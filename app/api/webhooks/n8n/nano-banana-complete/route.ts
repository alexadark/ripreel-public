import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { scene_images } from "@/lib/drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Webhook endpoint to receive Nano Banana generation results from n8n
 *
 * Expected payload:
 * {
 *   scene_image_id: string;
 *   image_url?: string;
 *   status: "ready" | "failed";
 *   error_message?: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scene_image_id, image_url, status, error_message } = body;

    console.log("📥 Received Nano Banana result:", {
      scene_image_id,
      status,
      has_image: !!image_url,
    });

    if (!scene_image_id) {
      return NextResponse.json(
        { success: false, error: "scene_image_id is required" },
        { status: 400 }
      );
    }

    // Update database with generated image
    await db
      .update(scene_images)
      .set({
        image_url: image_url || null,
        status: status || "ready",
        error_message: error_message || null,
      })
      .where(eq(scene_images.id, scene_image_id));

    console.log("✅ Nano Banana image updated in database");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
