import { createClient } from "@/lib/supabase/server";
import { NewReportForm } from "./new-report-form";

export const metadata = { title: "דוח חדש — OTTO" };

export default async function NewReportPage() {
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, company")
    .eq("active", true)
    .order("name");

  return <NewReportForm customers={customers ?? []} />;
}
