import { Skeleton } from "@/components/ui/skeleton";
import { Users, MapPin, Package } from "lucide-react";

export default function BibleLoading() {
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
          <Users size={16} />
          <Skeleton className="h-4 w-24 bg-[#333]" />
        </div>
        <div className="flex items-center gap-2 text-[#888]">
          <MapPin size={16} />
          <Skeleton className="h-4 w-24 bg-[#333]" />
        </div>
        <div className="flex items-center gap-2 text-[#888]">
          <Package size={16} />
          <Skeleton className="h-4 w-20 bg-[#333]" />
        </div>
      </div>

      {/* Progress Bar Skeleton */}
      <div className="space-y-4 mb-8">
        <Skeleton className="h-2 w-full bg-[#333] rounded-full" />
      </div>

      {/* Tabs Skeleton */}
      <div className="mt-8">
        <div className="flex gap-2 mb-6">
          <Skeleton className="h-10 w-40 bg-[#333] rounded" />
          <Skeleton className="h-10 w-36 bg-[#333] rounded" />
          <Skeleton className="h-10 w-28 bg-[#333] rounded" />
        </div>

        {/* Character Cards Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-[#1c1c1f] border border-[#333] rounded-lg p-6"
            >
              {/* Character Header */}
              <div className="flex items-center gap-4 mb-4">
                <Skeleton className="h-16 w-16 bg-[#333] rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-6 w-32 bg-[#333] mb-2" />
                  <Skeleton className="h-4 w-48 bg-[#333]" />
                </div>
              </div>

              {/* Three Shots Grid */}
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="space-y-2">
                    <Skeleton className="h-32 w-full bg-[#333] rounded" />
                    <Skeleton className="h-3 w-16 bg-[#333]" />
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-8 w-24 bg-[#333] rounded" />
                <Skeleton className="h-8 w-24 bg-[#333] rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons Skeleton */}
      <div className="mt-12 flex justify-center items-center gap-4">
        <Skeleton className="h-14 w-36 bg-[#333]" />
        <Skeleton className="h-14 w-64 bg-[#333]" />
      </div>
    </div>
  );
}
