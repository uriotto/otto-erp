import { createClient } from "@/lib/supabase/server";
import { CustomersList } from "./customers-list";

type Props = {
  searchParams: Promise<{ inactive?: string }>;
};

export async function CustomersData({ searchParams }: Props) {
  const { inactive } = await searchParams;
  const showInactive = inactive === "1";

  const supabase = await createClient();
  const base = supabase.from("customers").select("*").order("created_at", { ascending: false });
  const { data: customers } = await (showInactive ? base : base.eq("active", true));

  return <CustomersList customers={customers ?? []} showInactive={showInactive} />;
}
