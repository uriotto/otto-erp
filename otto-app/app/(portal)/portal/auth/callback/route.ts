import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/portal/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/portal/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Verify this email is a portal-enabled customer
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/portal/login?error=no_email`);
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("email", user.email)
    .eq("portal_enabled", true)
    .maybeSingle();

  if (!customer) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/portal/login?error=${encodeURIComponent("אימייל זה אינו מורשה לגישה לפורטל")}`,
    );
  }

  // Update last login
  await supabase
    .from("customers")
    .update({ portal_last_login: new Date().toISOString() })
    .eq("id", customer.id);

  return NextResponse.redirect(`${origin}/portal/dashboard`);
}
