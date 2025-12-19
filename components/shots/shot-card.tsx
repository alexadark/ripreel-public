'use client';

import { useTransition } from 'react';
import {
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Film,
  StopCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Veo3PromptEditor } from './veo3-prompt-editor';
import { updateShotVeo3Prompt, cancelShotVideoGeneration } from '@/app/actions/shots';
import type { SceneShot, Veo3PromptData } from '@/lib/drizzle/schema';

interface ShotCardProps {
  shot: SceneShot;
  sceneApprovedImageUrl: string | null;
  isGenerating: boolean;
  onGenerateVideo: () => void;
  onRefresh?: () => void;
  disabled?: boolean;
}

export function ShotCard({
  shot,
  sceneApprovedImageUrl,
  isGenerating,
  onGenerateVideo,
  onRefresh,
  disabled = false,
}: ShotCardProps) {
  const [isPending, startTransition] = useTransition();

  const hasApprovedImage = !!sceneApprovedImageUrl;

  const canGenerate =
    hasApprovedImage &&
    !isGenerating &&
    (shot.video_status === null || shot.video_status === 'failed');
  const canRegenerate =
    hasApprovedImage &&
    !isGenerating &&
    (shot.video_status === 'ready' || shot.video_status === 'approved');
  const canCancel = shot.video_status === 'generating';

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelShotVideoGeneration(shot.id);
      if (result.success) {
        onRefresh?.();
      } else {
        console.error('Failed to cancel generation:', result.error);
      }
    });
  };

  const handleSaveVeo3Prompt = async (data: Veo3PromptData) => {
    const result = await updateShotVeo3Prompt(shot.id, data);
    if (result.success) {
      onRefresh?.();
    } else {
      console.error('Failed to update VEO3 prompt:', result.error);
      throw new Error(result.error);
    }
  };

  const getStatusBadge = () => {
    if (!hasApprovedImage) {
      return (
        <Badge className="bg-[#333] text-[#666] border-none">
          <Clock size={10} className="mr-1" />
          No Image
        </Badge>
      );
    }

    if (isGenerating || shot.video_status === 'generating') {
      return (
        <Badge className="bg-[#00f2ea]/20 text-[#00f2ea] border-none">
          <Loader2 size={10} className="mr-1 animate-spin" />
          Generating
        </Badge>
      );
    }

    switch (shot.video_status) {
      case 'ready':
      case 'approved':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-none">
            <CheckCircle size={10} className="mr-1" />
            Ready
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-none">
            <XCircle size={10} className="mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-[#f5c518]/20 text-[#f5c518] border-none">
            <Clock size={10} className="mr-1" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="p-3 bg-[#0a0a0b] border border-[#333] rounded-lg">
      <div className="flex items-start gap-3">
        {/* Shot Number */}
        <div className="w-8 h-8 bg-[#1c1c1f] border border-[#333] rounded flex items-center justify-center flex-shrink-0">
          <span className="font-oswald text-sm text-[#f5c518]">
            {shot.shot_number}
          </span>
        </div>

        {/* Shot Info */}
        <div className="flex-1 min-w-0">
          {/* Shot Type & Duration */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {shot.shot_type && (
              <Badge variant="outline" className="text-xs border-[#444] text-[#888]">
                <Film size={10} className="mr-1" />
                {shot.shot_type}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs border-[#444] text-[#888]">
              {shot.shot_duration_seconds}s
            </Badge>
            {getStatusBadge()}
          </div>

          {/* VEO 3.1 Structured Prompt Editor - Always shown */}
          <Veo3PromptEditor
            promptData={shot.video_prompt_veo3}
            legacyPrompt={shot.action_prompt}
            dialogueSegment={shot.dialogue_segment}
            onSave={handleSaveVeo3Prompt}
            disabled={disabled || isPending}
            className="mb-2"
          />

          {/* Error Message */}
          {shot.error_message && (
            <p className="font-courier text-red-400 text-xs mt-1">
              {shot.error_message}
            </p>
          )}
        </div>

        {/* Right Side: Video Preview & Actions */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* Video Preview */}
          {shot.video_url && (
            <div className="w-32 h-20 bg-[#0a0a0b] border border-[#333] rounded overflow-hidden">
              <video
                src={shot.video_url}
                className="w-full h-full object-cover"
                controls
                muted
              />
            </div>
          )}

          {/* Action Button */}
          <div>
            {canGenerate && (
              <Button
                size="sm"
                onClick={onGenerateVideo}
                disabled={disabled || isGenerating || isPending}
                className="bg-[#f5c518] hover:bg-[#d4a616] text-black font-courier text-xs h-8"
              >
                {isGenerating ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <>
                    <Play size={12} className="mr-1" />
                    Generate
                  </>
                )}
              </Button>
            )}

            {canRegenerate && (
              <Button
                size="sm"
                variant="outline"
                onClick={onGenerateVideo}
                disabled={disabled || isGenerating || isPending}
                className="border-[#333] text-[#888] hover:text-white font-courier text-xs h-8"
              >
                {isGenerating ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  'Regenerate'
                )}
              </Button>
            )}

            {canCancel && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={disabled || isPending}
                className="border-red-500/50 text-red-400 hover:text-red-300 hover:bg-red-500/10 font-courier text-xs h-8"
              >
                {isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <>
                    <StopCircle size={12} className="mr-1" />
                    Cancel
                  </>
                )}
              </Button>
            )}

            {!hasApprovedImage && (
              <span className="font-courier text-[#666] text-xs">
                Need image
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
