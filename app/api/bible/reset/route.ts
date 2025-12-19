import { NextRequest, NextResponse } from 'next/server';
import { resetStuckBibleVariants } from '@/app/actions/auto-mode';

/**
 * POST /api/bible/reset
 * Reset stuck Bible variants and regenerate them
 *
 * Body: { projectId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId is required' },
        { status: 400 }
      );
    }

    console.log(`🔧 API: Resetting Bible variants for project ${projectId}`);

    const result = await resetStuckBibleVariants(projectId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Reset API error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
