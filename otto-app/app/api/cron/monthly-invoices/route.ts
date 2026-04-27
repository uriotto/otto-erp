import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { fireMakeWebhook } from "@/lib/make-webhook";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function prevMonthRange(): { start: string; end: string; label: string } {
  const now = new Date();
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const m = now.getMonth() === 0 ? 12 : now.getMonth();
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const label = new Date(y, m - 1, 1).toLocaleDateString("he-IL", {
    month: "long",
    year: "numeric",
  });
  return { start, end, label };
}

function dueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

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

  const { start, end, label } = prevMonthRange();
  const today = new Date().toISOString().slice(0, 10);
  const due = dueDate();

  // Get all tenants
  const { data: tenants } = await admin.from("tenant_settings").select("tenant_id");
  if (!tenants || tenants.length === 0) {
    return NextResponse.json({ ok: true, invoices_created: 0 });
  }

  let totalCreated = 0;
  const errors: string[] = [];

  for (const { tenant_id } of tenants) {
    // Get a user for this tenant (for created_by)
    const { data: user } = await admin
      .from("users")
      .select("id")
      .eq("tenant_id", tenant_id)
      .limit(1)
      .maybeSingle();
    if (!user) continue;

    // Get settings for default rate
    const { data: settings } = await admin
      .from("tenant_settings")
      .select("default_hourly_rate")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    const defaultRate = Number(settings?.default_hourly_rate ?? 400);

    // --- HOURLY customers ---
    const { data: hourlyCusts } = await admin
      .from("customers")
      .select("id, name, company, email, hourly_rate_override")
      .eq("tenant_id", tenant_id)
      .eq("billing_model_default", "hourly")
      .eq("status", "active");

    for (const cust of hourlyCusts ?? []) {
      const rate = cust.hourly_rate_override ? Number(cust.hourly_rate_override) : defaultRate;

      const { data: entries } = await admin
        .from("time_entries")
        .select("id, duration_minutes, notes")
        .eq("tenant_id", tenant_id)
        .eq("customer_id", cust.id)
        .eq("billable", true)
        .eq("billing_status", "pending")
        .gte("start_time", `${start}T00:00:00+00:00`)
        .lte("start_time", `${end}T23:59:59+00:00`);

      if (!entries || entries.length === 0) continue;

      const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
      const hours = Math.round((totalMinutes / 60) * 100) / 100;
      if (hours <= 0) continue;

      const subtotal = Math.round(hours * rate * 100) / 100;

      try {
        const { data: invoice, error: invErr } = await admin
          .from("invoices")
          .insert({
            tenant_id,
            created_by: user.id,
            customer_id: cust.id,
            type: "monthly_hours",
            status: "draft",
            issue_date: today,
            due_date: due,
            subtotal,
            tax_rate: 18,
            currency: "ILS",
            notes: `חיוב שעות — ${label}`,
          })
          .select("id, total_amount")
          .single();

        if (invErr || !invoice) {
          errors.push(`hourly ${cust.id}: ${invErr?.message}`);
          continue;
        }

        await admin.from("invoice_items").insert({
          invoice_id: invoice.id,
          description: `שעות עבודה — ${label} (${hours}h × ₪${rate})`,
          quantity: hours,
          unit_price: rate,
          order_index: 0,
        });

        // Link entries to invoice
        await admin
          .from("time_entries")
          .update({ invoice_id: invoice.id, billing_status: "invoiced" })
          .in(
            "id",
            entries.map((e) => e.id),
          );

        await fireMakeWebhook(tenant_id, "invoice.created", {
          invoice_id: invoice.id,
          type: "monthly_hours",
          status: "draft",
          issue_date: today,
          due_date: due,
          subtotal,
          tax_rate: 18,
          total_amount: invoice.total_amount,
          currency: "ILS",
          customer: { id: cust.id, name: cust.name, company: cust.company, email: cust.email },
          items: [{ description: `שעות עבודה — ${label}`, quantity: hours, unit_price: rate }],
          notes: `חיוב שעות — ${label}`,
        });

        totalCreated++;
      } catch (e) {
        errors.push(`hourly ${cust.id}: ${String(e)}`);
      }
    }

    // --- RETAINER customers ---
    const { data: retainerCusts } = await admin
      .from("customers")
      .select("id, name, company, email, retainer_monthly_amount")
      .eq("tenant_id", tenant_id)
      .eq("billing_model_default", "retainer")
      .eq("status", "active");

    for (const cust of retainerCusts ?? []) {
      const amount = cust.retainer_monthly_amount ? Number(cust.retainer_monthly_amount) : null;
      if (!amount || amount <= 0) continue;

      try {
        const { data: invoice, error: invErr } = await admin
          .from("invoices")
          .insert({
            tenant_id,
            created_by: user.id,
            customer_id: cust.id,
            type: "monthly_hours",
            status: "draft",
            issue_date: today,
            due_date: due,
            subtotal: amount,
            tax_rate: 18,
            currency: "ILS",
            notes: `ריטיינר חודשי — ${label}`,
          })
          .select("id, total_amount")
          .single();

        if (invErr || !invoice) {
          errors.push(`retainer ${cust.id}: ${invErr?.message}`);
          continue;
        }

        await admin.from("invoice_items").insert({
          invoice_id: invoice.id,
          description: `ריטיינר חודשי — ${label}`,
          quantity: 1,
          unit_price: amount,
          order_index: 0,
        });

        await fireMakeWebhook(tenant_id, "invoice.created", {
          invoice_id: invoice.id,
          type: "monthly_hours",
          status: "draft",
          issue_date: today,
          due_date: due,
          subtotal: amount,
          tax_rate: 18,
          total_amount: invoice.total_amount,
          currency: "ILS",
          customer: { id: cust.id, name: cust.name, company: cust.company, email: cust.email },
          items: [{ description: `ריטיינר חודשי — ${label}`, quantity: 1, unit_price: amount }],
          notes: `ריטיינר חודשי — ${label}`,
        });

        totalCreated++;
      } catch (e) {
        errors.push(`retainer ${cust.id}: ${String(e)}`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    invoices_created: totalCreated,
    period: { start, end },
    errors: errors.length > 0 ? errors : undefined,
  });
}
