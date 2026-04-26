import { createClient } from "@/lib/supabase/server";
import { DraftRenewalsList, type DraftRenewalItem } from "./draft-renewals-list";

export const metadata = { title: "טיוטות חידוש — OTTO" };

export default async function DraftRenewalsPage() {
  const supabase = await createClient();

  const { data: drafts } = await supabase
    .from("hour_banks")
    .select(
      "id, customer_id, parent_bank_id, purchased_hours, hourly_rate, expiry_date, alert_threshold_pct, alert_threshold_hours, notes, created_at",
    )
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  const customerIds = Array.from(
    new Set((drafts ?? []).map((d) => d.customer_id).filter((v): v is string => Boolean(v))),
  );
  const parentIds = Array.from(
    new Set((drafts ?? []).map((d) => d.parent_bank_id).filter((v): v is string => Boolean(v))),
  );

  const [{ data: customers }, { data: parents }] = await Promise.all([
    customerIds.length > 0
      ? supabase.from("customers").select("id, name").in("id", customerIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    parentIds.length > 0
      ? supabase.from("hour_banks").select("id, purchased_hours, expiry_date").in("id", parentIds)
      : Promise.resolve({
          data: [] as { id: string; purchased_hours: number; expiry_date: string | null }[],
        }),
  ]);

  const customerMap = new Map((customers ?? []).map((c) => [c.id, c.name]));
  const parentMap = new Map((parents ?? []).map((p) => [p.id, p]));

  const items: DraftRenewalItem[] = (drafts ?? []).map((d) => {
    const parent = d.parent_bank_id ? parentMap.get(d.parent_bank_id) : null;
    return {
      id: d.id,
      customer_id: d.customer_id,
      customer_name: d.customer_id ? (customerMap.get(d.customer_id) ?? null) : null,
      parent_bank_id: d.parent_bank_id,
      parent_purchased_hours: parent ? Number(parent.purchased_hours) : null,
      parent_expiry_date: parent?.expiry_date ?? null,
      purchased_hours: Number(d.purchased_hours),
      hourly_rate: Number(d.hourly_rate),
      expiry_date: d.expiry_date,
      alert_threshold_pct: Number(d.alert_threshold_pct),
      alert_threshold_hours: Number(d.alert_threshold_hours),
      notes: d.notes,
      created_at: d.created_at,
    };
  });

  return <DraftRenewalsList drafts={items} />;
}
