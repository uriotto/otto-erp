import { createServiceClient } from "@/lib/supabase/service";

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  limit: number;
  /** Window size in seconds (fixed window). */
  windowSeconds: number;
}

/**
 * Supabase-backed fixed-window rate limiter.
 *
 * Returns true when the request is allowed.
 *
 * FAIL-OPEN by design: if the `rate_limit_hit` function / `rate_limit_hits`
 * table does not exist yet (migration 20260611100100 not applied) or any
 * other error occurs, the request is allowed so nothing breaks pre-migration.
 */
export async function checkRateLimit(
  key: string,
  { limit, windowSeconds }: RateLimitOptions,
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    // The rate_limit_hit function is not in the generated Database types until
    // the migration is applied and types are regenerated - call it untyped.
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: unknown }>;
    const { data, error } = await rpc("rate_limit_hit", {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_limit: limit,
    });
    if (error) return true; // fail open (function missing, network, etc.)
    return data !== false;
  } catch {
    return true; // fail open
  }
}

export function rateLimited(): Response {
  return new Response(JSON.stringify({ error: "rate limit exceeded" }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": "60" },
  });
}

/** Best-effort client IP for keying anonymous rate limits. */
export function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
