import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export function RecordingsSkeleton() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="mb-6 flex gap-3">
        <Skeleton className="h-10 max-w-md flex-1" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-cream-paper border-ink-line space-y-3 rounded-2xl border p-5">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
            </div>
            <Skeleton className="h-3 w-1/2" />
            <div className="flex items-center gap-3 pt-1">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return <RecordingsSkeleton />;
}
