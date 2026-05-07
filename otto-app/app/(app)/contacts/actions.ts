"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ContactSchema = z.object({
  name: z.string().min(1, "שם חובה"),
  role: z.string().optional(),
  email: z.string().email("אימייל לא תקין").optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
  customer_id: z.string().uuid().optional().or(z.literal("")),
});

export type ContactFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function createContact(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const raw = {
    name: formData.get("name") as string,
    role: formData.get("role") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    notes: formData.get("notes") as string,
    customer_id: formData.get("customer_id") as string,
  };

  const parsed = ContactSchema.safeParse(raw);
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
  if (!profile) return { error: "לא נמצא פרופיל משתמש" };

  const { error } = await supabase.from("contacts").insert({
    name: parsed.data.name,
    role: parsed.data.role || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    notes: parsed.data.notes || null,
    customer_id: parsed.data.customer_id || null,
    tenant_id: profile.tenant_id,
  });

  if (error) return { error: error.message };

  revalidatePath("/contacts");
  if (parsed.data.customer_id) revalidatePath(`/customers/${parsed.data.customer_id}`);
  return { success: true };
}

export async function updateContact(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const id = formData.get("id") as string;
  const raw = {
    name: formData.get("name") as string,
    role: formData.get("role") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    notes: formData.get("notes") as string,
    customer_id: formData.get("customer_id") as string,
  };

  const parsed = ContactSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      name: parsed.data.name,
      role: parsed.data.role || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
      customer_id: parsed.data.customer_id || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/contacts");
  if (parsed.data.customer_id) revalidatePath(`/customers/${parsed.data.customer_id}`);
  return { success: true };
}

export async function deleteContact(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contacts");
  return {};
}
