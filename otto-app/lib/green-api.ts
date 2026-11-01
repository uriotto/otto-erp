export async function sendWhatsAppMessage(
  phone: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const apiToken = process.env.GREEN_API_API_TOKEN;
  if (!instanceId || !apiToken) {
    return { ok: false, error: "GREEN_API_INSTANCE_ID / GREEN_API_API_TOKEN לא מוגדרים" };
  }

  const digits = phone.replace(/\D/g, "");
  let chatId: string;
  if (digits.startsWith("972")) {
    chatId = digits + "@c.us";
  } else if (digits.startsWith("0")) {
    chatId = "972" + digits.slice(1) + "@c.us";
  } else {
    chatId = digits + "@c.us";
  }

  const res = await fetch(
    `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    },
  );

  if (!res.ok) {
    return { ok: false, error: `שגיאת Green API (${res.status})` };
  }
  return { ok: true };
}
