# Performance Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce perceived navigation latency and improve UI responsiveness across the OTTO app by parallelizing blocking queries, adding streaming with Suspense, and prefetching navigation links.

**Architecture:** Four targeted improvements — (1) parallel layout queries, (2) forced prefetch on sidebar, (3) streaming on the dashboard, (4) streaming pattern for list pages (customers, hour-banks, recordings). Each improvement is independent and can be deployed separately.

**Tech Stack:** Next.js 16 App Router, React 19 Suspense, Supabase SSR client, Tailwind CSS.

---

## Task 1: Parallelize layout queries

Layout currently runs two Supabase calls sequentially. Running them in parallel cuts layout time roughly in half.

**Files:**
- Modify: `otto-app/app/(app)/layout.tsx`

**Step 1: Read the current layout**

```bash
cat "otto-app/app/(app)/layout.tsx"
```

**Step 2: Replace sequential queries with Promise.all**

Current code (lines ~18-22):
```tsx
const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  redirect("/login");
}

const { data: profile } = await supabase.from("users").select("full_name, email").single();
```

Replace with:
```tsx
const [
  { data: { user } },
  { data: profile },
] = await Promise.all([
  supabase.auth.getUser(),
  supabase.from("users").select("full_name, email").single(),
]);

if (!user) {
  redirect("/login");
}
```

Note: running the profile query in parallel with getUser is safe — Supabase sends the auth cookie with every request, so the DB query uses the session. If the user isn't authenticated, RLS returns null for profile, and we redirect anyway.

**Step 3: Verify typecheck**

```bash
cd otto-app && npm run typecheck
```

Expected: no errors.

**Step 4: Commit**

```bash
git add otto-app/app/(app)/layout.tsx
git commit -m "perf: parallelize layout auth + profile queries"
```

---

## Task 2: Force prefetch on all sidebar navigation links

Next.js App Router prefetches `<Link>` components visible in the viewport by default, but only the static shell. Adding `prefetch={true}` forces it to also prefetch dynamic routes proactively so navigation feels instant.

**Files:**
- Modify: `otto-app/components/layout/sidebar.tsx`

**Step 1: Find the Link element in sidebar**

It's around line 47:
```tsx
<Link
  href={item.href}
  onClick={onNavigate}
  className={...}
>
```

**Step 2: Add prefetch prop**

```tsx
<Link
  href={item.href}
  onClick={onNavigate}
  prefetch={true}
  className={...}
>
```

**Step 3: Verify typecheck**

```bash
cd otto-app && npm run typecheck
```

**Step 4: Commit**

```bash
git add otto-app/components/layout/sidebar.tsx
git commit -m "perf: force prefetch on all sidebar navigation links"
```

---

## Task 3: Stream dashboard — split into independent sections

The dashboard awaits 12 queries before rendering anything. With streaming, each section renders as soon as its data arrives.

**Files:**
- Modify: `otto-app/app/(app)/dashboard/page.tsx`
- Create: `otto-app/app/(app)/dashboard/dashboard-stats.tsx`
- Create: `otto-app/app/(app)/dashboard/dashboard-activity.tsx`
- Create: `otto-app/app/(app)/dashboard/dashboard-tasks.tsx`
- Create: `otto-app/app/(app)/dashboard/dashboard-skeletons.tsx`

**Step 1: Read the full dashboard page**

```bash
cat "otto-app/app/(app)/dashboard/page.tsx"
```

**Step 2: Create dashboard-skeletons.tsx**

```tsx
// otto-app/app/(app)/dashboard/dashboard-skeletons.tsx

export function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-cream-paper border-ink-line rounded-xl border p-4">
          <div className="bg-ink-line mb-2 h-3 w-16 animate-pulse rounded" />
          <div className="bg-ink-line h-7 w-12 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <div className="bg-cream-paper border-ink-line rounded-xl border p-4">
      <div className="bg-ink-line mb-4 h-4 w-24 animate-pulse rounded" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border-ink-line flex gap-3 border-b py-3 last:border-0">
          <div className="bg-ink-line h-8 w-8 flex-shrink-0 animate-pulse rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="bg-ink-line h-3 w-3/4 animate-pulse rounded" />
            <div className="bg-ink-line h-3 w-1/2 animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TasksSkeleton() {
  return (
    <div className="bg-cream-paper border-ink-line rounded-xl border p-4">
      <div className="bg-ink-line mb-4 h-4 w-24 animate-pulse rounded" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border-ink-line flex gap-3 border-b py-3 last:border-0">
          <div className="bg-ink-line h-4 w-4 flex-shrink-0 animate-pulse rounded" />
          <div className="bg-ink-line h-4 w-2/3 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Create dashboard-stats.tsx**

Extract just the stats queries (customersTotal, customersActive, leadsTotal, openLeads, tasksOpen, tasksOverdue, tasksDueToday, meetingsToday, activitiesThisWeek, leadsWon) and the stats grid JSX from the current page into this component.

```tsx
// otto-app/app/(app)/dashboard/dashboard-stats.tsx
import { createClient } from "@/lib/supabase/server";
// ... import icons used by stats cards from current page

export async function DashboardStats() {
  const supabase = await createClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayDateStr = startOfToday.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    { count: customersTotal },
    { count: customersActive },
    { count: leadsTotal },
    { data: openLeads },
    { count: tasksOpen },
    { count: tasksOverdue },
    { count: tasksDueToday },
    { count: meetingsToday },
    { count: activitiesThisWeek },
    { data: leadsWon },
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("value, status").not("status", "in", '("won","lost")'),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "open").lt("due_date", todayDateStr),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "open").eq("due_date", todayDateStr),
    supabase.from("events").select("*", { count: "exact", head: true }).gte("start_time", startOfToday.toISOString()),
    supabase.from("activity_feed").select("*", { count: "exact", head: true }).gte("occurred_at", sevenDaysAgo.toISOString()),
    supabase.from("leads").select("value").eq("status", "won").gte("updated_at", sevenDaysAgo.toISOString()),
  ]);

  // ... copy the stats grid JSX from the current page.tsx here
  // The JSX is the <div className="grid grid-cols-2 ..."> section
  return (
    // paste the stats JSX from current page.tsx
    <></>
  );
}
```

> **Note to implementer:** Copy the exact queries and JSX for the stats grid section from `page.tsx`. Don't change the logic — just move it.

**Step 4: Create dashboard-activity.tsx**

```tsx
// otto-app/app/(app)/dashboard/dashboard-activity.tsx
import { createClient } from "@/lib/supabase/server";
import { relativeTimeHebrew } from "@/lib/relative-time";
// import icons used in activity feed

export async function DashboardActivity() {
  const supabase = await createClient();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentActivities } = await supabase
    .from("activity_feed")
    .select(`id, type, title, occurred_at, created_at, customer_id, lead_id,
      customers(id, name), leads(id, name)`)
    .gte("occurred_at", sevenDaysAgo.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(10);

  // ... copy the activity feed JSX from current page.tsx
  return (
    <></>
  );
}
```

**Step 5: Create dashboard-tasks.tsx**

```tsx
// otto-app/app/(app)/dashboard/dashboard-tasks.tsx
import { createClient } from "@/lib/supabase/server";
// import icons

export async function DashboardTasks() {
  const supabase = await createClient();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayDateStr = startOfToday.toISOString().slice(0, 10);

  const { data: todayTasks } = await supabase
    .from("tasks")
    .select(`id, title, due_date, customer_id, lead_id,
      customers(id, name), leads(id, name)`)
    .eq("status", "open")
    .lte("due_date", todayDateStr)
    .order("due_date", { ascending: true })
    .limit(5);

  // ... copy today's tasks JSX from current page.tsx
  return (
    <></>
  );
}
```

**Step 6: Rewrite dashboard page.tsx to use streaming**

Replace the entire page.tsx with a streaming version:

```tsx
// otto-app/app/(app)/dashboard/page.tsx
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardStats } from "./dashboard-stats";
import { DashboardActivity } from "./dashboard-activity";
import { DashboardTasks } from "./dashboard-tasks";
import { StatsGridSkeleton, ActivitySkeleton, TasksSkeleton } from "./dashboard-skeletons";

export const metadata = { title: "דשבורד — OTTO" };

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "בוקר טוב";
  if (hour < 17) return "צהריים טובים";
  return "ערב טוב";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("full_name, email").single();
  const { data: tenant } = await supabase.from("tenants").select("name").single();

  const displayName = profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "";

  return (
    <div className="space-y-6 p-6">
      {/* Header — renders immediately, no data dependency */}
      <div>
        <h1 className="text-navy text-2xl font-bold">
          {getGreeting()}{displayName ? `, ${displayName}` : ""}
        </h1>
        {tenant?.name && (
          <p className="text-ink-soft text-sm">{tenant.name}</p>
        )}
      </div>

      {/* Stats grid — streams independently */}
      <Suspense fallback={<StatsGridSkeleton />}>
        <DashboardStats />
      </Suspense>

      {/* Bottom section — two columns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<ActivitySkeleton />}>
          <DashboardActivity />
        </Suspense>

        <Suspense fallback={<TasksSkeleton />}>
          <DashboardTasks />
        </Suspense>
      </div>
    </div>
  );
}
```

**Step 7: Verify typecheck and build**

```bash
cd otto-app && npm run typecheck && npm run build
```

Expected: clean build with no errors.

**Step 8: Commit**

```bash
git add otto-app/app/(app)/dashboard/
git commit -m "perf(dashboard): stream stats, activity and tasks independently with Suspense"
```

---

## Task 4: Streaming pattern for customers list page

Apply the same streaming pattern to customers. This serves as the template for other list pages (tasks, hour-banks, recordings).

**Files:**
- Modify: `otto-app/app/(app)/customers/page.tsx`
- Create: `otto-app/app/(app)/customers/customers-data.tsx`

**Step 1: Create customers-data.tsx**

Move the data-fetching logic from `page.tsx` into this new async component:

```tsx
// otto-app/app/(app)/customers/customers-data.tsx
import { createClient } from "@/lib/supabase/server";
import { CustomersList } from "./customers-list";

type Props = {
  searchParams: Promise<{ inactive?: string }>;
};

export async function CustomersData({ searchParams }: Props) {
  const { inactive } = await searchParams;
  const showInactive = inactive === "1";

  const supabase = await createClient();
  const query = supabase.from("customers").select("*").order("created_at", { ascending: false });

  if (!showInactive) {
    query.eq("active", true);
  }

  const { data: customers } = await query;

  return <CustomersList customers={customers ?? []} showInactive={showInactive} />;
}
```

**Step 2: Rewrite page.tsx to stream**

```tsx
// otto-app/app/(app)/customers/page.tsx
import { Suspense } from "react";
import { CustomersData } from "./customers-data";
import { CustomersListSkeleton } from "./loading"; // reuse existing skeleton

export const metadata = { title: "לקוחות — OTTO" };

export default function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string }>;
}) {
  return (
    <Suspense fallback={<CustomersListSkeleton />}>
      <CustomersData searchParams={searchParams} />
    </Suspense>
  );
}
```

> **Note:** Check `loading.tsx` to find the exported skeleton component name. If it's not exported as `CustomersListSkeleton`, adjust the import or export it.

**Step 3: Export the skeleton from loading.tsx**

Open `otto-app/app/(app)/customers/loading.tsx` and ensure the skeleton component is exported so `page.tsx` can import it:

```tsx
// loading.tsx should export the skeleton:
export function CustomersListSkeleton() { ... }

export default function Loading() {
  return <CustomersListSkeleton />;
}
```

**Step 4: Verify typecheck**

```bash
cd otto-app && npm run typecheck
```

**Step 5: Commit**

```bash
git add otto-app/app/(app)/customers/
git commit -m "perf(customers): stream list with Suspense for instant page shell"
```

---

## Task 5: Apply streaming pattern to remaining list pages

Apply the same pattern from Task 4 to:
- `otto-app/app/(app)/hour-banks/` — create `hour-banks-data.tsx`
- `otto-app/app/(app)/recordings/` — create `recordings-data.tsx`
- `otto-app/app/(app)/tasks/` — create `tasks-data.tsx`

For each page:
1. Read the existing `page.tsx` to understand the queries
2. Create `[module]-data.tsx` with the data-fetching logic
3. Rewrite `page.tsx` to use `<Suspense>` + the new data component
4. Export the skeleton from `loading.tsx`

Commit each page separately:
```bash
git commit -m "perf(hour-banks): stream list with Suspense"
git commit -m "perf(recordings): stream list with Suspense"
git commit -m "perf(tasks): stream list with Suspense"
```

---

## Verification

After all tasks:

1. **Run build:**
   ```bash
   cd otto-app && npm run build
   ```

2. **Manual test — navigation speed:**
   - Open the app in browser
   - Navigate between customers, tasks, dashboard
   - Skeletons should appear immediately on navigation
   - Dashboard cards should fill in progressively (not all at once)

3. **Manual test — dashboard streaming:**
   - Open dashboard
   - You should see stats skeleton → stats appear, activity skeleton → activity appears, tasks skeleton → tasks appear (roughly simultaneously but independently)

4. **Verify no regressions:**
   - Customers list shows correctly
   - Filtering by inactive customers still works
   - Dashboard numbers are correct

---

## Summary of changes

| File | Change |
|------|--------|
| `app/(app)/layout.tsx` | Parallel `getUser` + profile queries |
| `components/layout/sidebar.tsx` | `prefetch={true}` on all nav links |
| `app/(app)/dashboard/page.tsx` | Rewritten to stream 3 sections |
| `app/(app)/dashboard/dashboard-stats.tsx` | New — stats grid |
| `app/(app)/dashboard/dashboard-activity.tsx` | New — activity feed |
| `app/(app)/dashboard/dashboard-tasks.tsx` | New — today's tasks |
| `app/(app)/dashboard/dashboard-skeletons.tsx` | New — skeleton components |
| `app/(app)/customers/page.tsx` | Uses Suspense streaming |
| `app/(app)/customers/customers-data.tsx` | New — data-fetching component |
| `app/(app)/hour-banks/`, `recordings/`, `tasks/` | Same Suspense pattern |
