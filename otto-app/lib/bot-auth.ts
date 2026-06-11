import { createHash, randomBytes } from "node:crypto";

import { checkRateLimit, rateLimited, requestIp } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

export interface BotAuthContext {
  userId: string;
  tenantId: string;
  tokenId: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generatePlaintextToken(): string {
  // 32 bytes => 64 hex chars. Prefix makes it easy to spot in logs.
  return `otto_bot_${randomBytes(32).toString("hex")}`;
}

interface TokenRow {
  id: string;
  user_id: string;
  tenant_id: string;
  revoked_at?: string | null;
}

export async function authenticateBot(request: Request): Promise<BotAuthContext | null> {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  if (!token) return null;

  const supabase = createServiceClient();
  const tokenHash = hashToken(token);

  // Prefer the query that includes revoked_at; fall back to the legacy column
  // set if migration 20260611100200 has not been applied yet (PG 42703 =
  // undefined column), so nothing breaks pre-migration.
  let row: TokenRow | null = null;
  const withRevoked = await supabase
    .from("bot_api_tokens")
    .select("id, user_id, tenant_id, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (withRevoked.error) {
    if (withRevoked.error.code !== "42703") return null;
    const legacy = await supabase
      .from("bot_api_tokens")
      .select("id, user_id, tenant_id")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (legacy.error || !legacy.data) return null;
    row = legacy.data;
  } else {
    row = withRevoked.data as unknown as TokenRow | null;
  }

  if (!row) return null;
  if (row.revoked_at) return null; // token has been revoked

  // Best-effort last_used_at bump - don't block on it
  void supabase
    .from("bot_api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return { userId: row.user_id, tenantId: row.tenant_id, tokenId: row.id };
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

export type BotGuardResult = { ok: true; auth: BotAuthContext } | { ok: false; response: Response };

/**
 * Canonical entry point for every /api/bot/* route:
 * authenticates the bearer token AND applies rate limiting
 * (per token when authenticated, per IP for failed attempts).
 *
 * Usage:
 *   const guard = await guardBotRequest(request);
 *   if (!guard.ok) return guard.response;
 *   const auth = guard.auth;
 */
export async function guardBotRequest(request: Request): Promise<BotGuardResult> {
  const auth = await authenticateBot(request);
  if (!auth) {
    // Slow down token brute-forcing: 30 failed attempts per IP per minute.
    const allowed = await checkRateLimit(`bot-anon:${requestIp(request)}`, {
      limit: 30,
      windowSeconds: 60,
    });
    return { ok: false, response: allowed ? unauthorized() : rateLimited() };
  }
  const allowed = await checkRateLimit(`bot:${auth.tokenId}`, {
    limit: 120,
    windowSeconds: 60,
  });
  if (!allowed) return { ok: false, response: rateLimited() };
  return { ok: true, auth };
}

type Tables = Database["public"]["Tables"];
type TableName = keyof Tables & string;

export interface ScopedError {
  message: string;
  code?: string;
}

export interface ScopedResult<Row> {
  data: Row[] | null;
  error: ScopedError | null;
}

export interface ScopedSingleResult<Row> {
  data: Row | null;
  error: ScopedError | null;
}

/**
 * Minimal chainable query surface for botScopedClient. Intentionally
 * structural (not the generated Supabase generics) - the full generic
 * builder over the whole table union blows up tsc memory.
 */
export interface ScopedQuery<Row = Record<string, unknown>> extends PromiseLike<ScopedResult<Row>> {
  eq(column: string, value: unknown): ScopedQuery<Row>;
  neq(column: string, value: unknown): ScopedQuery<Row>;
  in(column: string, values: readonly unknown[]): ScopedQuery<Row>;
  is(column: string, value: unknown): ScopedQuery<Row>;
  gte(column: string, value: unknown): ScopedQuery<Row>;
  lte(column: string, value: unknown): ScopedQuery<Row>;
  ilike(column: string, pattern: string): ScopedQuery<Row>;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): ScopedQuery<Row>;
  limit(count: number): ScopedQuery<Row>;
  range(from: number, to: number): ScopedQuery<Row>;
  select(columns?: string): ScopedQuery<Row>;
  single<R = Row>(): PromiseLike<ScopedSingleResult<R>>;
  maybeSingle<R = Row>(): PromiseLike<ScopedSingleResult<R>>;
}

interface UntypedTableOps {
  select(columns: string): unknown;
  insert(values: Record<string, unknown>): unknown;
  update(values: Record<string, unknown>): unknown;
  delete(): unknown;
}

/**
 * Tenant-scoped query helper for /api/bot routes (second line of defense
 * against forgotten `.eq("tenant_id", ...)` filters on the service client).
 *
 * MANDATORY for new bot routes: use this instead of createServiceClient()
 * directly. Every query it produces is already filtered by the token's tenant,
 * and every insert gets tenant_id injected automatically.
 */
export function botScopedClient(auth: BotAuthContext) {
  const supabase = createServiceClient();
  const from = (table: TableName): UntypedTableOps =>
    (supabase as unknown as { from: (table: string) => UntypedTableOps }).from(table);

  return {
    userId: auth.userId,
    tenantId: auth.tenantId,
    /** SELECT pre-filtered by tenant_id. */
    select<Row = Record<string, unknown>>(table: TableName, columns: string): ScopedQuery<Row> {
      return (from(table).select(columns) as ScopedQuery<Row>).eq("tenant_id", auth.tenantId);
    },
    /** INSERT with tenant_id injected from the token - callers cannot spoof it. */
    insert<T extends TableName>(
      table: T,
      values: Omit<Tables[T]["Insert"], "tenant_id">,
    ): ScopedQuery<Record<string, unknown>> {
      const row = { ...(values as Record<string, unknown>), tenant_id: auth.tenantId };
      return from(table).insert(row) as ScopedQuery<Record<string, unknown>>;
    },
    /** UPDATE pre-filtered by tenant_id - chain additional .eq() filters. */
    update<T extends TableName>(
      table: T,
      values: Tables[T]["Update"],
    ): ScopedQuery<Record<string, unknown>> {
      return (
        from(table).update(values as Record<string, unknown>) as ScopedQuery<
          Record<string, unknown>
        >
      ).eq("tenant_id", auth.tenantId);
    },
    /** DELETE pre-filtered by tenant_id - chain additional .eq() filters. */
    delete(table: TableName): ScopedQuery<Record<string, unknown>> {
      return (from(table).delete() as ScopedQuery<Record<string, unknown>>).eq(
        "tenant_id",
        auth.tenantId,
      );
    },
  };
}

export type BotScopedClient = ReturnType<typeof botScopedClient>;
