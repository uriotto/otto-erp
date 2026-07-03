import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { ilMonthRange, ilMonthLabel } from "@/lib/dates";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Monthly billing review trigger (runs on the 1st).
 *
 * Policy (Uri, 2026-07): nothing is invoiced or sent automatically. The cron only
 * measures how much unbilled work each customer accumulated last month and sends
 * an in-app notification pointing at the billing-run screen, where Uri reviews
 * and issues each invoice explicitly (which is when Finbot is called).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  let authorized = false;
  try {
    authorized =
      token.length === secret.length && timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    authorized = false;
  }
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "missing supabase env" }, { status: 500 });
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { start, end } = ilMonthRange(new Date(), -1);
  const label = ilMonthLabel(start);

  const { data: tenants } = await admin.from("tenant_settings").select("tenant_id");
  if (!tenants || tenants.length === 0) {
    return NextResponse.json({ ok: true, notified_tenants: 0 });
  }

  let notified = 0;
  const errors: string[] = [];

  for (const { tenant_id } of tenants) {
    try {
      const { data: adminUser } = await admin
        .from("users")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("role", "admin")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!adminUser) continue;

      // Unbilled billable work from last month (pending + overage)
      const { data: entries } = await admin
        .from("time_entries")
        .select("customer_id, duration_minutes")
        .eq("tenant_id", tenant_id)
        .eq("billable", true)
        .in("billing_status", ["pending", "overage"])
        .not("customer_id", "is", null)
        .gte("start_time", start.toISOString())
        .lt("start_time", end.toISOString());

      const customerIds = new Set((entries ?? []).map((e) => e.customer_id));
      const totalMinutes = (entries ?? []).reduce((s, e) => s + (e.duration_minutes ?? 0), 0);

      // Retainer customers get a fixed monthly invoice - include them in the review
      const { count: retainerCount } = await admin
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant_id)
        .eq("billing_model_default", "retainer")
        .eq("status", "active")
        .gt("retainer_monthly_amount", 0);

      const customersToReview = customerIds.size + (retainerCount ?? 0);
      if (customersToReview === 0) continue;

      const hours = Math.round((totalMinutes / 60) * 10) / 10;
      await admin.from("notifications").insert({
        tenant_id,
        user_id: adminUser.id,
        severity: "info",
        title: `🧾 חיוב חודשי - ${label} מוכן לסקירה`,
        body: `${customerIds.size} לקוחות עם ${hours} שעות לא מחויבות${(retainerCount ?? 0) > 0 ? ` + ${retainerCount} ריטיינרים` : ""}. סקור והפק חשבוניות.`,
        link: "/billing-run",
      });
      notified++;
    } catch (e) {
      errors.push(`tenant ${tenant_id}: ${String(e)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    notified_tenants: notified,
    period: { start: start.toISOString(), end: end.toISOString() },
    errors: errors.length > 0 ? errors : undefined,
  });
}
