import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DesktopTimer } from "./timer-client";

export const metadata = { title: "טיימר OTTO" };
export const dynamic = "force-dynamic";

export default async function DesktopTimerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/desktop-timer/login");
  return <DesktopTimer />;
}
