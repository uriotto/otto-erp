"use client";

import { useActionState } from "react";

import { signInWithEmail, type LoginState } from "./actions";
import { Spinner } from "@/components/ui/spinner";

const initialState: LoginState = null;

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInWithEmail, initialState);

  return (
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
  );
}
