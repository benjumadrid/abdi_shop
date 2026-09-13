export default function LoadingSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-3xl overflow-hidden border border-surface-200/90 shadow-card"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {/* Image skeleton */}
          <div className="relative overflow-hidden" style={{ aspectRatio: '4/3' }}>
            <div className="absolute inset-0 shimmer" />
          </div>

          {/* Text skeleton */}
          <div className="p-5 sm:p-6 space-y-3">
            <div className="h-4 shimmer rounded-lg w-4/5" />
            <div className="h-3.5 shimmer rounded-lg w-3/5" />
            <div className="h-3 shimmer rounded-lg w-full" />
            <div className="h-3 shimmer rounded-lg w-2/3" />
            <div className="pt-3 border-t border-surface-100 flex items-center justify-between">
              <div className="h-5 shimmer rounded-lg w-24" />
              <div className="h-8 shimmer rounded-xl w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
