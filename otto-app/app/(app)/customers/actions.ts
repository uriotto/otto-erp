"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const BILLING_MODELS = ["hourly", "hour_bank", "fixed_price", "retainer"] as const;

const CustomerSchema = z.object({
  name: z.string().min(1, "שם חובה"),
  email: z.string().email("אימייל לא תקין").optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  company_registration_number: z.string().optional(),
  website: z.string().url("כתובת אתר לא תקינה").optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
  billing_model_default: z.enum(BILLING_MODELS).optional().nullable(),
  hourly_rate_override: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().positive().optional().nullable(),
  ),
  retainer_monthly_amount: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().positive().optional().nullable(),
  ),
});

export type CustomerFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function createCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    company: formData.get("company") as string,
    company_registration_number: formData.get("company_registration_number") as string,
    website: formData.get("website") as string,
    address: formData.get("address") as string,
    notes: formData.get("notes") as string,
    billing_model_default: (formData.get("billing_model_default") as string) || null,
    hourly_rate_override: formData.get("hourly_rate_override") as string,
    retainer_monthly_amount: formData.get("retainer_monthly_amount") as string,
  };

  const parsed = CustomerSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase.from("customers").insert({
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    company: parsed.data.company || null,
    company_registration_number: parsed.data.company_registration_number || null,
    website: parsed.data.website || null,
    address: parsed.data.address || null,
    notes: parsed.data.notes || null,
    billing_model_default: parsed.data.billing_model_default ?? null,
    hourly_rate_override: parsed.data.hourly_rate_override ?? null,
    retainer_monthly_amount: parsed.data.retainer_monthly_amount ?? null,
    tenant_id: profile.tenant_id,
  });

  if (error) return { error: error.message };

  revalidatePath("/customers");
  revalidatePath("/hour-banks");
  revalidatePath("/tasks");
  revalidatePath("/projects");
  revalidatePath("/time");
  return { success: true };
}

export async function updateCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const id = formData.get("id") as string;
  if (!id) return { error: "חסר id" };

  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    company: formData.get("company") as string,
    company_registration_number: formData.get("company_registration_number") as string,
    website: formData.get("website") as string,
    address: formData.get("address") as string,
    notes: formData.get("notes") as string,
    billing_model_default: (formData.get("billing_model_default") as string) || null,
    hourly_rate_override: formData.get("hourly_rate_override") as string,
    retainer_monthly_amount: formData.get("retainer_monthly_amount") as string,
  };

  const parsed = CustomerSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "לא מחובר" };

  const status = (formData.get("status") as string) || undefined;

  const portalEnabled = formData.get("portal_enabled") === "true";

  const { error } = await supabase
    .from("customers")
    .update({
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      company: parsed.data.company || null,
      company_registration_number: parsed.data.company_registration_number || null,
      website: parsed.data.website || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
      billing_model_default: parsed.data.billing_model_default ?? null,
      hourly_rate_override: parsed.data.hourly_rate_override ?? null,
      retainer_monthly_amount: parsed.data.retainer_monthly_amount ?? null,
      portal_enabled: portalEnabled,
      ...(status ? { status } : {}),
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  revalidatePath("/hour-banks");
  revalidatePath("/tasks");
  return { success: true };
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

export async function exportCustomersCsv(): Promise<
  { csv: string; filename: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "לא מחובר" };

  const { data: customers, error } = await supabase
    .from("customers")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  const headers = [
    "שם",
    "חברה",
    "אימייל",
    "טלפון",
    "אתר",
    "כתובת",
    "סטטוס",
    "תגיות",
    "הערות",
    "תאריך יצירה",
  ];

  const rows = (customers ?? []).map((c) =>
    [
      c.name,
      c.company,
      c.email,
      c.phone,
      c.website,
      c.address,
      c.status,
      (c.tags ?? []).join(", "),
      c.notes,
      formatDate(c.created_at),
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  const csv = "﻿" + [headers.map(escapeCsvCell).join(","), ...rows].join("\r\n");
  const filename = `otto-customers-${new Date().toISOString().slice(0, 10)}.csv`;
  return { csv, filename };
}

export async function quickUpdateCustomer(
  id: string,
  data: Partial<{
    name: string;
    email: string;
    phone: string;
    company: string;
    billing_model_default: string | null;
    hourly_rate_override: number | null;
    active: boolean;
    status: string;
  }>,
): Promise<{ error?: string }> {
  if (!id) return { error: "חסר id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "לא מחובר" };

  type CustomerUpdate = {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    billing_model_default?: string | null;
    hourly_rate_override?: number | null;
    active?: boolean;
    status?: string;
  };
  const updates: CustomerUpdate = {};
  if (data.name !== undefined) updates.name = data.name.trim() || null;
  if (data.email !== undefined) updates.email = data.email.trim() || null;
  if (data.phone !== undefined) updates.phone = data.phone.trim() || null;
  if (data.company !== undefined) updates.company = data.company.trim() || null;
  if (data.billing_model_default !== undefined)
    updates.billing_model_default = data.billing_model_default;
  if (data.hourly_rate_override !== undefined)
    updates.hourly_rate_override = data.hourly_rate_override;
  if (data.active !== undefined) updates.active = data.active;
  if (data.status !== undefined) updates.status = data.status;

  if (Object.keys(updates).length === 0) return {};

  const { error } = await supabase
    .from("customers")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updates as any)
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return {};
}

export async function deactivateCustomer(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("customers")
    .update({ active: false })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/customers");
  return {};
}

export async function reactivateCustomer(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("customers")
    .update({ active: true })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/customers");
  return {};
}

export async function bulkDeactivateCustomers(
  ids: string[],
  activate = false,
): Promise<{ error?: string; updated?: number }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: "לא נבחרו לקוחות" };
  }

  const cleanIds = ids.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (cleanIds.length === 0) {
    return { error: "מזהים לא תקינים" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("customers")
    .update({ active: activate ? true : false })
    .in("id", cleanIds)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/customers");
  return { updated: cleanIds.length };
}

export async function bulkDeleteCustomers(
  ids: string[],
): Promise<{ deleted: number; error?: string }> {
  if (ids.length === 0) return { deleted: 0 };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { deleted: 0, error: "לא מחובר" };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { deleted: 0, error: "לא מחובר" };

  const { error, count } = await supabase
    .from("customers")
    .delete({ count: "exact" })
    .in("id", ids)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { deleted: 0, error: error.message };
  revalidatePath("/customers");
  return { deleted: count ?? ids.length };
}
