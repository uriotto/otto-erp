import { createClient } from "@/lib/supabase/server";
import { MarketingBoard } from "./marketing-board";

export const metadata = { title: "שיווק — OTTO" };

export default async function MarketingPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("marketing_content")
    .select("*")
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  return <MarketingBoard items={data ?? []} />;
}
