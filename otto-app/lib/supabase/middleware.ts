import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "./types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/signout");
  const isPortalAuthRoute =
    pathname.startsWith("/portal/login") || pathname.startsWith("/portal/auth/");
  const isPortalRoute = pathname.startsWith("/portal");
  const isPublicApi =
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/finbot") ||
    pathname.startsWith("/api/calendar/sync") ||
    pathname.startsWith("/api/bot/") ||
    pathname.startsWith("/api/recordings/webhook") ||
    pathname === "/manifest.webmanifest";
  const isPublicRoot = pathname === "/";
  const isPublicProposal = pathname.startsWith("/proposal/");
  const isPublicBooking = pathname.startsWith("/book/");

  // Portal route protection
  if (isPortalRoute && !isPortalAuthRoute && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/portal/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin route protection
  if (
    !user &&
    !isAuthRoute &&
    !isPortalAuthRoute &&
    !isPortalRoute &&
    !isPublicApi &&
    !isPublicRoot &&
    !isPublicProposal &&
    !isPublicBooking
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    dashUrl.search = "";
    return NextResponse.redirect(dashUrl);
  }

  // Block authenticated admin-area users who have no users row.
  // Fetch full_name + email here so the layout can read them from a request header
  // instead of making a second DB round-trip.
  const isAccessPending = pathname === "/access-pending";
  if (user && !isAuthRoute && !isPortalRoute && !isPublicApi && !isPublicRoot && !isAccessPending) {
    const { data: profile } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      const pendingUrl = request.nextUrl.clone();
      pendingUrl.pathname = "/access-pending";
      pendingUrl.search = "";
      return NextResponse.redirect(pendingUrl);
    }

    // Pass display name to Server Components via request header — avoids a second DB call in layout
    const displayName = profile.full_name?.split(" ")[0] ?? profile.email?.split("@")[0] ?? "";
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-display-name", encodeURIComponent(displayName));

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return response;
}
