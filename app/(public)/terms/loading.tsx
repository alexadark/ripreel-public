export default function TermsLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header Skeleton */}
      <div className="bg-gradient-to-b from-background to-muted/20 border-b">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="h-10 bg-muted/30 rounded-lg mb-4 animate-pulse" />
            <div className="h-6 bg-muted/20 rounded-lg mb-2 animate-pulse" />
            <div className="h-6 bg-muted/20 rounded-lg w-3/4 mb-6 animate-pulse" />
            <div className="h-4 bg-muted/20 rounded-lg w-48 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="h-8 bg-muted/30 rounded-lg w-1/3 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 bg-muted/20 rounded-lg animate-pulse" />
                  <div className="h-4 bg-muted/20 rounded-lg w-5/6 animate-pulse" />
                  <div className="h-4 bg-muted/20 rounded-lg w-4/5 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
