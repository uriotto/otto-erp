/**
 * צינור תמלול+סיכום של הקלטות בענן.
 *
 * זהה למנגנון שרץ בכלי המק (call-capture), אבל בצד השרת של OTTO:
 *  - submitTranscription: שולח URL של אודיו ל-RunPod (ivrit.ai) עם webhook callback.
 *  - extractTranscript: מחלץ את הטקסט המתומלל מתשובת RunPod (כולל ניקוי חזרות).
 *  - summarizeTranscript: מסכם את התמלול עם Claude (אותו prompt של המק).
 *  - summaryToMarkdown: הופך את הסיכום המובנה ל-markdown לשמירה בכרטיס.
 */

const RUNPOD_ENDPOINT = "https://api.runpod.ai/v2/kqbaw3igklde92";
const RUNPOD_MODEL = "ivrit-ai/whisper-large-v3-turbo-ct2";
const SUMMARY_MODEL = "claude-sonnet-4-6";

/** שולח אודיו ל-RunPod ומחזיר job id. RunPod ידפוק ל-webhookUrl כשיסיים. */
export async function submitTranscription(audioUrl: string, webhookUrl: string): Promise<string> {
  const key = process.env.RUNPOD_API_KEY;
  if (!key) throw new Error("Missing RUNPOD_API_KEY");

  const res = await fetch(`${RUNPOD_ENDPOINT}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        model: RUNPOD_MODEL,
        transcribe_args: {
          url: audioUrl,
          language: "he",
          transcription: "plain_text",
          diarization: true,
        },
      },
      webhook: webhookUrl,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`RunPod submit failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("RunPod response missing job id");
  return data.id;
}

/** אוסף רקורסיבית את כל שדות ה-"text" מתשובת RunPod. */
function collectText(obj: unknown, parts: string[]): void {
  if (Array.isArray(obj)) {
    for (const v of obj) collectText(v, parts);
    return;
  }
  if (obj && typeof obj === "object") {
    const rec = obj as Record<string, unknown>;
    if (typeof rec.text === "string") parts.push(rec.text);
    for (const v of Object.values(rec)) collectText(v, parts);
  }
}

/**
 * מחלץ את הטקסט המתומלל מ-output של RunPod.
 * מסיר חזרות עוקבות זהות (הזיות Whisper על קטעי שקט).
 */
export function extractTranscript(output: unknown): string {
  const parts: string[] = [];
  collectText(output, parts);
  const deduped: string[] = [];
  for (const p of parts) {
    const last = deduped[deduped.length - 1];
    if (last === undefined || last.trim() !== p.trim()) {
      deduped.push(p);
    }
  }
  return deduped.join(" ").trim();
}

export type CallSummary = {
  meeting_type?: string;
  participants?: string[];
  summary?: string;
  decisions?: string[];
  promises?: { who?: string; what?: string; deadline?: string | null }[];
  scope_or_pricing_changes?: string[];
  issues?: string[];
  positive?: string[];
  next_actions?: { who?: string; what?: string }[];
  open_questions?: string[];
};

const SUMMARY_SYSTEM =
  "אתה עוזר שמסכם תמלולי שיחות עסקיות עבור אורי פולק, בעל עסק אוטומציה ופיתוח " +
  "לעסקי שירות. סוגי שיחות: פגישת לקוח קיים, שיחת מכירה/ליד, פגישת עבודה, ייעוץ. " +
  "חלץ מהתמלול סיכום מובנה, מדויק ופעולתי. אל תמציא - רק מה שנאמר בפועל. " +
  "אם נושא לא הוזכר, החזר רשימה ריקה. " +
  "לעולם אל תשתמש ב-em dash (—) או en dash (–) - תמיד מקף רגיל (-).";

const SUMMARY_USER_TMPL = `סכם את תמלול השיחה. החזר JSON תקין בלבד במבנה:
{
  "meeting_type": "סוג השיחה",
  "participants": ["מי השתתף"],
  "summary": "תקציר 2-4 משפטים",
  "decisions": ["החלטות שהתקבלו, כולל 'החלטנו לא לעשות X'"],
  "promises": [{"who": "מי", "what": "מה הובטח", "deadline": "תאריך אם סוכם אחרת null"}],
  "scope_or_pricing_changes": ["שינויי סקופ או תמחור"],
  "issues": ["בעיות/תסכולים שהוזכרו"],
  "positive": ["מחמאות/שביעות רצון"],
  "next_actions": [{"who": "מי אחראי", "what": "מה לעשות"}],
  "open_questions": ["שאלות שנשארו פתוחות"]
}

תמלול:
__TRANSCRIPT__`;

/** מסכם תמלול עם Claude. מחזיר אובייקט מובנה. */
export async function summarizeTranscript(transcript: string): Promise<CallSummary> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      max_tokens: 2000,
      system: SUMMARY_SYSTEM,
      messages: [
        { role: "user", content: SUMMARY_USER_TMPL.replace("__TRANSCRIPT__", transcript) },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic summarize failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { content?: { text?: string }[] };
  const text = data.content?.[0]?.text?.trim() ?? "";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Claude response missing JSON");
  return JSON.parse(text.slice(start, end + 1)) as CallSummary;
}

/** הופך את הסיכום המובנה ל-markdown קריא לשמירה בכרטיס. */
export function summaryToMarkdown(s: CallSummary): string {
  const lines: string[] = [s.summary ?? ""];
  if (s.decisions?.length) {
    lines.push("", "## החלטות", ...s.decisions.map((d) => `- ${d}`));
  }
  if (s.next_actions?.length) {
    lines.push(
      "",
      "## צעדים הבאים",
      ...s.next_actions.map((a) => `- ${a.who ?? ""}: ${a.what ?? ""}`),
    );
  }
  if (s.issues?.length) {
    lines.push("", "## בעיות", ...s.issues.map((i) => `- ${i}`));
  }
  return lines.join("\n");
}
