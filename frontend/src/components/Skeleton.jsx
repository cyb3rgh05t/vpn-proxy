/**
 * Reusable skeleton building blocks. Use these to render placeholders
 * matching real content while data is loading, instead of a single
 * full-page spinner.
 */

export function SkeletonBlock({ className = "" }) {
  return (
    <div
      className={`bg-vpn-input/60 rounded-lg animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonStatCard() {
  return (
    <div className="bg-vpn-card border border-vpn-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <SkeletonBlock className="w-7 h-7 rounded-md" />
        <SkeletonBlock className="h-3 w-20" />
      </div>
      <SkeletonBlock className="h-7 w-12 mt-1" />
    </div>
  );
}

export function SkeletonCard({ className = "" }) {
  return (
    <div
      className={`bg-vpn-card border border-vpn-border rounded-xl p-5 ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        <SkeletonBlock className="h-5 w-40" />
        <SkeletonBlock className="h-5 w-16 rounded-full" />
      </div>
      <SkeletonBlock className="h-3 w-full mb-2" />
      <SkeletonBlock className="h-3 w-3/4 mb-4" />
      <div className="flex gap-2">
        <SkeletonBlock className="h-8 w-16 rounded-lg" />
        <SkeletonBlock className="h-8 w-16 rounded-lg" />
        <SkeletonBlock className="h-8 w-16 rounded-lg ml-auto" />
      </div>
    </div>
  );
}

export function SkeletonText({ lines = 3, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}
