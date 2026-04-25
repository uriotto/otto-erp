"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body className="bg-cream text-navy min-h-screen">
        <main className="flex min-h-screen items-center justify-center px-6">
          <div className="bg-cream-paper border-ink-line max-w-md rounded-2xl border p-10 text-center">
            <h1 className="text-display-md text-navy mb-3">משהו קרה</h1>
            <p className="text-ink-soft mb-6 text-sm leading-relaxed">
              נתקלנו בשגיאה לא צפויה. דיווחנו עליה ואנחנו עובדים על תיקון.
            </p>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="bg-navy text-cream-paper hover:bg-navy-deep rounded-lg px-5 py-2.5 font-semibold transition-colors"
            >
              חזרה לדף הבית
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
