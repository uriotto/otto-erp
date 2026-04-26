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

  const { data: profile } = await supabase.from("users").select("full_name, email").single();

  const displayName = profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "אורי";

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
