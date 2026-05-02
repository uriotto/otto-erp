"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const EVENT_TYPES = ["meeting", "call", "deadline", "other"] as const;

const EventSchema = z.object({
  title: z.string().min(1, "כותרת חובה"),
  description: z.string().optional(),
  start_at: z.string().min(1, "תאריך התחלה חובה"),
  end_at: z.string().min(1, "תאריך סיום חובה"),
  all_day: z.boolean().default(false),
  location: z.string().optional(),
  type: z.enum(EVENT_TYPES).default("meeting"),
  customer_id: z.string().uuid().optional().or(z.literal("")),
  project_id: z.string().uuid().optional().or(z.literal("")),
});

export type EventFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  eventId?: string;
};

function nullIfEmpty(v: string | undefined): string | null {
  if (!v || v.trim().length === 0) return null;
  return v;
}

async function getTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null };
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, id")
    .eq("id", user.id)
    .single();
  return { supabase, profile };
}

export async function createEvent(
  _prev: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const raw = {
    ...Object.fromEntries(formData.entries()),
    all_day: formData.get("all_day") === "true",
  };

  const parsed = EventSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const d = parsed.data;

  const { data: ev, error } = await supabase
    .from("events")
    .insert({
      tenant_id: profile.tenant_id,
      title: d.title,
      description: nullIfEmpty(d.description),
      start_at: d.start_at,
      end_at: d.end_at,
      all_day: d.all_day,
      location: nullIfEmpty(d.location),
      type: d.type,
      customer_id: nullIfEmpty(d.customer_id),
      project_id: nullIfEmpty(d.project_id),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/calendar");
  return { success: true, eventId: ev.id };
}

export async function updateEvent(
  id: string,
  _prev: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const raw = {
    ...Object.fromEntries(formData.entries()),
    all_day: formData.get("all_day") === "true",
  };

  const parsed = EventSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const d = parsed.data;

  const { error } = await supabase
    .from("events")
    .update({
      title: d.title,
      description: nullIfEmpty(d.description),
      start_at: d.start_at,
      end_at: d.end_at,
      all_day: d.all_day,
      location: nullIfEmpty(d.location),
      type: d.type,
      customer_id: nullIfEmpty(d.customer_id),
      project_id: nullIfEmpty(d.project_id),
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteEvent(id: string): Promise<{ error?: string }> {
  const { supabase, profile } = await getTenant();
  if (!profile) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/calendar");
  return {};
}
