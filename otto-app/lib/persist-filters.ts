const isBrowser = () => typeof window !== "undefined";

export function saveFilters(key: string, params: Record<string, string>): void {
  if (!isBrowser()) return;
  try {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v && v !== "all" && v !== "")
    );
    if (Object.keys(clean).length > 0) {
      localStorage.setItem(`otto:filters:${key}`, JSON.stringify(clean));
    } else {
      localStorage.removeItem(`otto:filters:${key}`);
    }
  } catch {}
}

export function loadFilters(key: string): Record<string, string> | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(`otto:filters:${key}`);
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}
