import { createClient } from "@/lib/supabase/server";
import { InvoicesList, type InvoiceListItem, type CustomerOption } from "./invoices-list";

export const metadata = { title: "חשבוניות — OTTO" };

export default async function InvoicesPage() {
  const supabase = await createClient();

  const [{ data: aging }, { data: customers }, { data: projects }, { data: hourBanks }] =
    await Promise.all([
      supabase
        .from("invoices_aging")
        .select("*")
        .order("issue_date", { ascending: false, nullsFirst: false }),
      supabase.from("customers").select("id, name, company").order("name"),
      supabase.from("projects").select("id, name, customer_id").order("name"),
      supabase
        .from("hour_banks")
        .select("id, customer_id, purchased_hours, hourly_rate, status")
        .eq("status", "active"),
    ]);

  const customerMap = new Map((customers ?? []).map((c) => [c.id, c]));

  const items: InvoiceListItem[] = (aging ?? []).map((row) => {
    const cust = row.customer_id ? customerMap.get(row.customer_id) : null;
    return {
      id: row.id ?? "",
      number: row.number,
      issue_date: row.issue_date,
      due_date: row.due_date,
      status: (row.status ?? "draft") as InvoiceListItem["status"],
      total_amount: row.total_amount == null ? 0 : Number(row.total_amount),
      paid_amount: row.paid_amount == null ? 0 : Number(row.paid_amount),
      days_overdue: row.days_overdue == null ? 0 : Number(row.days_overdue),
      age_bucket: (row.age_bucket ?? "current") as InvoiceListItem["age_bucket"],
      customer_id: row.customer_id,
      customer_name: cust?.name ?? null,
      customer_company: cust?.company ?? null,
    };
  });

  const customerOptions: CustomerOption[] = (customers ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
  }));

  const projectOptions = (projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    customer_id: p.customer_id,
  }));

  const hourBankOptions = (hourBanks ?? []).map((b) => ({
    id: b.id,
    customer_id: b.customer_id,
    purchased_hours: Number(b.purchased_hours ?? 0),
    hourly_rate: Number(b.hourly_rate ?? 0),
  }));

  return (
    <InvoicesList
      invoices={items}
      customers={customerOptions}
      projects={projectOptions}
      hourBanks={hourBankOptions}
    />
  );
}
