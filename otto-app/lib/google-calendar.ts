import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// ─── Encryption helpers ───────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error("ENCRYPTION_KEY env var missing");
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  return buf;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// ─── Token management ─────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token refresh failed: ${err}`);
  }
  return res.json();
}

export async function getAccessToken(tenantId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("google_access_token, google_refresh_token, google_token_expiry")
    .eq("tenant_id", tenantId)
    .single();

  if (!settings?.google_refresh_token) throw new Error("Google Calendar not connected");

  const refreshToken = decrypt(settings.google_refresh_token);
  const expiry = settings.google_token_expiry
    ? new Date(settings.google_token_expiry)
    : new Date(0);
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (settings.google_access_token && expiry > fiveMinFromNow) {
    return decrypt(settings.google_access_token);
  }

  const tokens = await refreshAccessToken(refreshToken);
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

  await supabase
    .from("tenant_settings")
    .update({
      google_access_token: encrypt(tokens.access_token),
      google_token_expiry: newExpiry.toISOString(),
    })
    .eq("tenant_id", tenantId);

  return tokens.access_token;
}

// ─── Google Calendar event type ───────────────────────────────────────────────

export type GoogleCalendarEvent = {
  id: string;
  status: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  updated: string; // RFC3339
};

// ─── OTTO event → Google event mapping ───────────────────────────────────────

type OttoEvent = {
  title: string;
  description?: string | null;
  location?: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
};

function toGoogleEvent(ev: OttoEvent): Record<string, unknown> {
  if (ev.all_day) {
    return {
      summary: ev.title,
      description: ev.description ?? undefined,
      location: ev.location ?? undefined,
      start: { date: ev.start_at.slice(0, 10) },
      end: { date: ev.end_at.slice(0, 10) },
    };
  }
  return {
    summary: ev.title,
    description: ev.description ?? undefined,
    location: ev.location ?? undefined,
    start: { dateTime: ev.start_at, timeZone: "Asia/Jerusalem" },
    end: { dateTime: ev.end_at, timeZone: "Asia/Jerusalem" },
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

async function calendarFetch(
  tenantId: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken(tenantId);
  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("google_calendar_id")
    .eq("tenant_id", tenantId)
    .single();
  const calId = encodeURIComponent(settings?.google_calendar_id ?? "primary");
  const url = `${GOOGLE_CALENDAR_API}/calendars/${calId}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

export async function createGoogleEvent(tenantId: string, event: OttoEvent): Promise<string> {
  const res = await calendarFetch(tenantId, "/events", {
    method: "POST",
    body: JSON.stringify(toGoogleEvent(event)),
  });
  if (!res.ok) throw new Error(`Google createEvent failed: ${await res.text()}`);
  const data = (await res.json()) as GoogleCalendarEvent;
  return data.id;
}

export async function updateGoogleEvent(
  tenantId: string,
  googleEventId: string,
  event: OttoEvent,
): Promise<void> {
  const res = await calendarFetch(tenantId, `/events/${googleEventId}`, {
    method: "PUT",
    body: JSON.stringify(toGoogleEvent(event)),
  });
  if (!res.ok) throw new Error(`Google updateEvent failed: ${await res.text()}`);
}

export async function deleteGoogleEvent(tenantId: string, googleEventId: string): Promise<void> {
  const res = await calendarFetch(tenantId, `/events/${googleEventId}`, {
    method: "DELETE",
  });
  // 410 Gone = already deleted on Google side, that's fine
  if (!res.ok && res.status !== 410) {
    throw new Error(`Google deleteEvent failed: ${await res.text()}`);
  }
}

// ─── Incremental sync ─────────────────────────────────────────────────────────

export async function fetchIncrementalChanges(tenantId: string): Promise<{
  events: GoogleCalendarEvent[];
  newSyncToken: string | null;
}> {
  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("google_sync_token, google_calendar_id")
    .eq("tenant_id", tenantId)
    .single();

  const token = await getAccessToken(tenantId);
  const calId = encodeURIComponent(settings?.google_calendar_id ?? "primary");

  let url: string;
  if (settings?.google_sync_token) {
    url = `${GOOGLE_CALENDAR_API}/calendars/${calId}/events?syncToken=${settings.google_sync_token}`;
  } else {
    const since = new Date();
    since.setMonth(since.getMonth() - 3);
    url = `${GOOGLE_CALENDAR_API}/calendars/${calId}/events?timeMin=${since.toISOString()}&singleEvents=true`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 410) {
    // Sync token expired — clear it and return empty (next call will do full sync)
    await supabase
      .from("tenant_settings")
      .update({ google_sync_token: null })
      .eq("tenant_id", tenantId);
    return { events: [], newSyncToken: null };
  }

  if (!res.ok) throw new Error(`Google sync failed: ${await res.text()}`);

  const data = (await res.json()) as {
    items?: GoogleCalendarEvent[];
    nextSyncToken?: string;
  };

  return {
    events: data.items ?? [],
    newSyncToken: data.nextSyncToken ?? null,
  };
}

// ─── Full initial import ──────────────────────────────────────────────────────

export async function importAllEvents(tenantId: string): Promise<GoogleCalendarEvent[]> {
  const token = await getAccessToken(tenantId);
  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("google_calendar_id")
    .eq("tenant_id", tenantId)
    .single();
  const calId = encodeURIComponent(settings?.google_calendar_id ?? "primary");

  const since = new Date();
  since.setMonth(since.getMonth() - 3);

  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${calId}/events?timeMin=${since.toISOString()}&singleEvents=true&maxResults=500`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) throw new Error(`Google initial import failed: ${await res.text()}`);
  const data = (await res.json()) as { items?: GoogleCalendarEvent[]; nextSyncToken?: string };

  if (data.nextSyncToken) {
    await supabase
      .from("tenant_settings")
      .update({ google_sync_token: data.nextSyncToken })
      .eq("tenant_id", tenantId);
  }

  return data.items ?? [];
}

// ─── Push notification channel ────────────────────────────────────────────────

export async function registerPushChannel(tenantId: string, webhookUrl: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("google_calendar_id")
    .eq("tenant_id", tenantId)
    .single();

  const token = await getAccessToken(tenantId);
  const calId = encodeURIComponent(settings?.google_calendar_id ?? "primary");
  const channelId = crypto.randomUUID();

  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${calId}/events/watch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: channelId,
      type: "web_hook",
      address: webhookUrl,
      expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }),
  });

  if (!res.ok) throw new Error(`Google registerChannel failed: ${await res.text()}`);
  const data = (await res.json()) as { id: string; resourceId: string };

  await supabase
    .from("tenant_settings")
    .update({
      google_channel_id: data.id,
      google_channel_resource_id: data.resourceId,
    })
    .eq("tenant_id", tenantId);
}

export async function cancelPushChannel(tenantId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("google_channel_id, google_channel_resource_id")
    .eq("tenant_id", tenantId)
    .single();

  if (!settings?.google_channel_id || !settings?.google_channel_resource_id) return;

  const token = await getAccessToken(tenantId);
  await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: settings.google_channel_id,
      resourceId: settings.google_channel_resource_id,
    }),
  });
  // Ignore errors — we clear the tokens regardless
}

// ─── Upsert Google events into OTTO ──────────────────────────────────────────

export async function upsertGoogleEventsToOtto(
  tenantId: string,
  googleEvents: GoogleCalendarEvent[],
): Promise<void> {
  if (googleEvents.length === 0) return;

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .single();

  if (!profile) return;

  for (const ev of googleEvents) {
    if (ev.status === "cancelled") {
      await supabase.from("events").delete().eq("google_event_id", ev.id).eq("tenant_id", tenantId);
      continue;
    }

    const startAt = ev.start.dateTime ?? ev.start.date ?? "";
    const endAt = ev.end.dateTime ?? ev.end.date ?? "";
    const allDay = !ev.start.dateTime;

    // Check if event already exists in OTTO
    const { data: existing } = await supabase
      .from("events")
      .select("id, updated_at")
      .eq("google_event_id", ev.id)
      .eq("tenant_id", tenantId)
      .single();

    if (existing) {
      // Last-modified wins: only update if Google version is newer
      const ottoUpdated = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
      const googleUpdated = new Date(ev.updated).getTime();
      if (googleUpdated <= ottoUpdated) continue;

      await supabase
        .from("events")
        .update({
          title: ev.summary ?? "(no title)",
          description: ev.description ?? null,
          location: ev.location ?? null,
          start_at: startAt,
          end_at: endAt,
          all_day: allDay,
        })
        .eq("id", existing.id)
        .eq("tenant_id", tenantId);
    } else {
      await supabase.from("events").insert({
        tenant_id: tenantId,
        title: ev.summary ?? "(no title)",
        description: ev.description ?? null,
        location: ev.location ?? null,
        start_at: startAt,
        end_at: endAt,
        all_day: allDay,
        type: "meeting",
        google_event_id: ev.id,
      });
    }
  }
}
