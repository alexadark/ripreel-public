import { getTimelineData, type TimelineData } from '@/app/actions/timeline';
import { TimelineClient } from './timeline-client';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudioTimelinePage({ params }: PageProps) {
  const { id } = await params;

  // Fetch timeline data
  const result = await getTimelineData(id);

  if (!result.success) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="p-6 bg-[#1c1c1f] border-l-4 border-red-500">
          <h2 className="font-oswald uppercase text-lg text-red-500 mb-2 tracking-wider">
            Error Loading Timeline
          </h2>
          <p className="font-courier text-[#888] text-sm leading-relaxed">
            {result.error}
          </p>
        </div>
      </div>
    );
  }

  const timelineData = result.data as TimelineData;

  // Format duration (seconds to MM:SS)
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="text-[#f5c518]" size={32} />
          <h1 className="font-oswald text-4xl md:text-5xl uppercase font-bold tracking-tight text-white">
            Timeline & Sequencer
          </h1>
        </div>

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Badge className="bg-[#1c1c1f] text-[#888] border border-[#333] font-courier text-sm">
            {timelineData.scenes.length} Scenes
          </Badge>
          <Badge className="bg-[#1c1c1f] text-[#888] border border-[#333] font-courier text-sm">
            {formatDuration(timelineData.total_duration_seconds)} Total Duration
          </Badge>
          <Badge
            className={
              timelineData.all_videos_ready
                ? 'bg-green-500/20 text-green-400 border-green-500/40 font-courier text-sm'
                : 'bg-[#1c1c1f] text-[#888] border border-[#333] font-courier text-sm'
            }
          >
            {timelineData.all_videos_ready ? 'All Videos Ready' : 'Videos Generating...'}
          </Badge>
        </div>

        {/* Instructions */}
        <div className="p-6 bg-[#1c1c1f] border-l-4 border-[#f5c518]">
          <h2 className="font-oswald uppercase text-lg text-[#f5c518] mb-2 tracking-wider">
            Timeline Instructions
          </h2>
          <p className="font-courier text-[#888] text-sm leading-relaxed">
            Click any scene to preview its video. Drag and drop scenes to reorder your reel.
            When all videos are ready, proceed to Final Review for audio mixing and export.
          </p>
        </div>
      </div>

      {/* Timeline Client Component (handles interactivity) */}
      <TimelineClient timelineData={timelineData} projectId={id} />
    </div>
  );
}


