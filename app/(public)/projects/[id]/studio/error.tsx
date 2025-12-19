'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Studio error:', error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0b] min-h-[calc(100vh-73px)]">
      <div className="max-w-md mx-auto text-center p-8">
        <div className="mb-8">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-oswald font-bold text-white mb-2 uppercase">
            Something went wrong
          </h1>
          <p className="text-[#888] font-courier text-sm">
            We encountered an error while loading this studio section.
            This might be a temporary issue.
          </p>
        </div>

        {error?.message && (
          <div className="mb-6 p-4 bg-[#1c1c1f] rounded-lg border border-[#333]">
            <p className="text-sm text-red-400 font-courier break-words">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-4 items-center">
          <Button
            onClick={reset}
            className="bg-[#f5c518] text-black hover:bg-[#f5c518]/90 font-oswald uppercase"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>

          <Link
            href="/projects"
            className="inline-flex items-center gap-2 text-sm text-[#888] hover:text-white transition-colors font-courier"
          >
            <Home className="w-4 h-4" />
            Return to Projects
          </Link>
        </div>

        {error?.digest && (
          <div className="mt-8 text-xs text-[#555] font-courier">
            Error ID: {error.digest}
          </div>
        )}
      </div>
    </div>
  );
}
