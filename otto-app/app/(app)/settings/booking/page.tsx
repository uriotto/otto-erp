import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BookingTypesList } from "./booking-types-list";

export const metadata = { title: "קישורי הזמנה — OTTO" };

export default async function BookingSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: bookingTypes } = await supabase
    .from("booking_types")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-start gap-4">
        <div className="bg-navy/8 rounded-xl p-2.5">
          <CalendarDays size={22} className="text-navy" />
        </div>
        <div>
          <p className="text-micro text-ink-faded mb-1 uppercase">הגדרות</p>
          <h1 className="text-display-md text-navy">קישורי הזמנה</h1>
          <p className="text-ink-soft mt-1 text-sm">
            צור סוגי פגישות ושתף לינק ישיר עם לקוחות — הם יוכלו לקבוע פגישה ישירות ביומן שלך.
          </p>
        </div>
      </div>

      <BookingTypesList initialTypes={bookingTypes ?? []} />
    </div>
  );
}
