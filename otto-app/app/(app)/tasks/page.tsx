import { Suspense } from "react";
import { TasksData } from "./tasks-data";
import { TasksSkeleton } from "./loading";

export const metadata = { title: "משימות — OTTO" };

export default function TasksPage() {
  return (
    <Suspense fallback={<TasksSkeleton />}>
      <TasksData />
    </Suspense>
  );
}
