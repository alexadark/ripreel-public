'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';

export default function ImagesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const projectId = params?.id as string;

  useEffect(() => {
    console.error('Images studio error:', error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto text-center p-8 bg-[#1c1c1f] rounded-lg border border-[#333]">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-oswald font-bold text-white mb-2 uppercase">
          Image Studio Error
        </h2>
        <p className="text-[#888] font-courier text-sm mb-4">
          Failed to load the image generation studio.
        </p>

        {error?.message && (
          <div className="mb-6 p-3 bg-[#0a0a0b] rounded border border-[#333]">
            <p className="text-xs text-red-400 font-courier break-words">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button
            onClick={reset}
            className="bg-[#f5c518] text-black hover:bg-[#f5c518]/90 font-oswald uppercase"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>

          {projectId && (
            <Link
              href={`/projects/${projectId}/studio/scenes`}
              className="inline-flex items-center justify-center gap-2 text-sm text-[#888] hover:text-white transition-colors font-courier"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Scenes
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
