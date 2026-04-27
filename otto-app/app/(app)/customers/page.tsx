import { createClient } from "@/lib/supabase/server";
import { CustomersList } from "./customers-list";

export const metadata = { title: "לקוחות — OTTO" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string }>;
}) {
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
