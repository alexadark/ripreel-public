import { Skeleton } from "@/components/ui/skeleton";
import { Film, Clock, CheckCircle } from "lucide-react";

export default function ScenesLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto animate-pulse">
      {/* Instructions Skeleton */}
      <div className="mb-8 p-6 bg-[#1c1c1f] border-l-4 border-[#f5c518]">
        <Skeleton className="h-6 w-64 bg-[#333] mb-2" />
        <Skeleton className="h-4 w-full bg-[#333]" />
        <Skeleton className="h-4 w-3/4 bg-[#333] mt-2" />
      </div>

      {/* Stats Bar Skeleton */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-[#1c1c1f] border border-[#333] rounded mb-6">
        <div className="flex items-center gap-2 text-[#888]">
          <Film size={16} />
          <Skeleton className="h-4 w-20 bg-[#333]" />
        </div>
        <div className="flex items-center gap-2 text-[#888]">
          <Clock size={16} />
          <Skeleton className="h-4 w-24 bg-[#333]" />
        </div>
        <div className="flex items-center gap-2 text-[#888]">
          <CheckCircle size={16} />
          <Skeleton className="h-4 w-24 bg-[#333]" />
        </div>
      </div>

      {/* Scene Cards Skeleton */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-[#1c1c1f] border border-[#333] rounded-lg p-6"
          >
            {/* Scene Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 bg-[#f5c518]/20 rounded" />
                <div>
                  <Skeleton className="h-5 w-48 bg-[#333] mb-2" />
                  <Skeleton className="h-4 w-32 bg-[#333]" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 bg-[#333] rounded-full" />
            </div>

            {/* Scene Content */}
            <div className="space-y-3">
              <Skeleton className="h-4 w-full bg-[#333]" />
              <Skeleton className="h-4 w-5/6 bg-[#333]" />
              <Skeleton className="h-4 w-4/6 bg-[#333]" />
            </div>

            {/* Scene Footer */}
            <div className="mt-4 pt-4 border-t border-[#333] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-24 bg-[#333]" />
                <Skeleton className="h-4 w-20 bg-[#333]" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 bg-[#333] rounded" />
                <Skeleton className="h-8 w-24 bg-[#333] rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons Skeleton */}
      <div className="mt-8 flex justify-center items-center gap-4">
        <Skeleton className="h-14 w-36 bg-[#333]" />
        <Skeleton className="h-14 w-48 bg-[#333]" />
      </div>
    </div>
  );
}
