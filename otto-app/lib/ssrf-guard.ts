import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** האם כתובת IP היא פנימית/loopback/link-local/metadata (יעד SSRF). */
function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const parts = ip.split(".").map(Number);
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 0;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) || // link-local + cloud metadata (169.254.169.254)
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) // CGNAT
    );
  }
  if (kind === 6) {
    const v = ip.toLowerCase();
    // ipv4-mapped (::ffff:a.b.c.d) - בדיקת החלק ה-v4
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateIp(mapped[1]);
    return (
      v === "::1" ||
      v === "::" ||
      v.startsWith("fe80") || // link-local
      v.startsWith("fc") ||
      v.startsWith("fd") // unique-local
    );
  }
  return true; // לא IP מזוהה - לחסום מחמירה
}

/**
 * SSRF guard: זורק אם ה-URL אינו https ציבורי. מונע פנייה מהשרת ל-IP פנימי
 * או ל-cloud metadata endpoint. מאמת את כל ה-IPs שאליהם ה-hostname נפתר.
 * (לא מונע DNS rebinding מלא - שכבת הגנה ראשונה.)
 */
export async function assertPublicHttpsUrl(rawUrl: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("invalid url");
  }
  if (u.protocol !== "https:") throw new Error("only https is allowed");

  const host = u.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("blocked private address");
    return;
  }

  const resolved = await lookup(host, { all: true });
  if (resolved.length === 0) throw new Error("dns resolution failed");
  for (const r of resolved) {
    if (isPrivateIp(r.address)) throw new Error("blocked private address");
  }
}
