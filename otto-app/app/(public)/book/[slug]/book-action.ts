"use server";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const BookingSchema = z.object({
  bookingTypeId: z.string().uuid("מזהה שגוי"),
  startAt: z.string().min(1, "שעה חובה"),
  name: z.string().min(1, "שם חובה").max(120),
  email: z.string().email("אימייל לא תקין"),
  phone: z.string().max(30).optional(),
  notes: z.string().max(500).optional(),
});

export type BookingResult =
  | { ok: true; startAt: string; endAt: string; title: string }
  | { ok: false; error: string };

export async function createBooking(input: {
  bookingTypeId: string;
  startAt: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}): Promise<BookingResult> {
  const parsed = BookingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: Object.values(parsed.error.flatten().fieldErrors).flat().join(", "),
    };
  }

  const supabase = serviceClient();

  // שלוף את ה-booking type כדי לקבל tenant_id ומשך
  const { data: bt, error: btError } = await supabase
    .from("booking_types")
    .select("id, tenant_id, title, duration_minutes, is_active")
    .eq("id", parsed.data.bookingTypeId)
    .single();

  if (btError || !bt) return { ok: false, error: "סוג הפגישה לא נמצא" };
  if (!bt.is_active) return { ok: false, error: "קישור ההזמנה אינו פעיל" };

  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(startAt.getTime() + bt.duration_minutes * 60 * 1000);

  // בדוק שאין חפיפה עם אירועים קיימים (events)
  const { data: conflicts } = await supabase
    .from("events")
    .select("id")
    .eq("tenant_id", bt.tenant_id)
    .lt("start_at", endAt.toISOString())
    .gt("end_at", startAt.toISOString())
    .limit(1);

  if (conflicts && conflicts.length > 0) {
    return { ok: false, error: "השעה הזאת כבר תפוסה, אנא בחר שעה אחרת" };
  }

  // בדוק גם חפיפה עם booking_slots קיימים
  const { data: slotConflicts } = await supabase
    .from("booking_slots")
    .select("id")
    .eq("tenant_id", bt.tenant_id)
    .eq("status", "confirmed")
    .lt("start_at", endAt.toISOString())
    .gt("end_at", startAt.toISOString())
    .limit(1);

  if (slotConflicts && slotConflicts.length > 0) {
    return { ok: false, error: "השעה הזאת כבר תפוסה, אנא בחר שעה אחרת" };
  }

  // צור את ה-booking slot
  const { error: insertError } = await supabase.from("booking_slots").insert({
    tenant_id: bt.tenant_id,
    booking_type_id: bt.id,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    guest_name: parsed.data.name,
    guest_email: parsed.data.email,
    guest_phone: parsed.data.phone ?? null,
    notes: parsed.data.notes ?? null,
    status: "confirmed",
  });

  if (insertError) return { ok: false, error: "אירעה שגיאה, נסה שוב" };

  return {
    ok: true,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    title: bt.title,
  };
}

export type BookingTypePublic = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  color: string;
  tenant_id: string;
};

export async function getBookingTypeBySlug(slug: string): Promise<BookingTypePublic | null> {
  const supabase = serviceClient();

  const { data, error } = await supabase
    .from("booking_types")
    .select("id, title, description, duration_minutes, color, tenant_id, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getBusySlots(
  tenantId: string,
  dateFrom: string,
  dateTo: string,
): Promise<string[]> {
  const supabase = serviceClient();

  const [eventsRes, slotsRes] = await Promise.all([
    supabase
      .from("events")
      .select("start_at, end_at")
      .eq("tenant_id", tenantId)
      .gte("start_at", dateFrom)
      .lte("start_at", dateTo),
    supabase
      .from("booking_slots")
      .select("start_at, end_at")
      .eq("tenant_id", tenantId)
      .eq("status", "confirmed")
      .gte("start_at", dateFrom)
      .lte("start_at", dateTo),
  ]);

  const busy: string[] = [];

  for (const ev of eventsRes.data ?? []) {
    busy.push(`${ev.start_at}|${ev.end_at}`);
  }
  for (const sl of slotsRes.data ?? []) {
    busy.push(`${sl.start_at}|${sl.end_at}`);
  }

  return busy;
}
