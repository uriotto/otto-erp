import { Suspense } from "react";
import { RecordingsData } from "./recordings-data";
import { RecordingsSkeleton } from "./loading";

export const metadata = { title: "הקלטות — OTTO" };

export default function RecordingsPage() {
  return (
    <Suspense fallback={<RecordingsSkeleton />}>
      <RecordingsData />
    </Suspense>
  );
}
