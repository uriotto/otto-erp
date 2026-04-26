import { createClient } from "@/lib/supabase/server";
import { LeadsBoard } from "./leads-board";

export const metadata = { title: "לידים — OTTO" };

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  return <LeadsBoard leads={leads ?? []} />;
}
