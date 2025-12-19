'use client';

import { useState, useTransition } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Wand2,
  Loader2,
  Play,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShotCard } from './shot-card';
import { createShotsFromScene, generateShotVideoMVP } from '@/app/actions/shots';
import type { SceneShot } from '@/lib/drizzle/schema';

interface ShotListProps {
  sceneId: string;
  sceneApprovedImageUrl: string | null;
  shots: SceneShot[];
  onRefresh?: () => void;
}

export function ShotList({
  sceneId,
  sceneApprovedImageUrl,
  shots,
  onRefresh,
}: ShotListProps) {
  const [isExpanded, setIsExpanded] = useState(shots.length > 0);
  const [isPending, startTransition] = useTransition();
  const [isCreatingShots, setIsCreatingShots] = useState(false);
  const [generatingShots, setGeneratingShots] = useState<Set<string>>(new Set());

  const hasShots = shots.length > 0;
  const hasApprovedImage = !!sceneApprovedImageUrl;

  // Calculate shot stats
  const stats = {
    total: shots.length,
    pending: shots.filter((s) => s.video_status === null).length,
    generating: shots.filter((s) => s.video_status === 'generating').length,
    ready: shots.filter(
      (s) => s.video_status === 'ready' || s.video_status === 'approved'
    ).length,
    failed: shots.filter((s) => s.video_status === 'failed').length,
  };

  const handleCreateShots = async () => {
    setIsCreatingShots(true);
    startTransition(async () => {
      // Use createShotsFromScene which copies shots from parsed raw_scene_data.shots
      const result = await createShotsFromScene(sceneId);
      if (result.success) {
        onRefresh?.();
      } else {
        console.error('Failed to create shots:', result.error);
      }
      setIsCreatingShots(false);
    });
  };

  const handleGenerateVideo = async (shotId: string) => {
    setGeneratingShots((prev) => new Set(prev).add(shotId));
    startTransition(async () => {
      const result = await generateShotVideoMVP(shotId);
      if (!result.success) {
        console.error('Failed to generate video:', result.error);
      }
      // Keep in generating set for a short time to show UI feedback
      setTimeout(() => {
        setGeneratingShots((prev) => {
          const next = new Set(prev);
          next.delete(shotId);
          return next;
        });
        onRefresh?.();
      }, 1000);
    });
  };

  const handleGenerateAllVideos = async () => {
    const pendingShots = shots.filter(
      (s) => s.video_status === null || s.video_status === 'failed'
    );

    for (const shot of pendingShots) {
      await handleGenerateVideo(shot.id);
    }
  };

  return (
    <div className="mt-2">
      {/* Header / Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left py-1 hover:bg-[#1c1c1f]/50 rounded transition-colors"
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-[#666]" />
        ) : (
          <ChevronRight size={14} className="text-[#666]" />
        )}
        <span className="font-courier text-xs text-[#888]">
          {hasShots ? (
            <>
              {stats.total} shot{stats.total !== 1 ? 's' : ''}
              {stats.ready > 0 && (
                <span className="text-green-400 ml-2">
                  <CheckCircle size={10} className="inline mr-1" />
                  {stats.ready} ready
                </span>
              )}
              {stats.generating > 0 && (
                <span className="text-[#00f2ea] ml-2">
                  <Loader2 size={10} className="inline mr-1 animate-spin" />
                  {stats.generating} generating
                </span>
              )}
              {stats.failed > 0 && (
                <span className="text-red-400 ml-2">
                  <XCircle size={10} className="inline mr-1" />
                  {stats.failed} failed
                </span>
              )}
            </>
          ) : (
            'No shots yet'
          )}
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-2 space-y-2">
          {/* No shots - show create button */}
          {!hasShots && (
            <div className="p-4 bg-[#0a0a0b] border border-dashed border-[#333] rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-courier text-[#888] text-sm">
                    No shots created for this scene.
                  </p>
                  <p className="font-courier text-[#666] text-xs mt-1">
                    AI will divide the scene into shots (max 8s each).
                  </p>
                </div>
                <Button
                  onClick={handleCreateShots}
                  disabled={isPending || isCreatingShots}
                  className="bg-[#f5c518] hover:bg-[#d4a616] text-black font-courier text-xs"
                >
                  {isCreatingShots ? (
                    <>
                      <Loader2 size={14} className="mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Wand2 size={14} className="mr-2" />
                      Create Shots
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Has shots - show list with optional generate all */}
          {hasShots && (
            <>
              {/* Generate All button when there are pending shots */}
              {stats.pending > 0 && hasApprovedImage && (
                <div className="flex items-center justify-between p-2 bg-[#0a0a0b] border border-[#333] rounded">
                  <span className="font-courier text-xs text-[#888]">
                    {stats.pending} shot{stats.pending !== 1 ? 's' : ''} ready for
                    video generation
                  </span>
                  <Button
                    size="sm"
                    onClick={handleGenerateAllVideos}
                    disabled={isPending || generatingShots.size > 0}
                    className="bg-[#f5c518] hover:bg-[#d4a616] text-black font-courier text-xs h-7"
                  >
                    {generatingShots.size > 0 ? (
                      <>
                        <Loader2 size={12} className="mr-1 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Play size={12} className="mr-1" />
                        Generate All
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Shot cards */}
              <div className="space-y-2">
                {shots.map((shot) => (
                  <ShotCard
                    key={shot.id}
                    shot={shot}
                    sceneApprovedImageUrl={sceneApprovedImageUrl}
                    isGenerating={
                      generatingShots.has(shot.id) ||
                      shot.video_status === 'generating'
                    }
                    onGenerateVideo={() => handleGenerateVideo(shot.id)}
                    onRefresh={onRefresh}
                    disabled={isPending}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
