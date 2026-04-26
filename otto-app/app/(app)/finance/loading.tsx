import { CardSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-cream-paper border-ink-line space-y-3 rounded-2xl border p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
