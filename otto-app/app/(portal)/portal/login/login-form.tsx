"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";

export function PortalLoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const origin = window.location.origin;

    const { error: sbErr } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/portal/auth/callback`,
        shouldCreateUser: true,
      },
    });

    setLoading(false);

    if (sbErr) {
      if (sbErr.message.includes("Signups not allowed")) {
        setError("כתובת האימייל לא נמצאה במערכת. פנה לנציג שלך לגישה לפורטל.");
      } else {
        setError(sbErr.message);
      }
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="py-4 text-center">
        <div className="mb-3 text-3xl text-emerald-600">✓</div>
        <p className="text-navy font-semibold">קישור נשלח!</p>
        <p className="text-ink-soft mt-1 text-sm">
          בדוק את תיבת הדואר שלך בכתובת <strong>{email}</strong>
        </p>
        <button
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
          className="text-ink-faded hover:text-navy mt-4 text-xs underline"
        >
          שלח שוב
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-ink-soft mb-1 block text-xs uppercase">כתובת אימייל</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          placeholder="your@email.com"
          dir="ltr"
          className="border-ink-line focus:border-navy w-full rounded-lg border bg-white px-3 py-2.5 text-sm transition-colors outline-none placeholder:text-gray-400"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !email}
        className="bg-navy text-cream-paper hover:bg-navy-deep w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner size={14} />
            שולח...
          </span>
        ) : (
          "שלח קישור כניסה"
        )}
      </button>
    </form>
  );
}
