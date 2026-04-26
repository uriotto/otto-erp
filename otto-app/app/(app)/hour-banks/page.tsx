import { createClient } from "@/lib/supabase/server";
import { HourBanksList, type HourBankListItem } from "./hour-banks-list";

export const metadata = { title: "בנקי שעות — OTTO" };

export default async function HourBanksPage() {
  const supabase = await createClient();

  const [{ data: banks }, { data: customers }, { data: settings }, { count: draftCount }] =
    await Promise.all([
      supabase
        .from("hour_banks_summary")
        .select("*")
        .neq("status", "draft")
        .order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name, hourly_rate_override").order("name"),
      supabase
        .from("tenant_settings")
        .select(
          "default_hourly_rate, default_alert_threshold_pct, default_alert_threshold_hours, default_hour_bank_expiry_months",
        )
        .maybeSingle(),
      supabase
        .from("hour_banks")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft"),
    ]);

  const customerMap = new Map((customers ?? []).map((c) => [c.id, c.name]));

  const items: HourBankListItem[] = (banks ?? []).map((b) => ({
    id: b.id ?? "",
    customer_id: b.customer_id,
    customer_name: b.customer_id ? (customerMap.get(b.customer_id) ?? null) : null,
    purchased_hours: b.purchased_hours == null ? 0 : Number(b.purchased_hours),
    consumed_hours: b.consumed_hours == null ? 0 : Number(b.consumed_hours),
    available_hours: b.available_hours == null ? 0 : Number(b.available_hours),
    hourly_rate: b.hourly_rate == null ? 0 : Number(b.hourly_rate),
    total_amount: b.total_amount == null ? 0 : Number(b.total_amount),
    purchase_date: b.purchase_date,
    expiry_date: b.expiry_date,
    status: (b.status ?? "active") as "draft" | "active" | "depleted" | "expired" | "cancelled",
    alert_threshold_pct: b.alert_threshold_pct == null ? 30 : Number(b.alert_threshold_pct),
    alert_threshold_hours: b.alert_threshold_hours == null ? 3 : Number(b.alert_threshold_hours),
    notes: b.notes,
  }));

  return (
    <HourBanksList
      banks={items}
      customers={customers ?? []}
      draftCount={draftCount ?? 0}
      defaultHourlyRate={
        settings?.default_hourly_rate != null ? Number(settings.default_hourly_rate) : 400
      }
      defaultExpiryMonths={settings?.default_hour_bank_expiry_months ?? 12}
      defaultAlertPct={settings?.default_alert_threshold_pct ?? 30}
      defaultAlertHours={
        settings?.default_alert_threshold_hours != null
          ? Number(settings.default_alert_threshold_hours)
          : 3
      }
    />
  );
}
