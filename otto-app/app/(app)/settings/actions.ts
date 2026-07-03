"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { cancelPushChannel } from "@/lib/google-calendar";

type ActionResult<T = unknown> = { error?: string; data?: T };

async function getCurrentTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" as const };

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "פרופיל לא נמצא" as const };
  return { supabase, tenantId: profile.tenant_id, role: profile.role };
}

const ProfileSchema = z.object({
  full_name: z.string().min(1, "שם חובה").max(120, "שם ארוך מדי"),
});

const TenantSchema = z.object({
  name: z.string().min(1, "שם המותג חובה").max(120, "שם ארוך מדי"),
});

export type SettingsFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function updateProfile(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const raw = {
    full_name: (formData.get("full_name") as string) ?? "",
  };

  const parsed = ProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("users")
    .update({ full_name: parsed.data.full_name })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}

export type TagUsage = {
  name: string;
  customers: number;
  leads: number;
};

export async function listTagsUsage(): Promise<ActionResult<TagUsage[]>> {
  const ctx = await getCurrentTenant();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, tenantId } = ctx;

  const [{ data: customers, error: cErr }, { data: leads, error: lErr }] = await Promise.all([
    supabase.from("customers").select("tags").eq("tenant_id", tenantId),
    supabase.from("leads").select("tags").eq("tenant_id", tenantId),
  ]);

  if (cErr) return { error: cErr.message };
  if (lErr) return { error: lErr.message };

  const counts = new Map<string, { customers: number; leads: number }>();
  for (const row of customers ?? []) {
    for (const tag of row.tags ?? []) {
      const entry = counts.get(tag) ?? { customers: 0, leads: 0 };
      counts.set(tag, { ...entry, customers: entry.customers + 1 });
    }
  }
  for (const row of leads ?? []) {
    for (const tag of row.tags ?? []) {
      const entry = counts.get(tag) ?? { customers: 0, leads: 0 };
      counts.set(tag, { ...entry, leads: entry.leads + 1 });
    }
  }

  const result: TagUsage[] = Array.from(counts.entries())
    .map(([name, c]) => ({ name, customers: c.customers, leads: c.leads }))
    .sort(
      (a, b) =>
        b.customers + b.leads - (a.customers + a.leads) || a.name.localeCompare(b.name, "he"),
    );

  return { data: result };
}

const TagNameSchema = z.string().trim().min(1, "שם תג חובה").max(64, "שם תג ארוך מדי");

export async function renameTag(oldName: string, newName: string): Promise<ActionResult> {
  const oldParsed = TagNameSchema.safeParse(oldName);
  const newParsed = TagNameSchema.safeParse(newName);
  if (!oldParsed.success) return { error: "שם תג קיים לא תקין" };
  if (!newParsed.success)
    return { error: newParsed.error.issues[0]?.message ?? "שם תג חדש לא תקין" };
  if (oldParsed.data === newParsed.data) return {};

  const ctx = await getCurrentTenant();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, tenantId } = ctx;

  const renameInTable = async (table: "customers" | "leads") => {
    const { data, error } = await supabase
      .from(table)
      .select("id, tags")
      .eq("tenant_id", tenantId)
      .contains("tags", [oldParsed.data]);
    if (error) return error.message;
    for (const row of data ?? []) {
      const next = Array.from(
        new Set((row.tags ?? []).map((t: string) => (t === oldParsed.data ? newParsed.data : t))),
      );
      const { error: uErr } = await supabase
        .from(table)
        .update({ tags: next })
        .eq("id", row.id)
        .eq("tenant_id", tenantId);
      if (uErr) return uErr.message;
    }
    return null;
  };

  const cErr = await renameInTable("customers");
  if (cErr) return { error: cErr };
  const lErr = await renameInTable("leads");
  if (lErr) return { error: lErr };

  revalidatePath("/settings");
  revalidatePath("/customers");
  revalidatePath("/leads");
  return {};
}

export async function deleteTagEverywhere(name: string): Promise<ActionResult> {
  const parsed = TagNameSchema.safeParse(name);
  if (!parsed.success) return { error: "שם תג לא תקין" };

  const ctx = await getCurrentTenant();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, tenantId } = ctx;

  const removeFromTable = async (table: "customers" | "leads") => {
    const { data, error } = await supabase
      .from(table)
      .select("id, tags")
      .eq("tenant_id", tenantId)
      .contains("tags", [parsed.data]);
    if (error) return error.message;
    for (const row of data ?? []) {
      const next = (row.tags ?? []).filter((t: string) => t !== parsed.data);
      const { error: uErr } = await supabase
        .from(table)
        .update({ tags: next })
        .eq("id", row.id)
        .eq("tenant_id", tenantId);
      if (uErr) return uErr.message;
    }
    return null;
  };

  const cErr = await removeFromTable("customers");
  if (cErr) return { error: cErr };
  const lErr = await removeFromTable("leads");
  if (lErr) return { error: lErr };

  revalidatePath("/settings");
  revalidatePath("/customers");
  revalidatePath("/leads");
  return {};
}

export async function deleteAllCustomers(): Promise<ActionResult<{ count: number }>> {
  const ctx = await getCurrentTenant();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, tenantId, role } = ctx;
  if (role !== "admin") return { error: "רק מנהלים יכולים למחוק את כל הלקוחות" };

  const { data, error } = await supabase
    .from("customers")
    .delete()
    .eq("tenant_id", tenantId)
    .select("id");

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  return { data: { count: data?.length ?? 0 } };
}

export async function deleteAllLeads(): Promise<ActionResult<{ count: number }>> {
  const ctx = await getCurrentTenant();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, tenantId, role } = ctx;
  if (role !== "admin") return { error: "רק מנהלים יכולים למחוק את כל הלידים" };

  const { data, error } = await supabase
    .from("leads")
    .delete()
    .eq("tenant_id", tenantId)
    .select("id");

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { data: { count: data?.length ?? 0 } };
}

export type ExportPayload = {
  exported_at: string;
  tenant: { id: string; name: string; slug: string } | null;
  customers: unknown[];
  leads: unknown[];
  activities: unknown[];
  tags: TagUsage[];
};

export async function exportAllData(): Promise<ActionResult<ExportPayload>> {
  const ctx = await getCurrentTenant();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, tenantId } = ctx;

  const [tenantRes, customersRes, leadsRes, activitiesRes, tagsRes] = await Promise.all([
    supabase.from("tenants").select("id, name, slug").eq("id", tenantId).single(),
    supabase.from("customers").select("*").eq("tenant_id", tenantId),
    supabase.from("leads").select("*").eq("tenant_id", tenantId),
    supabase.from("activities").select("*").eq("tenant_id", tenantId),
    listTagsUsage(),
  ]);

  if (customersRes.error) return { error: customersRes.error.message };
  if (leadsRes.error) return { error: leadsRes.error.message };
  if (activitiesRes.error) return { error: activitiesRes.error.message };

  return {
    data: {
      exported_at: new Date().toISOString(),
      tenant: tenantRes.data ?? null,
      customers: customersRes.data ?? [],
      leads: leadsRes.data ?? [],
      activities: activitiesRes.data ?? [],
      tags: tagsRes.data ?? [],
    },
  };
}

const BillingSettingsSchema = z.object({
  default_hourly_rate: z.coerce
    .number()
    .positive("התעריף חייב להיות גדול מ-0")
    .max(100000, "ערך גבוה מדי"),
  default_alert_threshold_pct: z.coerce
    .number()
    .int("חייב להיות מספר שלם")
    .min(0, "חייב להיות 0 ומעלה")
    .max(100, "מקסימום 100%"),
  default_alert_threshold_hours: z.coerce
    .number()
    .min(0, "חייב להיות 0 ומעלה")
    .max(10000, "ערך גבוה מדי"),
  default_hour_bank_expiry_months: z.coerce
    .number()
    .int("חייב להיות מספר שלם")
    .min(1, "מינימום חודש אחד")
    .max(120, "מקסימום 120 חודשים"),
  auto_absorb_overage_default: z.coerce.boolean(),
});

export type BillingSettingsInput = z.input<typeof BillingSettingsSchema>;

export type BillingSettings = {
  default_hourly_rate: number;
  default_alert_threshold_pct: number;
  default_alert_threshold_hours: number;
  default_hour_bank_expiry_months: number;
  auto_absorb_overage_default: boolean;
};

export async function getBillingSettings(): Promise<ActionResult<BillingSettings>> {
  const ctx = await getCurrentTenant();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, tenantId } = ctx;

  const { data, error } = await supabase
    .from("tenant_settings")
    .select(
      "default_hourly_rate, default_alert_threshold_pct, default_alert_threshold_hours, default_hour_bank_expiry_months, auto_absorb_overage_default",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) return { error: error.message };

  return {
    data: {
      default_hourly_rate: Number(data?.default_hourly_rate ?? 425),
      default_alert_threshold_pct: Number(data?.default_alert_threshold_pct ?? 30),
      default_alert_threshold_hours: Number(data?.default_alert_threshold_hours ?? 3),
      default_hour_bank_expiry_months: Number(data?.default_hour_bank_expiry_months ?? 12),
      auto_absorb_overage_default: Boolean(data?.auto_absorb_overage_default ?? true),
    },
  };
}

export async function updateBillingSettings(
  input: Partial<BillingSettingsInput>,
): Promise<ActionResult<BillingSettings>> {
  const ctx = await getCurrentTenant();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, tenantId, role } = ctx;
  if (role !== "admin") return { error: "רק מנהלים יכולים לעדכן הגדרות חיוב" };

  const parsed = BillingSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "ערכים לא תקינים" };
  }

  const { error } = await supabase.from("tenant_settings").upsert(
    {
      tenant_id: tenantId,
      default_hourly_rate: parsed.data.default_hourly_rate,
      default_alert_threshold_pct: parsed.data.default_alert_threshold_pct,
      default_alert_threshold_hours: parsed.data.default_alert_threshold_hours,
      default_hour_bank_expiry_months: parsed.data.default_hour_bank_expiry_months,
      auto_absorb_overage_default: parsed.data.auto_absorb_overage_default,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/hour-banks");

  return await getBillingSettings();
}

export async function updateTenant(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const raw = {
    name: (formData.get("name") as string) ?? "",
  };

  const parsed = TenantSchema.safeParse(raw);
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
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "פרופיל לא נמצא" };
  if (profile.role !== "admin") return { error: "רק מנהלים יכולים לעדכן את המותג" };

  const { error } = await supabase
    .from("tenants")
    .update({ name: parsed.data.name })
    .eq("id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function resyncGoogleCalendar(): Promise<ActionResult<{ events: number }>> {
  const result = await getCurrentTenant();
  if ("error" in result) return { error: result.error };
  const { tenantId } = result;

  const { cancelPushChannel, registerPushChannel, importAllEvents, upsertGoogleEventsToOtto } =
    await import("@/lib/google-calendar");

  try {
    // Re-register push channel to ensure it's fresh
    try {
      await cancelPushChannel(tenantId);
    } catch {
      // Ignore errors — channel may already be gone
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    await registerPushChannel(tenantId, `${appUrl}/api/calendar/sync`);

    // Re-import all events — this paginated version saves the sync token properly
    const googleEvents = await importAllEvents(tenantId);
    await upsertGoogleEventsToOtto(tenantId, googleEvents);

    revalidatePath("/calendar");
    return { data: { events: googleEvents.length } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "סנכרון נכשל" };
  }
}

export async function disconnectGoogleCalendar(): Promise<ActionResult> {
  const result = await getCurrentTenant();
  if ("error" in result) return { error: result.error };
  const { supabase, tenantId, role } = result;

  if (role !== "admin") return { error: "רק מנהלים יכולים לנתק אינטגרציות" };

  try {
    await cancelPushChannel(tenantId);
  } catch (err) {
    console.error("Google push channel cancel failed:", err);
  }

  const { error } = await supabase
    .from("tenant_settings")
    .update({
      google_refresh_token: null,
      google_access_token: null,
      google_token_expiry: null,
      google_sync_token: null,
      google_channel_id: null,
      google_channel_resource_id: null,
    })
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { data: true };
}
