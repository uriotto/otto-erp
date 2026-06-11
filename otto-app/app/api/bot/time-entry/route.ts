import { z } from "zod";

import { guardBotRequest } from "@/lib/bot-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createTimeEntryFromTimerForUser } from "@/lib/time-entries";

const QuickLogSchema = z.object({
  customer_id: z.string().uuid().nullish(),
  project_id: z.string().uuid().nullish(),
  task_id: z.string().uuid().nullish(),
  notes: z.string().nullish(),
  duration_minutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60),
  end_time: z.string().nullish(),
  billable: z.boolean().optional(),
});

export async function POST(request: Request) {
  const guard = await guardBotRequest(request);
  if (!guard.ok) return guard.response;
  const auth = guard.auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = QuickLogSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const endTime = data.end_time ? new Date(data.end_time) : new Date();
  const startTime = new Date(endTime.getTime() - data.duration_minutes * 60_000);

  const supabase = createServiceClient();
  const result = await createTimeEntryFromTimerForUser(supabase, auth.userId, auth.tenantId, {
    customer_id: data.customer_id,
    project_id: data.project_id,
    task_id: data.task_id,
    notes: data.notes,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    billable: data.billable ?? true,
  });

  if (result.error) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({
    created: true,
    entry_id: result.entryId,
    duration_minutes: result.durationMinutes,
  });
}
