import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeaderSkeleton />
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}
