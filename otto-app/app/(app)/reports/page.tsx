import { createClient } from "@/lib/supabase/server";
import { ReportsList } from "./reports-list";

export const metadata = { title: "דוחות — OTTO" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const { status, type } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("reports")
    .select(
      "id, title, type, status, period_start, period_end, visible_to_client, created_at, approved_at, customer_id, customers(name, company)",
    )
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);

  const { data: reports } = await query;

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, company")
    .eq("active", true)
    .order("name");

  return (
    <ReportsList
      reports={(reports ?? []) as ReportListItem[]}
      customers={customers ?? []}
      activeStatus={status ?? ""}
      activeType={type ?? ""}
    />
  );
}

export type ReportListItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  period_start: string;
  period_end: string;
  visible_to_client: boolean;
  created_at: string;
  approved_at: string | null;
  customer_id: string | null;
  customers: { name: string; company: string | null } | null;
};
