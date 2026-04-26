import { CardSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeaderSkeleton />
      <CardSkeleton className="mb-4" />
      <CardSkeleton className="mb-4" />
      <CardSkeleton />
    </div>
  );
}
