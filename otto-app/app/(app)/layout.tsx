import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { NavProgress } from "@/components/layout/nav-progress";
import { CommandPalette } from "@/components/search/command-palette";
import { ToastProvider } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/server";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "בוקר טוב";
  if (hour < 17) return "צהריים טובים";
  return "ערב טוב";
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Display name was resolved in middleware (which already fetched the profile).
  // Reading from header avoids a second DB round-trip on every navigation.
  const headersList = await headers();
  const rawName = headersList.get("x-display-name");
  const displayName = rawName ? decodeURIComponent(rawName) : "אורי";

  return (
    <ToastProvider>
      <NavProgress />
      <AppShell greeting={getGreeting()} displayName={displayName} subline="automate your success">
        {children}
        <CommandPalette />
      </AppShell>
    </ToastProvider>
  );
}
