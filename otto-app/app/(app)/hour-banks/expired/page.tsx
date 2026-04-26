import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ExpiredBanksList, type ExpiredBankItem } from "./expired-banks-list";

export const metadata = { title: "בנקים שפגו תוקף — OTTO" };

export default async function ExpiredHourBanksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "admin";
  }

  const [{ data: banks }, { data: customers }] = await Promise.all([
    supabase
      .from("hour_banks_summary")
      .select("*")
      .eq("status", "expired")
      .order("expiry_date", { ascending: true }),
    supabase.from("customers").select("id, name"),
  ]);

  const customerMap = new Map((customers ?? []).map((c) => [c.id, c.name]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items: ExpiredBankItem[] = (banks ?? []).map((b) => {
    const expiry = b.expiry_date ? new Date(b.expiry_date) : null;
    const daysSinceExpired = expiry
      ? Math.max(0, Math.floor((today.getTime() - expiry.getTime()) / 86400000))
      : 0;

    return {
      id: b.id ?? "",
      customer_id: b.customer_id,
      customer_name: b.customer_id ? (customerMap.get(b.customer_id) ?? null) : null,
      purchased_hours: b.purchased_hours == null ? 0 : Number(b.purchased_hours),
      available_hours: b.available_hours == null ? 0 : Number(b.available_hours),
      expiry_date: b.expiry_date,
      days_since_expired: daysSinceExpired,
    };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <nav className="mb-4 flex items-center gap-1 text-sm" dir="rtl">
        <Link href="/hour-banks" className="text-ink-faded hover:text-navy">
          בנקי שעות
        </Link>
        <ChevronRight size={14} className="text-ink-faded rotate-180" />
        <span className="text-navy font-semibold">פגי תוקף</span>
      </nav>

      <div className="mb-6">
        <p className="text-micro text-ink-faded mb-2 uppercase">תפוגה</p>
        <h1 className="text-display-md text-navy">בנקים שפגו תוקף</h1>
        <p className="text-ink-soft mt-1 text-sm">
          {items.length === 0
            ? "אין כרגע בנקים שפגו תוקף"
            : `${items.length} בנקים פגי תוקף ממתינים לטיפול`}
        </p>
      </div>

      <ExpiredBanksList items={items} canRunCheck={isAdmin} />
    </div>
  );
}
