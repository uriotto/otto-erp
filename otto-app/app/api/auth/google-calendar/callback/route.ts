import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  encrypt,
  registerPushChannel,
  importAllEvents,
  upsertGoogleEventsToOtto,
} from "@/lib/google-calendar";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/settings?google_error=access_denied`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("google_oauth_state")?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${appUrl}/settings?google_error=invalid_state`);
  }
  cookieStore.delete("google_oauth_state");

  // Exchange code for tokens
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${appUrl}/api/auth/google-calendar/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("Google token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${appUrl}/settings?google_error=token_exchange`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!tokens.refresh_token) {
    return NextResponse.redirect(`${appUrl}/settings?google_error=no_refresh_token`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${appUrl}/login`);

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return NextResponse.redirect(`${appUrl}/settings?google_error=no_profile`);

  const tenantId = profile.tenant_id;
  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase
    .from("tenant_settings")
    .update({
      google_refresh_token: encrypt(tokens.refresh_token),
      google_access_token: encrypt(tokens.access_token),
      google_token_expiry: expiry,
    })
    .eq("tenant_id", tenantId);

  // Register push channel (best-effort — don't fail OAuth if this fails)
  try {
    await registerPushChannel(tenantId, `${appUrl}/api/calendar/sync`);
  } catch (err) {
    console.error("Google push channel registration failed:", err);
  }

  // Initial import is done via "סנכרן עכשיו" button in settings (too slow for OAuth callback)

  return NextResponse.redirect(`${appUrl}/settings?google_connected=1`);
}
