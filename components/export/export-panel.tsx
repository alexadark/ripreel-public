'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { Download, Share2, Youtube, Loader2, Play, AlertCircle, CheckCircle2, RefreshCw, ExternalLink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { triggerFinalAssembly, retryAssembly, getAssemblyStatus, type AssemblyActionResult } from '@/app/actions/assembly';
import { toast } from 'sonner';

interface FinalReelData {
  id: string;
  status: 'assembling' | 'uploading' | 'ready' | 'failed';
  video_url: string | null;
  youtube_url: string | null;
  youtube_id: string | null;
  error_message: string | null;
  created_at: Date;
}

interface ExportPanelProps {
  projectId: string;
  projectTitle: string;
  readyVideoCount: number;
  totalSceneCount: number;
  finalReel: FinalReelData | null;
}

export function ExportPanel({
  projectId,
  projectTitle,
  readyVideoCount,
  totalSceneCount,
  finalReel,
}: ExportPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AssemblyActionResult | null>(null);
  const [localStatus, setLocalStatus] = useState<'idle' | 'assembling' | 'uploading' | 'ready' | 'failed'>(
    finalReel?.status || 'idle'
  );

  const canAssemble = readyVideoCount >= 2;
  const isAssembling = localStatus === 'assembling' || localStatus === 'uploading' || isPending;
  const isReady = localStatus === 'ready' || finalReel?.status === 'ready';
  const hasFailed = localStatus === 'failed' || finalReel?.status === 'failed';

  // Poll for status updates while assembling
  useEffect(() => {
    if (!isAssembling) return;

    const pollStatus = async () => {
      const status = await getAssemblyStatus(projectId);
      if (status) {
        // Update local status from database
        if (status.status === 'uploading' && localStatus !== 'uploading') {
          setLocalStatus('uploading');
        }
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(pollStatus, 2000);

    return () => clearInterval(interval);
  }, [isAssembling, projectId, localStatus]);

  // Use result URLs if available, otherwise use finalReel data
  const videoUrl = (result && 'videoUrl' in result ? result.videoUrl : null) || finalReel?.video_url;
  const youtubeUrl = (result && 'youtubeUrl' in result ? result.youtubeUrl : null) || finalReel?.youtube_url;
  const youtubeId = (result && 'youtubeId' in result ? result.youtubeId : null) || finalReel?.youtube_id;
  const errorMessage = (result && !result.success ? result.error : null) || finalReel?.error_message;

  const handleAssemble = () => {
    setLocalStatus('assembling');
    setResult(null);

    startTransition(async () => {
      const assemblyResult = await triggerFinalAssembly(projectId);
      setResult(assemblyResult);

      if (assemblyResult.success) {
        setLocalStatus('ready');
        toast.success('Reel assembled successfully!');
      } else {
        setLocalStatus('failed');
        toast.error(assemblyResult.error || 'Assembly failed');
      }
    });
  };

  const handleRetry = () => {
    setLocalStatus('assembling');
    setResult(null);

    startTransition(async () => {
      const retryResult = await retryAssembly(projectId);
      setResult(retryResult);

      if (retryResult.success) {
        setLocalStatus('ready');
        toast.success('Reel assembled successfully!');
      } else {
        setLocalStatus('failed');
        toast.error(retryResult.error || 'Assembly failed');
      }
    });
  };

  const handleDownload = () => {
    if (videoUrl) {
      window.open(videoUrl, '_blank');
    }
  };

  const handleShareYouTube = () => {
    if (youtubeUrl) {
      navigator.clipboard.writeText(youtubeUrl);
      toast.success('YouTube link copied to clipboard!');
    }
  };

  return (
    <div className="space-y-8">
      {/* Status Section */}
      <div className="p-6 bg-[#1c1c1f] border border-[#333] rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-oswald text-xl uppercase tracking-wider text-white">
            Assembly Status
          </h3>
          <StatusBadge status={localStatus} isAssembling={isAssembling} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-[#0a0a0b] border border-[#333] rounded">
            <p className="font-courier text-xs text-[#888] uppercase mb-1">Ready Shots</p>
            <p className="font-oswald text-2xl text-white">
              {readyVideoCount} <span className="text-[#888] text-lg">shots</span>
            </p>
          </div>
          <div className="p-4 bg-[#0a0a0b] border border-[#333] rounded">
            <p className="font-courier text-xs text-[#888] uppercase mb-1">Minimum Required</p>
            <p className="font-oswald text-2xl text-white">
              2 <span className="text-[#888] text-lg">shots</span>
            </p>
          </div>
        </div>

        {/* Not enough shots warning */}
        {!canAssemble && (
          <div className="p-4 bg-[#2a1a1a] border border-[#f5c518]/30 rounded mb-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-[#f5c518]" size={20} />
              <p className="font-courier text-sm text-[#f5c518]">
                You need at least 2 ready video shots to assemble your reel. Go to the Video tab to generate videos.
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {hasFailed && errorMessage && (
          <div className="p-4 bg-[#2a1a1a] border border-[#e02f2f]/30 rounded mb-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-[#e02f2f]" size={20} />
              <p className="font-courier text-sm text-[#e02f2f]">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Assembly Button */}
        {!isReady && (
          <div className="flex gap-3">
            {hasFailed ? (
              <Button
                onClick={handleRetry}
                disabled={!canAssemble || isAssembling}
                className="bg-[#f5c518] hover:bg-[#f5c518]/90 text-black font-oswald uppercase tracking-wider"
              >
                {isAssembling ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Assembling...
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    Retry Assembly
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleAssemble}
                disabled={!canAssemble || isAssembling}
                className="bg-[#f5c518] hover:bg-[#f5c518]/90 text-black font-oswald uppercase tracking-wider"
              >
                {isAssembling ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Assembling Reel...
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    Assemble Final Reel
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Ready Section - YouTube Preview & Downloads */}
      {isReady && (youtubeId || videoUrl) && (
        <div className="space-y-6">
          {/* YouTube Preview */}
          {youtubeId && (
            <YouTubePreview youtubeId={youtubeId} projectTitle={projectTitle} />
          )}

          {/* Download & Share Actions */}
          <div className="p-6 bg-[#1c1c1f] border border-[#333] rounded-lg">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="text-green-500" size={24} />
              <h3 className="font-oswald text-xl uppercase tracking-wider text-white">
                Your Reel is Ready!
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Download MP4 */}
              {videoUrl && (
                <Button
                  onClick={handleDownload}
                  className="h-auto py-4 bg-[#f5c518] hover:bg-[#f5c518]/90 text-black font-oswald uppercase tracking-wider"
                >
                  <Download size={20} />
                  <div className="text-left">
                    <div>Download MP4</div>
                    <div className="text-xs opacity-70 normal-case">High quality video file</div>
                  </div>
                </Button>
              )}

              {/* Share YouTube Link */}
              {youtubeUrl && (
                <Button
                  onClick={handleShareYouTube}
                  variant="outline"
                  className="h-auto py-4 border-[#e02f2f] text-[#e02f2f] hover:bg-[#e02f2f]/10 font-oswald uppercase tracking-wider"
                >
                  <Share2 size={20} />
                  <div className="text-left">
                    <div>Copy YouTube Link</div>
                    <div className="text-xs opacity-70 normal-case">Share with your team</div>
                  </div>
                </Button>
              )}
            </div>

            {/* Direct Links */}
            <div className="mt-4 pt-4 border-t border-[#333]">
              <p className="font-courier text-xs text-[#888] uppercase mb-2">Direct Links</p>
              <div className="space-y-2">
                {videoUrl && (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[#00f2ea] hover:underline font-courier text-sm"
                  >
                    <ExternalLink size={14} />
                    MP4 Download Link
                  </a>
                )}
                {youtubeUrl && (
                  <a
                    href={youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[#e02f2f] hover:underline font-courier text-sm"
                  >
                    <Youtube size={14} />
                    YouTube Video Link
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Re-assemble Option */}
          <div className="text-center">
            <Button
              onClick={handleAssemble}
              disabled={isAssembling}
              variant="ghost"
              className="text-[#888] hover:text-white font-courier text-sm"
            >
              <RefreshCw size={14} />
              Re-assemble Reel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function YouTubePreview({ youtubeId, projectTitle }: { youtubeId: string; projectTitle: string }) {
  const [isVideoReady, setIsVideoReady] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const checkVideoAvailability = useCallback(async () => {
    setIsChecking(true);
    try {
      // Use YouTube oEmbed API to check if video is available
      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`
      );
      setIsVideoReady(response.ok);
    } catch {
      setIsVideoReady(false);
    }
    setIsChecking(false);
  }, [youtubeId]);

  useEffect(() => {
    checkVideoAvailability();

    // If video is not ready, check again every 30 seconds
    const interval = setInterval(() => {
      if (!isVideoReady) {
        checkVideoAvailability();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [youtubeId, isVideoReady, checkVideoAvailability]);

  return (
    <div className="p-6 bg-[#1c1c1f] border border-[#333] rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <Youtube className="text-[#e02f2f]" size={24} />
        <h3 className="font-oswald text-xl uppercase tracking-wider text-white">
          YouTube Preview
        </h3>
      </div>

      {isChecking && isVideoReady === null ? (
        // Initial loading state
        <div className="aspect-video bg-[#0a0a0b] rounded-lg flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-[#e02f2f]" size={48} />
          <p className="font-courier text-[#888] text-sm">Checking video availability...</p>
        </div>
      ) : isVideoReady ? (
        // Video is ready - show iframe
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title={`${projectTitle} - Film Reel`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      ) : (
        // Video is still processing on YouTube
        <div className="aspect-video bg-[#0a0a0b] rounded-lg flex flex-col items-center justify-center gap-4 border border-[#333]">
          <div className="relative">
            <Youtube className="text-[#e02f2f]/30" size={64} />
            <div className="absolute -bottom-1 -right-1 bg-[#1c1c1f] rounded-full p-1">
              <Clock className="text-[#f5c518] animate-pulse" size={24} />
            </div>
          </div>
          <div className="text-center space-y-2 max-w-md px-4">
            <p className="font-oswald text-lg text-white uppercase tracking-wider">
              Video Processing
            </p>
            <p className="font-courier text-sm text-[#888]">
              Your video has been uploaded to YouTube and is currently being processed.
              This usually takes 1-3 minutes.
            </p>
          </div>
          <Button
            onClick={checkVideoAvailability}
            disabled={isChecking}
            variant="outline"
            size="sm"
            className="border-[#e02f2f] text-[#e02f2f] hover:bg-[#e02f2f]/10 font-courier"
          >
            {isChecking ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                Check Again
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, isAssembling }: { status: string; isAssembling: boolean }) {
  if (isAssembling) {
    const statusText = status === 'uploading' ? 'Uploading to Storage' : 'Assembling';
    return (
      <Badge className="bg-[#f5c518]/20 text-[#f5c518] border-[#f5c518] font-courier">
        <Loader2 className="animate-spin mr-1" size={12} />
        {statusText}
      </Badge>
    );
  }

  switch (status) {
    case 'ready':
      return (
        <Badge className="bg-green-500/20 text-green-500 border-green-500 font-courier">
          <CheckCircle2 className="mr-1" size={12} />
          Ready
        </Badge>
      );
    case 'failed':
      return (
        <Badge className="bg-[#e02f2f]/20 text-[#e02f2f] border-[#e02f2f] font-courier">
          <AlertCircle className="mr-1" size={12} />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge className="bg-[#333] text-[#888] border-[#333] font-courier">
          Pending
        </Badge>
      );
  }
}
