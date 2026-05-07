import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchIncrementalChanges, upsertGoogleEventsToOtto } from "@/lib/google-calendar";

export async function POST(request: NextRequest) {
  const channelId = request.headers.get("X-Goog-Channel-ID");
  const resourceId = request.headers.get("X-Goog-Resource-ID");
  const resourceState = request.headers.get("X-Goog-Resource-State");

  // Google sends a "sync" notification when the channel is first registered — ignore it
  if (resourceState === "sync") {
    return NextResponse.json({ ok: true });
  }

  if (!channelId || !resourceId) {
    return NextResponse.json({ error: "missing headers" }, { status: 400 });
  }

  // Use service client — this is a server-to-server call with no user session
  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("tenant_id, google_channel_id, google_channel_resource_id")
    .eq("google_channel_id", channelId)
    .eq("google_channel_resource_id", resourceId)
    .single();

  if (!settings) {
    return NextResponse.json({ error: "unknown channel" }, { status: 404 });
  }

  const tenantId = settings.tenant_id;

  try {
    const { events, newSyncToken } = await fetchIncrementalChanges(tenantId);

    await upsertGoogleEventsToOtto(tenantId, events);

    if (newSyncToken) {
      await supabase
        .from("tenant_settings")
        .update({ google_sync_token: newSyncToken })
        .eq("tenant_id", tenantId);
    }
  } catch (err) {
    console.error("Google calendar sync error:", err);
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
