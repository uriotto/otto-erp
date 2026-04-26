"use client";

import { useState, useTransition } from "react";
import { Webhook } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { updateMakeWebhook } from "./actions";

type Props = {
  initialUrl: string | null;
};

export function IntegrationsCard({ initialUrl }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState(initialUrl ?? "");

  const submit = () => {
    startTransition(async () => {
      const res = await updateMakeWebhook(url);
      if (res.error || !res.data) {
        toast.error(res.error ?? "שגיאה בשמירה");
        return;
      }
      toast.success(res.data.make_webhook_url ? "Webhook נשמר" : "Webhook נמחק");
      setUrl(res.data.make_webhook_url ?? "");
    });
  };

  return (
    <section className="bg-cream-paper border-ink-line rounded-2xl border p-6">
      <div className="mb-5 flex items-center gap-2">
        <Webhook size={18} className="text-navy" />
        <h2 className="text-display-sm text-navy">אינטגרציות</h2>
      </div>

      <label className="text-navy mb-1 block text-sm font-semibold">Make webhook URL</label>
      <div className="border-ink-line focus-within:border-navy flex items-center rounded-lg border bg-white px-3 py-2 transition-colors">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          dir="ltr"
          placeholder="https://hook.eu2.make.com/..."
          className="text-navy placeholder:text-ink-faded flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      <p className="text-ink-faded mt-2 text-xs">
        כתובת Webhook של Make שמופעלת ביצירת בנק שעות / חידוש / חשבונית overage
      </p>

      <div className="mt-5 flex justify-end gap-2">
        {initialUrl && url.length === 0 && (
          <span className="text-ink-faded self-center text-xs">שמירה תמחק את הכתובת הקיימת</span>
        )}
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
            "שמור"
          )}
        </button>
      </div>
    </section>
  );
}
