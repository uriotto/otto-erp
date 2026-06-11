"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="bg-cream-paper flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-navy text-2xl font-semibold">משהו השתבש</h2>
      <p className="text-ink-soft max-w-md">
        קרתה שגיאה לא צפויה. אפשר לנסות שוב, ואם זה חוזר על עצמו - לרענן את הדף או לחזור לדשבורד.
      </p>
      {error.digest ? <p className="text-ink-faded text-xs">קוד שגיאה: {error.digest}</p> : null}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="bg-navy text-cream-paper rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        >
          נסה שוב
        </button>
        <a
          href="/dashboard"
          className="border-ink-line text-navy hover:bg-cream-paper rounded-md border px-4 py-2 text-sm font-medium transition-colors"
        >
          חזרה לדשבורד
        </a>
      </div>
    </div>
  );
}
