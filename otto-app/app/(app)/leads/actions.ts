"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const LeadSchema = z.object({
  name: z.string().min(1, "שם חובה"),
  email: z.string().email("אימייל לא תקין").optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  value: z.string().optional(),
  notes: z.string().optional(),
});

export type LeadFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function createLead(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    company: formData.get("company") as string,
    source: formData.get("source") as string,
    value: formData.get("value") as string,
    notes: formData.get("notes") as string,
  };

  const parsed = LeadSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("tenant_id").single();
  if (!profile) return { error: "לא מחובר" };

  const valueNum = parsed.data.value ? parseFloat(parsed.data.value) : null;

  const { error } = await supabase.from("leads").insert({
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    company: parsed.data.company || null,
    source: parsed.data.source || null,
    value: isNaN(valueNum!) ? null : valueNum,
    notes: parsed.data.notes || null,
    tenant_id: profile.tenant_id,
  });

  if (error) return { error: error.message };

  revalidatePath("/leads");
  return { success: true };
}

export async function updateLead(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const id = formData.get("id") as string;
  if (!id) return { error: "חסר id" };

  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    company: formData.get("company") as string,
    source: formData.get("source") as string,
    value: formData.get("value") as string,
    notes: formData.get("notes") as string,
  };

  const parsed = LeadSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("tenant_id").single();
  if (!profile) return { error: "לא מחובר" };

  const valueNum = parsed.data.value ? parseFloat(parsed.data.value) : null;
  const status = (formData.get("status") as string) || undefined;

  const { error } = await supabase
    .from("leads")
    .update({
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      company: parsed.data.company || null,
      source: parsed.data.source || null,
      value: valueNum != null && !isNaN(valueNum) ? valueNum : null,
      notes: parsed.data.notes || null,
      ...(status ? { status } : {}),
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return { success: true };
}

export async function updateLeadStatus(id: string, status: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("tenant_id").single();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return {};
}

export async function convertLeadToCustomer(
  leadId: string,
): Promise<{ error?: string; customerId?: string }> {
  const supabase = await createClient();

  // RPC אטומית — כל השינויים בעסקה אחת ב-DB
  const { data, error } = await supabase.rpc("convert_lead_to_customer", { p_lead_id: leadId });

  if (error) {
    if (error.code === "P0002") return { error: "ליד זה כבר הומר ללקוח" };
    if (error.code === "P0001") return { error: "ליד לא נמצא" };
    return { error: error.message };
  }
  const customerId = data as unknown as string;
  if (!customerId) return { error: "כשל בהמרה" };

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return { customerId };
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export async function exportLeadsCsv(): Promise<
  { csv: string; filename: string } | { error: string }
> {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("tenant_id").single();
  if (!profile) return { error: "לא מחובר" };

  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  const headers = ["שם", "חברה", "אימייל", "טלפון", "מקור", "סטטוס", "ערך", "הערות", "תאריך יצירה"];

  const rows = (leads ?? []).map((l) =>
    [
      l.name,
      l.company,
      l.email,
      l.phone,
      l.source,
      l.status,
      l.value,
      l.notes,
      formatDate(l.created_at),
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  const csv = "﻿" + [headers.map(escapeCsvCell).join(","), ...rows].join("\r\n");
  const filename = `otto-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  return { csv, filename };
}

export async function deleteLead(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("tenant_id").single();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/leads");
  return {};
}
