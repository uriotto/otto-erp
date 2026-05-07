"use client";

import { useState, useTransition, useEffect } from "react";
import { CalendarDays, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { disconnectGoogleCalendar } from "./actions";

type Props = {
  isConnected: boolean;
  flashSuccess?: string;
  flashError?: string;
};

export function GoogleCalendarCard({ isConnected, flashSuccess, flashError }: Props) {
  const toast = useToast();
  const [connected, setConnected] = useState(isConnected);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (flashSuccess) toast.success(flashSuccess);
    if (flashError) toast.error(flashError);
  }, []);

  const handleDisconnect = () => {
    startTransition(async () => {
      const res = await disconnectGoogleCalendar();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setConnected(false);
      toast.success("Google Calendar נותק");
    });
  };

  return (
    <section className="bg-cream-paper border-ink-line rounded-2xl border p-6">
      <div className="mb-5 flex items-center gap-2">
        <CalendarDays size={18} className="text-navy" />
        <h2 className="text-display-sm text-navy">Google Calendar</h2>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {connected ? (
            <CheckCircle size={18} className="shrink-0 text-green-600" />
          ) : (
            <XCircle size={18} className="text-ink-faded shrink-0" />
          )}
          <div>
            <p className="text-navy text-sm font-semibold">{connected ? "מחובר" : "לא מחובר"}</p>
            <p className="text-ink-faded text-xs">
              {connected
                ? "סנכרון דו-כיווני פעיל — פגישות מסתנכרנות אוטומטית"
                : "חבר את Google Calendar לסנכרון פגישות דו-כיווני"}
            </p>
          </div>
        </div>

        {connected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={pending}
            className="border-ink-line text-navy inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold transition-colors hover:border-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Spinner size={14} /> : null}
            נתק
          </button>
        ) : (
          <a
            href="/api/auth/google-calendar"
            className="bg-navy text-cream hover:bg-navy/90 inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors"
          >
            חבר Google Calendar
          </a>
        )}
      </div>
    </section>
  );
}
