import { ListRowSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export function CustomersLoadingSkeleton() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="mb-6 flex gap-3">
        <Skeleton className="h-10 max-w-md flex-1" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
        {Array.from({ length: 6 }).map((_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return <CustomersLoadingSkeleton />;
}
