import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardStats } from "./dashboard-stats";
import { DashboardActivity } from "./dashboard-activity";
import { DashboardTasks } from "./dashboard-tasks";
import { StatsGridSkeleton, ActivitySkeleton, TasksSkeleton } from "./dashboard-skeletons";

export const metadata = {
  title: "דשבורד — OTTO",
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "בוקר טוב";
  if (hour < 17) return "צהריים טובים";
  return "ערב טוב";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const [{ data: profile }, { data: tenant }] = await Promise.all([
    supabase.from("users").select("full_name, email").single(),
    supabase.from("tenants").select("name").single(),
  ]);

  const displayName =
    profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-ink-soft mt-1 text-sm">
          {tenant?.name ?? "OTTO"} ·{" "}
          {new Date().toLocaleDateString("he-IL", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        {displayName && (
          <p className="text-navy text-base font-medium">
            {getGreeting()}، {displayName}
          </p>
        )}
      </div>

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
