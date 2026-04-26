import { createClient } from "@/lib/supabase/server";
import { CustomersList } from "./customers-list";

export const metadata = { title: "לקוחות — OTTO" };

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  return <CustomersList customers={customers ?? []} />;
}
