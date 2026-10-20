import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { DesktopLoginForm } from "./login-form";

export default async function DesktopLoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/desktop-timer");

  const authOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : null;

  return (
    <main className="mx-auto max-w-md space-y-5 p-6">
      <p className="text-navy text-sm font-semibold">OTTO למק</p>
      <h1 className="text-2xl font-bold">כניסה לטיימר</h1>
      <p className="text-ink-soft text-sm leading-relaxed">
        בקש קישור כניסה למייל. באפליקציית המק, העתק את הקישור מהמייל בלי לפתוח אותו, ולחץ למעלה על
        ״קישור כניסה״ כדי להדביק אותו. הכניסה נשמרת במחשב הזה.
      </p>
      <DesktopLoginForm authOrigin={authOrigin} />
    </main>
  );
}
