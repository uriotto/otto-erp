import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json({ status: "error", reason: "missing_supabase_env" }, { status: 500 });
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });

  const start = Date.now();
  const { error } = await supabase.from("tenants").select("id", { head: true, count: "exact" });
  const dbMs = Date.now() - start;

  if (error) {
    console.error("[health] db check failed", error.message);
    return NextResponse.json(
      { status: "error", reason: "supabase_query_failed", dbMs },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: "ok",
    dbMs,
    timestamp: new Date().toISOString(),
  });
}
