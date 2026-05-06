import { Suspense } from "react";
import { HourBanksData } from "./hour-banks-data";
import { HourBanksSkeleton } from "./loading";

export const metadata = { title: "בנקי שעות — OTTO" };

export default function HourBanksPage() {
  return (
    <Suspense fallback={<HourBanksSkeleton />}>
      <HourBanksData />
    </Suspense>
  );
}
