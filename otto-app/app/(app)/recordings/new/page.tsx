import { createClient } from "@/lib/supabase/server";
import { RecorderClient } from "./recorder-client";

export const metadata = { title: "הקלטה חדשה — OTTO" };

export default async function NewRecordingPage() {
  const supabase = await createClient();

  const [{ data: customers }, { data: projects }, { data: leads }] = await Promise.all([
    supabase.from("customers").select("id, name").eq("active", true).order("name"),
    supabase
      .from("projects")
      .select("id, name, customer_id")
      .in("status", ["active", "planning"])
      .order("name"),
    supabase.from("leads").select("id, name").not("status", "in", "(won,lost)").order("name"),
  ]);

  return (
    <RecorderClient customers={customers ?? []} projects={projects ?? []} leads={leads ?? []} />
  );
}
