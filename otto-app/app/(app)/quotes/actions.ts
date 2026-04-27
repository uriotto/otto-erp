"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const QUOTE_STATUSES = ["draft", "sent", "signed", "rejected", "expired"] as const;

const QuoteSchema = z.object({
  title: z.string().min(1, "כותרת חובה"),
  customer_id: z.string().uuid("לקוח חובה"),
  project_id: z.string().uuid().optional().or(z.literal("")),
  amount: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().positive().optional().nullable(),
  ),
  status: z.enum(QUOTE_STATUSES).default("draft"),
  document_url: z.string().url("כתובת URL לא תקינה").optional().or(z.literal("")),
  notes: z.string().optional(),
  valid_until: z.string().optional().or(z.literal("")),
});

export type QuoteFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

async function getTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  return profile ? { supabase, tenant_id: profile.tenant_id } : null;
}

export async function createQuote(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const raw = {
    title: formData.get("title") as string,
    customer_id: formData.get("customer_id") as string,
    project_id: (formData.get("project_id") as string) || "",
    amount: formData.get("amount") as string,
    status: (formData.get("status") as string) || "draft",
    document_url: (formData.get("document_url") as string) || "",
    notes: formData.get("notes") as string,
    valid_until: (formData.get("valid_until") as string) || "",
  };

  const parsed = QuoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const ctx = await getTenant();
  if (!ctx) return { error: "לא מחובר" };

  const { error } = await ctx.supabase.from("quotes").insert({
    title: parsed.data.title,
    customer_id: parsed.data.customer_id,
    project_id: parsed.data.project_id || null,
    amount: parsed.data.amount ?? null,
    status: parsed.data.status,
    document_url: parsed.data.document_url || null,
    notes: parsed.data.notes || null,
    valid_until: parsed.data.valid_until || null,
    tenant_id: ctx.tenant_id,
  });

  if (error) return { error: error.message };

  revalidatePath("/quotes");
  if (parsed.data.project_id) revalidatePath(`/projects/${parsed.data.project_id}`);
  return { success: true };
}

export async function updateQuote(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const id = formData.get("id") as string;
  if (!id) return { error: "חסר id" };

  const raw = {
    title: formData.get("title") as string,
    customer_id: formData.get("customer_id") as string,
    project_id: (formData.get("project_id") as string) || "",
    amount: formData.get("amount") as string,
    status: (formData.get("status") as string) || "draft",
    document_url: (formData.get("document_url") as string) || "",
    notes: formData.get("notes") as string,
    valid_until: (formData.get("valid_until") as string) || "",
  };

  const parsed = QuoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const ctx = await getTenant();
  if (!ctx) return { error: "לא מחובר" };

  const statusUpdate =
    parsed.data.status === "signed"
      ? { status: "signed" as const, signed_at: new Date().toISOString() }
      : { status: parsed.data.status };

  const { error } = await ctx.supabase
    .from("quotes")
    .update({
      title: parsed.data.title,
      customer_id: parsed.data.customer_id,
      project_id: parsed.data.project_id || null,
      amount: parsed.data.amount ?? null,
      document_url: parsed.data.document_url || null,
      notes: parsed.data.notes || null,
      valid_until: parsed.data.valid_until || null,
      ...statusUpdate,
    })
    .eq("id", id)
    .eq("tenant_id", ctx.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/quotes");
  if (parsed.data.project_id) revalidatePath(`/projects/${parsed.data.project_id}`);
  return { success: true };
}

export async function deleteQuote(id: string): Promise<{ error?: string }> {
  const ctx = await getTenant();
  if (!ctx) return { error: "לא מחובר" };

  const { error } = await ctx.supabase
    .from("quotes")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenant_id);

  if (error) return { error: error.message };
  revalidatePath("/quotes");
  return {};
}
