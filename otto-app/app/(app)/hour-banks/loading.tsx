import { CardSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export function HourBanksSkeleton() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="mb-6 flex gap-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="ms-auto h-10 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return <HourBanksSkeleton />;
}
