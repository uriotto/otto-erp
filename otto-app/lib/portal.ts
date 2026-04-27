import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getPortalCustomer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/portal/login");

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, company, email")
    .eq("email", user.email ?? "")
    .eq("portal_enabled", true)
    .maybeSingle();

  if (!customer) {
    redirect("/portal/login?error=" + encodeURIComponent("אין הרשאת גישה לפורטל"));
  }

  return { supabase, customer };
}
