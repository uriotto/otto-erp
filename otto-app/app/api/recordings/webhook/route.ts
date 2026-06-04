import { createServiceClient } from "@/lib/supabase/service";
import {
  extractTranscript,
  summarizeTranscript,
  summaryToMarkdown,
  verifyRecordingSig,
} from "@/lib/recordings/transcription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook ש-RunPod דופק אליו כשהתמלול מסתיים.
 * URL: /api/recordings/webhook?rec=<id>&token=<secret>
 * מחלץ תמלול → מסכם עם Claude → כותב לכרטיס ההקלטה (status=transcribed).
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const recordingId = url.searchParams.get("rec");
  const sig = url.searchParams.get("sig");

  if (!recordingId) {
    return Response.json({ error: "missing rec id" }, { status: 400 });
  }
  // חתימת HMAC הקשורה ל-rec הזה (constant-time). הסוד עצמו לא עובר ב-URL.
  if (!verifyRecordingSig(recordingId, sig)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { status?: string; output?: unknown };
  try {
    body = (await request.json()) as { status?: string; output?: unknown };
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // RunPod סיים בכישלון
  if (body.status && body.status !== "COMPLETED") {
    await supabase.from("recordings").update({ status: "failed" }).eq("id", recordingId);
    return Response.json({ ok: true, status: "failed" });
  }

  const transcript = extractTranscript(body.output);
  if (!transcript) {
    await supabase.from("recordings").update({ status: "failed" }).eq("id", recordingId);
    return Response.json({ ok: true, status: "failed", reason: "empty transcript" });
  }

  // מסכמים - אם הסיכום נכשל, עדיין שומרים את התמלול (הוא הערך העיקרי)
  let summaryMd: string | null = null;
  try {
    const summary = await summarizeTranscript(transcript);
    summaryMd = summaryToMarkdown(summary);
  } catch (e) {
    console.error("[recordings/webhook] summarize failed", e);
  }

  const { error } = await supabase
    .from("recordings")
    .update({ transcript, summary: summaryMd, status: "transcribed" })
    .eq("id", recordingId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, status: "transcribed" });
}
