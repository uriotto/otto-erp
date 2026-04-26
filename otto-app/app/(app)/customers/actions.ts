"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CustomerSchema = z.object({
  name: z.string().min(1, "שם חובה"),
  email: z.string().email("אימייל לא תקין").optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  website: z.string().url("כתובת אתר לא תקינה").optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
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
    website: formData.get("website") as string,
    address: formData.get("address") as string,
    notes: formData.get("notes") as string,
  };

  const parsed = CustomerSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("tenant_id").single();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase.from("customers").insert({
    ...parsed.data,
    email: parsed.data.email || null,
    website: parsed.data.website || null,
    tenant_id: profile.tenant_id,
  });

  if (error) return { error: error.message };

  revalidatePath("/customers");
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
    website: formData.get("website") as string,
    address: formData.get("address") as string,
    notes: formData.get("notes") as string,
  };

  const parsed = CustomerSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("tenant_id").single();
  if (!profile) return { error: "לא מחובר" };

  const status = (formData.get("status") as string) || undefined;

  const { error } = await supabase
    .from("customers")
    .update({
      ...parsed.data,
      email: parsed.data.email || null,
      website: parsed.data.website || null,
      ...(status ? { status } : {}),
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: true };
}

export async function deleteCustomer(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("users").select("tenant_id").single();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/customers");
  return {};
}
