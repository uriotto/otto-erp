"use client";

import { useState, useTransition } from "react";
import { Wallet } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { updateBillingSettings, type BillingSettings } from "./actions";

type Props = {
  initial: BillingSettings;
};

export function BillingCard({ initial }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [hourlyRate, setHourlyRate] = useState(String(initial.default_hourly_rate));
  const [bankRate, setBankRate] = useState(String(initial.default_hour_bank_rate));
  const [alertPct, setAlertPct] = useState(String(initial.default_alert_threshold_pct));
  const [alertHours, setAlertHours] = useState(String(initial.default_alert_threshold_hours));
  const [expiryMonths, setExpiryMonths] = useState(String(initial.default_hour_bank_expiry_months));
  const [autoAbsorb, setAutoAbsorb] = useState(initial.auto_absorb_overage_default);

  const submit = () => {
    startTransition(async () => {
      const res = await updateBillingSettings({
        default_hourly_rate: hourlyRate,
        default_hour_bank_rate: bankRate,
        default_alert_threshold_pct: alertPct,
        default_alert_threshold_hours: alertHours,
        default_hour_bank_expiry_months: expiryMonths,
        auto_absorb_overage_default: autoAbsorb,
      });
      if (res.error || !res.data) {
        toast.error(res.error ?? "שגיאה בשמירה");
        return;
      }
      toast.success("הגדרות החיוב נשמרו");
      const d = res.data;
      setHourlyRate(String(d.default_hourly_rate));
      setBankRate(String(d.default_hour_bank_rate));
      setAlertPct(String(d.default_alert_threshold_pct));
      setAlertHours(String(d.default_alert_threshold_hours));
      setExpiryMonths(String(d.default_hour_bank_expiry_months));
      setAutoAbsorb(d.auto_absorb_overage_default);
    });
  };

  return (
    <section className="bg-cream-paper border-ink-line rounded-2xl border p-6">
      <div className="mb-5 flex items-center gap-2">
        <Wallet size={18} className="text-navy" />
        <h2 className="text-display-sm text-navy">חיוב ובנקי שעות</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="תעריף שעתי רגיל (לא בבנק שעות)"
          hint="ברירת מחדל ללקוחות בחיוב שעתי"
          suffix="₪/שעה"
          value={hourlyRate}
          onChange={setHourlyRate}
          inputMode="decimal"
        />
        <Field
          label="תעריף שעתי לבנק שעות"
          hint="המחיר ליצירת בנק חדש"
          suffix="₪/שעה"
          value={bankRate}
          onChange={setBankRate}
          inputMode="decimal"
        />
        <Field
          label="רף התרעה באחוזים"
          hint="התראה כשנותר אחוז מסוים מהבנק"
          suffix="%"
          value={alertPct}
          onChange={setAlertPct}
          inputMode="numeric"
        />
        <Field
          label="רף התרעה בשעות"
          hint="התראה כשנותרו פחות משעות אלה"
          suffix="שעות"
          value={alertHours}
          onChange={setAlertHours}
          inputMode="decimal"
        />
        <Field
          label="תפוגת בנק ברירת מחדל"
          hint="כמה חודשים בנק נשאר פעיל"
          suffix="חודשים"
          value={expiryMonths}
          onChange={setExpiryMonths}
          inputMode="numeric"
        />
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={autoAbsorb}
          onChange={(e) => setAutoAbsorb(e.target.checked)}
          className="border-ink-line text-navy focus:ring-navy mt-0.5 h-4 w-4 rounded border"
        />
        <span>
          <span className="text-navy block text-sm font-semibold">
            איחוד אוטומטי של overage לבנק חדש
          </span>
          <span className="text-ink-faded block text-xs">
            כשנפתח בנק חדש, שעות overage קודמות יוטמעו אוטומטית
          </span>
        </span>
      </label>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          aria-busy={pending}
          className="bg-navy text-cream hover:bg-navy/90 inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <>
              <Spinner size={14} />
              <span>שומר</span>
            </>
          ) : (
            "שמור הגדרות"
          )}
        </button>
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  suffix,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  hint?: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <div>
      <label className="text-navy mb-1 block text-sm font-semibold">{label}</label>
      <div className="border-ink-line focus-within:border-navy flex items-center gap-2 rounded-lg border bg-white px-3 py-2 transition-colors">
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir="ltr"
          className="text-navy placeholder:text-ink-faded flex-1 bg-transparent text-sm outline-none"
        />
        {suffix && <span className="text-ink-faded text-xs">{suffix}</span>}
      </div>
      {hint && <p className="text-ink-faded mt-1 text-xs">{hint}</p>}
    </div>
  );
}
