"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function PortalLoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const origin = window.location.origin;
    const { data, error: sbErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/portal/auth/callback` },
    });
    if (sbErr) {
      setError(sbErr.message);
      setGoogleLoading(false);
    } else if (data.url) {
      window.location.href = data.url;
    }
  }

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
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading}
        className="border-ink-line hover:border-navy flex w-full items-center justify-center gap-2.5 rounded-lg border bg-white px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {googleLoading ? <Spinner size={16} /> : <GoogleIcon />}
        כנס עם Google
      </button>

      <div className="relative flex items-center gap-3">
        <div className="border-ink-line flex-1 border-t" />
        <span className="text-ink-faded text-xs">או עם מייל</span>
        <div className="border-ink-line flex-1 border-t" />
      </div>

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
    </div>
  );
}
