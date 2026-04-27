"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { signInWithEmail, signInWithGoogle, type LoginState } from "./actions";
import { Spinner } from "@/components/ui/spinner";

const initialState: LoginState = null;

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
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

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInWithEmail, initialState);
  const [googlePending, startGoogleTransition] = useTransition();
  const [googleError, setGoogleError] = useState<string | null>(null);
  const router = useRouter();

  function handleGoogle() {
    setGoogleError(null);
    startGoogleTransition(async () => {
      const res = await signInWithGoogle();
      if (res.error) {
        setGoogleError(res.error);
      } else if (res.url) {
        router.push(res.url);
      }
    });
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googlePending}
        className="border-ink-line hover:border-navy flex w-full items-center justify-center gap-3 rounded-lg border bg-white px-5 py-3 font-semibold transition-colors disabled:opacity-50"
      >
        {googlePending ? <Spinner size={18} /> : <GoogleIcon />}
        כנס עם Google
      </button>

      {googleError && <p className="text-sm text-red-600">{googleError}</p>}

      <div className="relative flex items-center gap-3">
        <div className="border-ink-line flex-1 border-t" />
        <span className="text-ink-faded text-xs">או עם מייל</span>
        <div className="border-ink-line flex-1 border-t" />
      </div>

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="text-micro text-ink-soft mb-2 block uppercase">
            כתובת מייל
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            dir="auto"
            placeholder="you@example.com"
            className="bg-cream border-ink-line text-ink focus:border-navy focus:ring-navy/20 w-full rounded-lg border px-4 py-2.5 text-base focus:ring-2 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="bg-navy text-cream-paper hover:bg-navy-deep w-full rounded-lg px-5 py-3 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size={16} />
              <span>שולח</span>
            </span>
          ) : (
            "שלח לי קישור התחברות"
          )}
        </button>

        {state && (
          <div
            role={state.ok ? "status" : "alert"}
            className={`rounded-lg border px-4 py-3 text-sm ${
              state.ok
                ? "border-navy bg-cream text-navy"
                : "border-navy-deep bg-cream-deep text-navy-deep"
            }`}
          >
            {state.message}
          </div>
        )}
      </form>
    </div>
  );
}
