import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportDetail } from "./report-detail";
import type { ReportData } from "../actions";

export const metadata = { title: "דוח — OTTO" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: report } = await supabase
    .from("reports")
    .select("*, customers(id, name, company, email)")
    .eq("id", id)
    .single();

  if (!report) notFound();

  const reportData = (report.data ?? {}) as ReportData;

  return <ReportDetail report={report} reportData={reportData} />;
}
