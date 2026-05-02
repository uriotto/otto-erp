import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20" />
        ))}
      </div>
      {/* Calendar grid */}
      <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
        {/* Day headers */}
        <div className="border-ink-line grid grid-cols-7 border-b">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="border-ink-line border-e px-3 py-3 last:border-e-0">
              <Skeleton className="mx-auto h-4 w-8" />
            </div>
          ))}
        </div>
        {/* Calendar rows */}
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className="border-ink-line grid grid-cols-7 border-b last:border-b-0">
            {Array.from({ length: 7 }).map((_, col) => (
              <div
                key={col}
                className="border-ink-line min-h-[100px] border-e p-2 last:border-e-0"
              >
                <Skeleton className="mb-2 h-4 w-6" />
                {row === 1 && col === 2 && <Skeleton className="h-6 w-full rounded-md" />}
                {row === 2 && col === 4 && <Skeleton className="h-6 w-full rounded-md" />}
                {row === 3 && col === 1 && <Skeleton className="h-6 w-full rounded-md" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
