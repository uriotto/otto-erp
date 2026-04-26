import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Wallet, Building2, Calendar, Banknote, Hourglass, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BreadcrumbLabel } from "@/components/layout/breadcrumb-label";
import { HourBankProgress } from "@/components/domain/hour-bank-progress";
import { HourBankActionsBar } from "./hour-bank-actions-bar";

export const metadata = { title: "בנק שעות — OTTO" };

const STATUS_LABELS: Record<string, string> = {
  active: "פעיל",
  depleted: "נוצל",
  expired: "פג תוקף",
  cancelled: "בוטל",
};
const STATUS_STYLES: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  depleted: "border-gray-200 bg-gray-100 text-gray-600",
  expired: "border-rose-200 bg-rose-50 text-rose-700",
  cancelled: "border-gray-200 bg-gray-100 text-gray-500",
};

export default async function HourBankPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: bank } = await supabase
    .from("hour_banks_summary")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!bank || !bank.id) notFound();

  const { data: customer } = bank.customer_id
    ? await supabase
        .from("customers")
        .select("id, name, company")
        .eq("id", bank.customer_id)
        .maybeSingle()
    : { data: null };

  const purchased = bank.purchased_hours == null ? 0 : Number(bank.purchased_hours);
  const consumed = bank.consumed_hours == null ? 0 : Number(bank.consumed_hours);
  const hourlyRate = bank.hourly_rate == null ? 0 : Number(bank.hourly_rate);
  const totalAmount = bank.total_amount == null ? 0 : Number(bank.total_amount);
  const alertPct = bank.alert_threshold_pct == null ? 30 : Number(bank.alert_threshold_pct);
  const alertHours = bank.alert_threshold_hours == null ? 3 : Number(bank.alert_threshold_hours);
  const status = bank.status ?? "active";
  const purchase = bank.purchase_date ? new Date(bank.purchase_date) : null;
  const expiry = bank.expiry_date ? new Date(bank.expiry_date) : null;

  const breadcrumbLabel = customer ? `בנק שעות — ${customer.name}` : "בנק שעות";

  return (
    <div className="mx-auto max-w-3xl">
      <BreadcrumbLabel label={breadcrumbLabel} />

      <div className="mb-6">
        <Link
          href="/hour-banks"
          className="text-ink-soft hover:text-navy inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowRight size={14} />
          חזרה לבנקי שעות
        </Link>
      </div>

      <div className="bg-cream-paper border-ink-line mb-4 rounded-2xl border p-6">
        <div className="mb-4 flex items-start gap-4">
          <div className="bg-navy text-cream-paper flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
            <Wallet size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-display-sm text-navy">{customer ? customer.name : "—"}</h1>
            {customer && (
              <Link
                href={`/customers/${customer.id}`}
                className="text-ink-soft hover:text-navy mt-1 inline-flex items-center gap-1 text-sm"
              >
                <Building2 size={12} />
                {customer.name}
                {customer.company && <span className="text-ink-faded">· {customer.company}</span>}
              </Link>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium ${
              STATUS_STYLES[status] ?? ""
            }`}
          >
            {STATUS_LABELS[status] ?? status}
          </span>
        </div>

        <div className="mb-5">
          <HourBankProgress
            purchased={purchased}
            consumed={consumed}
            alertThresholdPct={alertPct}
            alertThresholdHours={alertHours}
          />
        </div>

        <div className="text-ink-soft grid grid-cols-2 gap-y-2 text-sm md:grid-cols-3">
          <Stat
            icon={<Hourglass size={14} />}
            label="נרכשו"
            value={`${purchased.toFixed(2)}h`}
            dir="ltr"
          />
          <Stat
            icon={<Banknote size={14} />}
            label="מחיר לשעה"
            value={`₪${hourlyRate.toLocaleString("he-IL")}`}
            dir="ltr"
          />
          <Stat
            icon={<Banknote size={14} />}
            label='סה"כ'
            value={`₪${totalAmount.toLocaleString("he-IL")}`}
            dir="ltr"
          />
          {purchase && (
            <Stat
              icon={<Calendar size={14} />}
              label="נרכש"
              value={purchase.toLocaleDateString("he-IL")}
            />
          )}
          {expiry && (
            <Stat
              icon={<Calendar size={14} />}
              label="תפוגה"
              value={expiry.toLocaleDateString("he-IL")}
            />
          )}
          <Stat icon={<Bell size={14} />} label="התראה" value={`${alertPct}% / ${alertHours}h`} />
        </div>

        {bank.notes && (
          <p className="text-ink-soft mt-4 text-sm whitespace-pre-wrap">{bank.notes}</p>
        )}

        <HourBankActionsBar
          bank={{
            id: bank.id,
            status,
            purchased_hours: Number(bank.purchased_hours),
            hourly_rate: Number(bank.hourly_rate),
            expiry_date: bank.expiry_date,
            alert_threshold_pct: alertPct,
            alert_threshold_hours: alertHours,
            notes: bank.notes,
          }}
        />
      </div>

      <div className="bg-cream-paper border-ink-line mt-4 rounded-2xl border p-6">
        <h2 className="text-display-sm text-navy mb-2">שעות שנצרכו</h2>
        <p className="text-ink-soft text-sm">
          הקישור בין בנק שעות לרישומי שעות יתווסף ב-Phase 3.6. כרגע מוצגים נתונים מצטברים מתוך
          רישומי שעות שיוקצו לבנק זה.
        </p>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  dir,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | undefined;
  dir?: "ltr";
  className?: string;
}) {
  if (!value) return null;
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {icon}
      <span className="text-ink-faded">{label}:</span>
      <span dir={dir} className="text-navy font-medium">
        {value}
      </span>
    </div>
  );
}
