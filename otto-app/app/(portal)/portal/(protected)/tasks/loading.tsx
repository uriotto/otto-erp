import { ListRowSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="mb-6 flex gap-3">
        <Skeleton className="h-10 max-w-sm flex-1" />
      </div>
      <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
        {Array.from({ length: 5 }).map((_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
