import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export type NotificationItem = Pick<
  Tables<"notifications">,
  "id" | "title" | "body" | "link" | "severity" | "read_at" | "created_at"
>;

export type NotificationsResponse = {
  unreadCount: number;
  items: NotificationItem[];
};

export async function GET() {
  const supabase = await createClient();

  const { data: profile } = await supabase.from("users").select("tenant_id, id").single();
  if (!profile) {
    return NextResponse.json({ unreadCount: 0, items: [] } satisfies NotificationsResponse, {
      status: 200,
    });
  }

  // Unread first, then 10 most recent read — combined max ~20.
  const [{ data: unread }, { data: read }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, title, body, link, severity, read_at, created_at")
      .eq("tenant_id", profile.tenant_id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notifications")
      .select("id, title, body, link, severity, read_at, created_at")
      .eq("tenant_id", profile.tenant_id)
      .not("read_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const unreadItems = unread ?? [];
  const readItems = read ?? [];

  const items = [...unreadItems, ...readItems].slice(0, 20);

  return NextResponse.json({
    unreadCount: unreadItems.length,
    items,
  } satisfies NotificationsResponse);
}
