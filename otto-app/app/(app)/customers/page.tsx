import { Suspense } from "react";
import { CustomersData } from "./customers-data";
import { CustomersLoadingSkeleton } from "./loading";

export const metadata = { title: "לקוחות — OTTO" };

export default function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string }>;
}) {
  return (
    <Suspense fallback={<CustomersLoadingSkeleton />}>
      <CustomersData searchParams={searchParams} />
    </Suspense>
  );
}
