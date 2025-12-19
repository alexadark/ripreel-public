'use client';

/**
 * Preview Monitor Component
 *
 * Large video player area for previewing selected scene videos.
 * Features:
 * - Shot markers showing all shots in current scene
 * - Sequential auto-play across all shots/scenes
 * - Scene and shot information overlay
 */

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TimelineScene, TimelineShot } from '@/app/actions/timeline';

interface PreviewMonitorProps {
  selectedScene: TimelineScene | null;
  selectedShot: TimelineShot | null;
  allScenes: TimelineScene[];
  onShotChange: (scene: TimelineScene, shot: TimelineShot) => void;
  className?: string;
}

export function PreviewMonitor({
  selectedScene,
  selectedShot,
  allScenes,
  onShotChange,
  className
}: PreviewMonitorProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset playing state when shot changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;

      // Auto-play next shot if auto-play is enabled
      if (autoPlay && selectedShot?.video_url) {
        void videoRef.current.play();
      }
    }
  }, [selectedShot?.id, autoPlay]);

  const togglePlayPause = (): void => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      void videoRef.current.play();
    }

    setIsPlaying(!isPlaying);
  };

  const handleVideoEnded = (): void => {
    setIsPlaying(false);

    // Auto-play next shot if enabled
    if (autoPlay) {
      playNextShot();
    }
  };

  const handleVideoPlay = (): void => {
    setIsPlaying(true);
  };

  const handleVideoPause = (): void => {
    setIsPlaying(false);
  };

  const handleTimeUpdate = (): void => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Find next shot in sequence (across all scenes)
  const playNextShot = (): void => {
    if (!selectedScene || !selectedShot) return;

    // Try to find next shot in current scene
    const currentShotIndex = selectedScene.shots.findIndex(s => s.id === selectedShot.id);
    if (currentShotIndex < selectedScene.shots.length - 1) {
      const nextShot = selectedScene.shots[currentShotIndex + 1];
      if (nextShot.video_url) {
        onShotChange(selectedScene, nextShot);
        return;
      }
    }

    // Move to next scene
    const currentSceneIndex = allScenes.findIndex(s => s.id === selectedScene.id);
    if (currentSceneIndex < allScenes.length - 1) {
      const nextScene = allScenes[currentSceneIndex + 1];
      const firstShotWithVideo = nextScene.shots.find(s => s.video_url);
      if (firstShotWithVideo) {
        onShotChange(nextScene, firstShotWithVideo);
        return;
      }
    }

    // No more shots to play
    setAutoPlay(false);
    console.log('Reached end of timeline');
  };

  const skipToNextShot = (): void => {
    playNextShot();
  };

  // Show placeholder if no shot selected or no video available
  const showPlaceholder = !selectedShot || !selectedShot.video_url;
  const showVideo = selectedShot?.video_url && selectedShot.video_status === 'ready';

  // Calculate shot markers for current scene
  const shotMarkers = selectedScene?.shots.map((shot, index) => {
    const totalDuration = selectedScene.shots.reduce((sum, s) => sum + s.shot_duration_seconds, 0);
    const shotStart = selectedScene.shots
      .slice(0, index)
      .reduce((sum, s) => sum + s.shot_duration_seconds, 0);
    const position = (shotStart / totalDuration) * 100;
    const width = (shot.shot_duration_seconds / totalDuration) * 100;

    return {
      shot,
      position,
      width,
      isActive: shot.id === selectedShot?.id,
      hasVideo: !!shot.video_url,
    };
  }) || [];

  const handlePlayAll = (): void => {
    if (!autoPlay) {
      // Enable auto-play and start playing current video
      setAutoPlay(true);
      if (videoRef.current && selectedShot?.video_url) {
        void videoRef.current.play();
      }
    } else {
      // Stop auto-play and pause current video
      setAutoPlay(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Play All Button */}
      <div className="flex justify-center">
        <Button
          onClick={handlePlayAll}
          size="default"
          className="bg-[#f5c518] hover:bg-[#f5c518]/90 text-black font-['Oswald'] text-sm uppercase tracking-wider"
        >
          {autoPlay ? (
            <>
              <Pause className="w-4 h-4 mr-2" />
              Stop Auto-Play
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Play All Scenes
            </>
          )}
        </Button>
      </div>

      {/* Video Preview */}
      <div className={cn('relative w-full bg-black/40 border border-[#333] rounded-lg overflow-hidden', className)}>
        {/* Video Player */}
        {showVideo && selectedShot.video_url && (
          <video
            ref={videoRef}
            src={selectedShot.video_url}
            className="w-full h-full object-contain"
            onEnded={handleVideoEnded}
            onPlay={handleVideoPlay}
            onPause={handleVideoPause}
            onTimeUpdate={handleTimeUpdate}
            playsInline
          />
        )}

      {/* Placeholder - No Video */}
      {showPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center">
          {selectedShot?.video_status === 'generating' ? (
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#f5c518] mx-auto" />
              <p className="text-[#f5c518] font-['Courier'] text-lg">Generating Video...</p>
            </div>
          ) : selectedShot?.start_frame_image_url ? (
            <div className="relative w-full h-full">
              <img
                src={selectedShot.start_frame_image_url}
                alt="Scene preview"
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <p className="text-white/60 font-['Courier'] text-lg">Video not ready</p>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <Play className="w-16 h-16 text-white/20 mx-auto" />
              <p className="text-white/60 font-['Courier'] text-lg">
                {selectedScene ? 'Select a shot to preview' : 'No scene selected'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Play/Pause Button Overlay */}
      {showVideo && (
        <Button
          onClick={togglePlayPause}
          size="lg"
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white w-20 h-20 rounded-full p-0 transition-opacity hover:opacity-100 opacity-60"
        >
          {isPlaying ? (
            <Pause className="w-10 h-10" />
          ) : (
            <Play className="w-10 h-10 ml-1" />
          )}
        </Button>
      )}

      {/* Top Controls Bar */}
      {showVideo && (
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {/* Skip to Next Shot */}
          <Button
            onClick={skipToNextShot}
            size="sm"
            variant="outline"
            className="bg-black/70 hover:bg-black/90 border-white/20 font-['Courier'] text-xs text-white"
          >
            <SkipForward className="w-4 h-4 mr-1" />
            Next
          </Button>
        </div>
      )}

      {/* Scene Info and Shot Markers Overlay */}
      {selectedScene && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
          {/* Shot Markers Track */}
          {shotMarkers.length > 1 && (
            <div className="mb-3">
              <div className="relative h-8 bg-black/40 rounded overflow-hidden">
                {shotMarkers.map((marker) => (
                  <div
                    key={marker.shot.id}
                    className={cn(
                      'absolute h-full border-r border-black transition-all cursor-pointer',
                      marker.isActive
                        ? 'bg-[#f5c518] opacity-100'
                        : marker.hasVideo
                        ? 'bg-white/60 hover:bg-white/80 opacity-80'
                        : 'bg-white/20 opacity-40'
                    )}
                    style={{
                      left: `${marker.position}%`,
                      width: `${marker.width}%`,
                    }}
                    onClick={() => marker.hasVideo && onShotChange(selectedScene, marker.shot)}
                  >
                    <div className="flex items-center justify-center h-full">
                      <span className="text-xs font-['Oswald'] font-bold text-black">
                        {marker.shot.shot_number}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-white/40 font-['Courier'] mt-1">
                <span>Shot Markers</span>
                <span>{selectedScene.shots.length} shots total</span>
              </div>
            </div>
          )}

          {/* Scene and Shot Info */}
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-[#f5c518] font-['Oswald'] text-sm uppercase tracking-wider">
                Scene {selectedScene.scene_number}
              </span>
              {selectedShot && (
                <>
                  <span className="text-white/40">•</span>
                  <span className="text-[#00f2ea] font-['Courier'] text-sm">
                    Shot {selectedShot.shot_number}/{selectedScene.shots.length}
                  </span>
                  <span className="text-white/40">•</span>
                  <span className="text-white/60 font-['Courier'] text-sm">
                    {selectedShot.shot_duration_seconds}s
                  </span>
                  {autoPlay && (
                    <>
                      <span className="text-white/40">•</span>
                      <span className="text-[#f5c518] font-['Courier'] text-xs animate-pulse">
                        AUTO-PLAY ON
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
            <p className="text-white font-['Courier'] text-sm">{selectedScene.slugline}</p>
          </div>

          {/* Video Progress Bar */}
          {showVideo && selectedShot && (
            <div className="mt-2">
              <div className="relative h-1 bg-black/40 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-[#f5c518] transition-all"
                  style={{
                    width: `${(currentTime / selectedShot.shot_duration_seconds) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
