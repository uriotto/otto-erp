"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const VALID_CONTEXTS = ["customer", "project", "recording", "lead"] as const;

const AgentSchema = z.object({
  name: z.string().min(1, "שם חובה"),
  description: z.string().optional(),
  webhook_url: z.string().url("כתובת Webhook לא תקינה"),
  trigger_contexts: z.array(z.enum(VALID_CONTEXTS)).min(1, "יש לבחור לפחות הקשר אחד"),
  icon: z.string().default("Sparkles"),
  is_active: z.boolean().default(true),
});

export type AgentFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export type ExternalAgent = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  webhook_url: string;
  trigger_contexts: string[];
  icon: string;
  is_active: boolean;
  created_at: string;
};

export async function createAgent(
  _prev: AgentFormState,
  formData: FormData,
): Promise<AgentFormState> {
  const contexts = formData.getAll("trigger_contexts") as string[];
  const raw = {
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    webhook_url: formData.get("webhook_url") as string,
    trigger_contexts: contexts,
    icon: (formData.get("icon") as string) || "Sparkles",
    is_active: true,
  };

  const parsed = AgentSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "לא מחובר" };

  const { data: userRow } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.user.id)
    .single();

  if (!userRow) return { error: "לא נמצא משתמש" };

  const { error } = await supabase.from("external_agents").insert({
    name: parsed.data.name,
    description: parsed.data.description || null,
    webhook_url: parsed.data.webhook_url,
    trigger_contexts: parsed.data.trigger_contexts,
    icon: parsed.data.icon,
    is_active: parsed.data.is_active,
    tenant_id: userRow.tenant_id,
  });

  if (error) return { error: error.message };

  revalidatePath("/agents");
  return { success: true };
}

export async function updateAgent(
  id: string,
  _prev: AgentFormState,
  formData: FormData,
): Promise<AgentFormState> {
  const contexts = formData.getAll("trigger_contexts") as string[];
  const raw = {
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    webhook_url: formData.get("webhook_url") as string,
    trigger_contexts: contexts,
    icon: (formData.get("icon") as string) || "Sparkles",
    is_active: formData.get("is_active") === "true",
  };

  const parsed = AgentSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("external_agents")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      webhook_url: parsed.data.webhook_url,
      trigger_contexts: parsed.data.trigger_contexts,
      icon: parsed.data.icon,
      is_active: parsed.data.is_active,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/agents");
  return { success: true };
}

export async function deleteAgent(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("external_agents").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/agents");
  return {};
}

export async function invokeAgent(
  agentId: string,
  contextType: string,
  contextId: string,
  contextData: Record<string, unknown>,
): Promise<{ invocationId?: string; error?: string }> {
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "לא מחובר" };

  const { data: userRow } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.user.id)
    .single();

  if (!userRow) return { error: "לא נמצא משתמש" };

  const { data: agent } = await supabase
    .from("external_agents")
    .select("webhook_url")
    .eq("id", agentId)
    .single();

  if (!agent) return { error: "סוכן לא נמצא" };

  // יצירת רשומת invocation
  const { data: invocation, error: invErr } = await supabase
    .from("agent_invocations")
    .insert({
      agent_id: agentId,
      context_type: contextType,
      context_id: contextId,
      status: "running",
      tenant_id: userRow.tenant_id,
    })
    .select("id")
    .single();

  if (invErr || !invocation) return { error: invErr?.message ?? "שגיאה ביצירת invocation" };

  // שליחה ל-webhook
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let resultHtml: string | null = null;
    let finalStatus = "completed";
    let errorMsg: string | null = null;

    try {
      const res = await fetch(agent.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invocation_id: invocation.id,
          agent_id: agentId,
          context_type: contextType,
          context_id: contextId,
          context_data: contextData,
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        const text = await res.text();
        try {
          const json = JSON.parse(text) as unknown;
          if (
            json !== null &&
            typeof json === "object" &&
            "result" in json &&
            typeof (json as Record<string, unknown>).result === "string"
          ) {
            resultHtml = (json as Record<string, unknown>).result as string;
          } else {
            resultHtml = text;
          }
        } catch {
          resultHtml = text;
        }
      } else {
        finalStatus = "failed";
        errorMsg = `HTTP ${res.status}`;
      }
    } catch (fetchErr) {
      finalStatus = "failed";
      errorMsg = fetchErr instanceof Error ? fetchErr.message : "שגיאת רשת";
    } finally {
      clearTimeout(timeout);
    }

    await supabase
      .from("agent_invocations")
      .update({
        status: finalStatus,
        result_html: resultHtml,
        error: errorMsg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", invocation.id);
  } catch (err) {
    console.error("[invokeAgent] unexpected error", err);
    await supabase
      .from("agent_invocations")
      .update({
        status: "failed",
        error: err instanceof Error ? err.message : "שגיאה לא צפויה",
        completed_at: new Date().toISOString(),
      })
      .eq("id", invocation.id);
  }

  return { invocationId: invocation.id };
}

export async function getInvocationResult(
  invocationId: string,
): Promise<{ status: string; result_html: string | null; error: string | null } | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("agent_invocations")
    .select("status, result_html, error")
    .eq("id", invocationId)
    .single();

  return data ?? null;
}
