'use client';

/**
 * Timeline Client Component
 *
 * Client-side component that handles timeline interactivity:
 * - Scene selection for preview
 * - Shot selection within scenes
 * - Drag-and-drop scene reordering
 */

import { useState } from 'react';
import { PreviewMonitor } from '@/components/timeline/preview-monitor';
import { TimelineSequencer } from '@/components/timeline/timeline-sequencer';
import { TimelineControls } from '@/components/timeline/timeline-controls';
import type { TimelineData, TimelineScene, TimelineShot } from '@/app/actions/timeline';

interface TimelineClientProps {
  timelineData: TimelineData;
  projectId: string;
}

export function TimelineClient({ timelineData, projectId }: TimelineClientProps) {
  const [selectedScene, setSelectedScene] = useState<TimelineScene | null>(
    timelineData.scenes[0] || null
  );
  const [selectedShot, setSelectedShot] = useState<TimelineShot | null>(
    timelineData.scenes[0]?.shots[0] || null
  );

  const handleSceneSelect = (scene: TimelineScene): void => {
    setSelectedScene(scene);
    // Auto-select first shot of the scene with video
    const firstShotWithVideo = scene.shots.find(s => s.video_url) || scene.shots[0];
    setSelectedShot(firstShotWithVideo || null);
  };

  const handleShotChange = (scene: TimelineScene, shot: TimelineShot): void => {
    setSelectedScene(scene);
    setSelectedShot(shot);
  };

  return (
    <div className="space-y-8">
      {/* Preview Monitor */}
      <PreviewMonitor
        selectedScene={selectedScene}
        selectedShot={selectedShot}
        allScenes={timelineData.scenes}
        onShotChange={handleShotChange}
        className="aspect-video"
      />

      {/* Timeline Sequencer */}
      <TimelineSequencer
        scenes={timelineData.scenes}
        projectId={projectId}
        selectedSceneId={selectedScene?.id || null}
        onSceneSelect={handleSceneSelect}
      />

      {/* Timeline Controls */}
      <TimelineControls
        scenes={timelineData.scenes}
        totalDurationSeconds={timelineData.total_duration_seconds}
        allVideosReady={timelineData.all_videos_ready}
        projectId={projectId}
      />
    </div>
  );
}
