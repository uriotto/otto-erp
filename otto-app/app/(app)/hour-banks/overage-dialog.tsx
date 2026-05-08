"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Gift, Wallet, X } from "lucide-react";

import { absorbOverageIntoBank, cancelOverageEntries, invoiceOverageSeparately } from "./actions";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";

type Choice = "absorb" | "invoice" | "cancel";

export function OverageDialog({
  bankId,
  customerId,
  customerName,
  count,
  hours,
  amount,
  entryIds,
  onClose,
}: {
  bankId: string;
  customerId: string;
  customerName: string;
  count: number;
  hours: number;
  amount: number;
  entryIds: string[];
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<Choice>("absorb");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleSubmit() {
    startTransition(async () => {
      if (choice === "absorb") {
        const result = await absorbOverageIntoBank(bankId);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success(`${result.absorbedHours ?? 0} שעות נכללו בבנק`);
      } else if (choice === "invoice") {
        const result = await invoiceOverageSeparately(customerId, entryIds);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success("בקשת חשבונית נשלחה");
      } else {
        const result = await cancelOverageEntries(entryIds);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success("השעות נזרקו (מתנה ללקוח)");
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="bg-cream max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">שעות חריגה לא מטופלות</h2>
          <button
            onClick={onClose}
            className="text-ink-faded hover:text-navy rounded-lg p-1 transition-colors"
            aria-label="סגור"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-ink-soft mb-5 text-sm leading-relaxed">
          נמצאו <strong className="text-navy">{count}</strong> שעות חריגה לא מטופלות עבור{" "}
          <strong className="text-navy">{customerName}</strong>. סה״כ{" "}
          <span dir="ltr" className="font-mono">
            {hours}
          </span>{" "}
          שעות בערך{" "}
          <span dir="ltr" className="font-mono">
            ₪{amount.toLocaleString("he-IL")}
          </span>
          . מה לעשות?
        </p>

        <div className="space-y-2">
          <ChoiceCard
            active={choice === "absorb"}
            onClick={() => setChoice("absorb")}
            icon={<Wallet size={18} />}
            title={`לכלול בבנק החדש (יצרך ${hours} מהבנק מיד)`}
            subtitle="השעות יסומנו כמוקצות לבנק וינוכו מהיתרה"
          />
          <ChoiceCard
            active={choice === "invoice"}
            onClick={() => setChoice("invoice")}
            icon={<Banknote size={18} />}
            title="חשבונית נפרדת על השעות"
            subtitle="תיפתח אוטומציה ב-Make לחיוב נפרד"
          />
          <ChoiceCard
            active={choice === "cancel"}
            onClick={() => setChoice("cancel")}
            icon={<Gift size={18} />}
            title="לזרוק (מתנה ללקוח)"
            subtitle="השעות יסומנו כבוטלו ולא ייחויבו"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="border-ink-line text-navy hover:border-navy rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            דלג
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            aria-busy={pending}
            className="bg-navy text-cream-paper hover:bg-navy-deep rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <span className="flex items-center gap-2">
                <Spinner size={14} />
                <span>מבצע</span>
              </span>
            ) : (
              "אשר"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-start transition-all ${
        active
          ? "border-navy bg-navy/5 shadow-sm"
          : "border-ink-line bg-cream-paper hover:border-ink-soft"
      }`}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          active ? "bg-navy text-cream-paper" : "bg-cream-deep/60 text-ink-soft"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-navy block text-sm font-semibold">{title}</span>
        <span className="text-ink-soft mt-0.5 block text-xs">{subtitle}</span>
      </span>
      <span
        aria-hidden
        className={`mt-1 inline-block h-4 w-4 shrink-0 rounded-full border-2 ${
          active ? "border-navy bg-navy" : "border-ink-line"
        }`}
      />
    </button>
  );
}
