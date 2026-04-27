"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function PortalSignOutButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSignOut() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/portal/login");
    });
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={pending}
      title="התנתק"
      className="text-ink-soft hover:text-navy hover:bg-cream flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
    >
      <LogOut size={14} />
      <span className="hidden sm:inline">התנתק</span>
    </button>
  );
}
