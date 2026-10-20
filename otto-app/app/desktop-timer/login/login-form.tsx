"use client";

import { useActionState, useEffect } from "react";
import { signInWithEmail, type LoginState } from "@/app/(auth)/login/actions";

export function DesktopLoginForm({ authOrigin }: { authOrigin: string | null }) {
  const [state, action, pending] = useActionState(signInWithEmail, null as LoginState);

  useEffect(() => {
    const bridge = (
      window as unknown as {
        webkit?: { messageHandlers?: { ottoTimer?: { postMessage: (message: unknown) => void } } };
      }
    ).webkit?.messageHandlers?.ottoTimer;
    bridge?.postMessage({ type: "auth", authOrigin });
  }, [authOrigin]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value="/desktop-timer" />
      <label className="block space-y-2">
        <span>כתובת מייל</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          className="border-ink-line w-full rounded-xl border bg-white px-3 py-3"
        />
      </label>
      <button
        disabled={pending}
        className="bg-navy w-full rounded-xl px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "שולח קישור..." : "שלח קישור כניסה"}
      </button>
      {state && (
        <p role={state.ok ? "status" : "alert"} className="text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
