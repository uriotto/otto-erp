import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardStats } from "./dashboard-stats";
import { DashboardActivity } from "./dashboard-activity";
import { DashboardTasks } from "./dashboard-tasks";
import { StatsGridSkeleton, ActivitySkeleton, TasksSkeleton } from "./dashboard-skeletons";

export const metadata = {
  title: "דשבורד — OTTO",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: tenant } = await supabase.from("tenants").select("name").single();

  const today = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-8">
      <p className="text-ink-faded text-sm">
        {tenant?.name ?? "OTTO"} · {today}
      </p>

      <Suspense fallback={<StatsGridSkeleton />}>
        <DashboardStats />
      </Suspense>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Suspense fallback={<ActivitySkeleton />}>
            <DashboardActivity />
          </Suspense>
        </div>
        <div className="lg:col-span-2">
          <Suspense fallback={<TasksSkeleton />}>
            <DashboardTasks />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
