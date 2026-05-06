export function StatsGridSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-cream-paper shadow-card rounded-2xl p-5">
            <div className="mb-4">
              <div className="bg-ink-line h-9 w-9 animate-pulse rounded-xl" />
            </div>
            <div className="bg-ink-line mb-2 h-8 w-16 animate-pulse rounded" />
            <div className="bg-ink-line h-3 w-20 animate-pulse rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-cream-paper shadow-card rounded-2xl p-5">
            <div className="mb-4">
              <div className="bg-ink-line h-9 w-9 animate-pulse rounded-xl" />
            </div>
            <div className="bg-ink-line mb-2 h-8 w-16 animate-pulse rounded" />
            <div className="bg-ink-line h-3 w-20 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <div className="bg-cream-paper shadow-card rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="bg-ink-line h-4 w-28 animate-pulse rounded" />
        <div className="bg-ink-line h-3 w-10 animate-pulse rounded" />
      </div>
      <ul className="divide-ink-line/70 divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="flex items-start gap-3 py-2.5">
            <div className="bg-ink-line mt-0.5 h-8 w-8 shrink-0 animate-pulse rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="bg-ink-line h-3.5 w-3/4 animate-pulse rounded" />
              <div className="bg-ink-line h-3 w-1/2 animate-pulse rounded" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TasksSkeleton() {
  return (
    <div className="bg-cream-paper shadow-card rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="bg-ink-line h-4 w-32 animate-pulse rounded" />
        <div className="bg-ink-line h-3 w-10 animate-pulse rounded" />
      </div>
      <ul className="space-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-start gap-2.5 py-2">
            <div className="bg-ink-line mt-0.5 h-4 w-4 shrink-0 animate-pulse rounded" />
            <div className="flex-1 space-y-1.5">
              <div className="bg-ink-line h-3.5 w-4/5 animate-pulse rounded" />
              <div className="bg-ink-line h-3 w-2/5 animate-pulse rounded" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
