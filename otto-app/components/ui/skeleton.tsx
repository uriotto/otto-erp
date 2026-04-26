export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-cream-deep relative overflow-hidden rounded-lg motion-reduce:animate-none ${className}`}
      aria-hidden
    >
      <div className="from-cream-deep via-cream-paper to-cream-deep absolute inset-0 -translate-x-full animate-[shimmer_1.4s_ease-in-out_infinite] bg-gradient-to-r" />
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-8 flex items-end justify-between">
      <div className="space-y-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

export function ListRowSkeleton() {
  return (
    <div className="border-ink-line flex items-center gap-4 border-b px-4 py-4 last:border-b-0">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-cream-paper border-ink-line space-y-4 rounded-2xl border p-6 ${className}`}>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}
