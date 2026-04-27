import { getPortalCustomer } from "@/lib/portal";
import { Clock, AlertTriangle } from "lucide-react";

export const metadata = { title: "בנקי שעות — פורטל לקוחות" };

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("he-IL") : "—";
}

const BANK_STATUS_LABELS: Record<string, string> = {
  active: "פעיל",
  expired: "פג תוקף",
  depleted: "מוצה",
  cancelled: "מבוטל",
};

export default async function PortalHourBanksPage() {
  const { supabase, customer } = await getPortalCustomer();

  const { data: banks } = await supabase
    .from("hour_banks_summary")
    .select(
      "id, purchased_hours, consumed_hours, available_hours, hourly_rate, status, created_at, expiry_date, notes",
    )
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  const rows = banks ?? [];
  const activeBanks = rows.filter((b) => b.status === "active");
  const totalAvailable = activeBanks.reduce((s, b) => s + Number(b.available_hours ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md text-navy">בנקי שעות</h1>
        <p className="text-ink-soft mt-1 text-sm">{activeBanks.length} בנקים פעילים</p>
      </div>

      {activeBanks.length > 0 && (
        <div className="border-navy/15 bg-navy/5 rounded-2xl border p-4">
          <div className="text-ink-soft mb-1 text-xs">שעות זמינות (סך הכל)</div>
          <div className="text-navy font-mono text-3xl font-bold" dir="ltr">
            {(Math.round(totalAvailable * 10) / 10).toFixed(1)}h
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-ink-faded py-12 text-center text-sm">אין בנקי שעות עדיין</p>
      ) : (
        <div className="space-y-3">
          {rows.map((bank) => {
            const purchased = Number(bank.purchased_hours ?? 0);
            const consumed = Number(bank.consumed_hours ?? 0);
            const available = Number(bank.available_hours ?? 0);
            const pct = purchased > 0 ? Math.min(100, (consumed / purchased) * 100) : 0;
            const isActive = bank.status === "active";
            const isAlmostEmpty = isActive && pct >= 80;

            return (
              <div
                key={bank.id}
                className={`rounded-2xl border p-5 ${isActive ? "bg-cream-paper border-ink-line" : "border-gray-200 bg-gray-50/50 opacity-70"}`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-gray-100 text-gray-500"
                        }`}
                      >
                        {BANK_STATUS_LABELS[bank.status ?? "active"] ?? bank.status}
                      </span>
                      {isAlmostEmpty && (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle size={12} />
                          נותרו מעט שעות
                        </span>
                      )}
                    </div>
                    <div className="text-ink-faded mt-1 flex items-center gap-3 text-xs">
                      <span>נרכש: {formatDate(bank.created_at)}</span>
                      {bank.expiry_date && <span>תוקף עד: {formatDate(bank.expiry_date)}</span>}
                    </div>
                  </div>
                  <div className="text-end">
                    <div
                      className="text-navy flex items-center gap-1 font-mono text-lg font-bold"
                      dir="ltr"
                    >
                      <Clock size={14} className="text-ink-soft" />
                      {available.toFixed(1)}h
                    </div>
                    <div className="text-ink-faded text-xs" dir="ltr">
                      מתוך {purchased.toFixed(1)}h
                    </div>
                  </div>
                </div>

                <div className="bg-cream-deep h-2.5 overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pct >= 90 ? "bg-rose-500" : pct >= 75 ? "bg-amber-500" : "bg-navy"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-ink-faded mt-1.5 flex justify-between text-xs">
                  <span dir="ltr">{consumed.toFixed(1)}h שומשו</span>
                  {bank.hourly_rate && (
                    <span dir="ltr">₪{Number(bank.hourly_rate).toLocaleString("he-IL")} / שעה</span>
                  )}
                </div>

                {bank.notes && <p className="text-ink-soft mt-2 text-xs">{bank.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
