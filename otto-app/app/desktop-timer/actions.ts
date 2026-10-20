"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type {
  TimerResult,
  TimerSnapshot,
  TimerHistoryCursor,
  TimerHistoryPage,
  TimerHistoryResult,
} from "@/lib/desktop-timer";

const uuid = z.string().uuid();
const date = z
  .string()
  .datetime({ offset: true })
  .refine((v) => Date.parse(v) <= Date.now(), "אין לבחור שעה עתידית");
const fields = z.object({
  customer_id: uuid.nullable(),
  notes: z.string().max(4000),
  started_at: date.optional(),
  project_id: uuid.nullable().optional(),
  task_id: uuid.nullable().optional(),
});
const session = z.object({ session_id: uuid, revision: z.number().int().positive() });

async function invoke(operation: string, input: Json): Promise<TimerResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return { error: "יש להתחבר מחדש" };
    const { data, error } = await supabase.rpc("desktop_timer", {
      p_operation: operation,
      p_input: input,
    });
    if (error) {
      const messages: Record<string, string> = {
        TIMER_ACTIVE: "כבר פועל טיימר. יש לעצור אותו לפני התחלת דיווח חדש.",
        TIMER_STALE: "הטיימר השתנה במכשיר אחר. יש לרענן לפני ניסיון נוסף.",
        ENTRY_STALE: "הרשומה השתנתה במכשיר אחר. יש לרענן לפני עריכה נוספת.",
        ENTRY_LOCKED: "הרשומה כבר חויבה או נסגרה ואינה ניתנת לשינוי או למחיקה כאן.",
        INVALID_INPUT: "נתוני הדיווח אינם תקינים. בדוק לקוח ושעות.",
        NOT_AUTHORIZED: "אין הרשאה לפעולה זו",
      };
      return {
        error:
          messages[error.message] ??
          "הפעולה לא אושרה. רענן את המצב לפני ניסיון נוסף; אם טיימר עדיין פועל, הנתונים שלו נשמרו.",
      };
    }
    // The RPC returns its snapshot inside the same transaction as the mutation.
    return { snapshot: data as unknown as TimerSnapshot };
  } catch {
    return { error: "החיבור נותק. רענן כדי לבדוק אם הפעולה נשמרה לפני ניסיון נוסף." };
  }
}

async function validated(
  operation: string,
  schema: z.ZodType,
  input: unknown,
): Promise<TimerResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "נתוני הדיווח אינם תקינים. בדוק לקוח, הערות ושעות." };
  return invoke(operation, parsed.data as Json);
}

export async function getTimerSnapshot(): Promise<TimerResult> {
  return invoke("snapshot", {});
}
export async function startDesktopTimer(input: z.infer<typeof fields>): Promise<TimerResult> {
  return validated("start", fields, input);
}
export async function updateDesktopTimer(
  input: z.infer<typeof fields> & z.infer<typeof session>,
): Promise<TimerResult> {
  return validated("update", fields.extend({ started_at: date }).extend(session.shape), input);
}
export async function stopDesktopTimer(
  input: z.infer<typeof session> & Partial<z.infer<typeof fields>> & { end_time?: string },
): Promise<TimerResult> {
  return validated(
    "stop",
    fields.partial().extend(session.shape).extend({ end_time: date.optional() }),
    input,
  );
}
export async function cancelDesktopTimer(input: z.infer<typeof session>): Promise<TimerResult> {
  return validated("cancel", session, input);
}
export async function updateDesktopEntry(input: {
  id: string;
  edit_version: string;
  customer_id: string | null;
  notes: string;
  start_time: string;
  end_time: string;
}): Promise<TimerResult> {
  const schema = z
    .object({
      id: uuid,
      edit_version: z.string().regex(/^\d+$/),
      customer_id: uuid.nullable(),
      notes: z.string().max(4000),
      start_time: date,
      end_time: date,
    })
    .refine((v) => Date.parse(v.end_time) > Date.parse(v.start_time));
  return validated("entry", schema, input);
}

export async function deleteDesktopEntry(input: {
  id: string;
  edit_version: string;
}): Promise<TimerResult> {
  return validated(
    "delete",
    z.object({ id: uuid, edit_version: z.string().regex(/^\d+$/) }),
    input,
  );
}

export async function getDesktopTimerHistory(
  cursor?: TimerHistoryCursor,
): Promise<TimerHistoryResult> {
  const parsed = z
    .object({ start_time: z.string().datetime({ offset: true }), id: uuid })
    .strict()
    .optional()
    .safeParse(cursor);
  if (!parsed.success) return { error: "בקשת ההיסטוריה אינה תקינה. יש לרענן ולנסות שוב." };
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return { error: "יש להתחבר מחדש" };
    const { data, error } = await supabase.rpc("desktop_timer_history", {
      p_cursor: parsed.data ?? null,
    });
    if (error) return { error: "לא ניתן לטעון דיווחים קודמים. נסה שוב." };
    return { page: data as unknown as TimerHistoryPage };
  } catch {
    return { error: "החיבור נותק. נסה לטעון שוב את הדיווחים הקודמים." };
  }
}
