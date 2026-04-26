export type RecentItem = {
  type: "customer" | "lead";
  id: string;
  label: string;
  sublabel?: string;
  visitedAt: number;
};

const STORAGE_KEY = "otto:recent-items";
const MAX_ITEMS = 20;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readAll(): RecentItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i): i is RecentItem =>
        i &&
        typeof i === "object" &&
        (i.type === "customer" || i.type === "lead") &&
        typeof i.id === "string" &&
        typeof i.label === "string" &&
        typeof i.visitedAt === "number",
    );
  } catch {
    return [];
  }
}

function writeAll(items: RecentItem[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota / serialization errors
  }
}

export function pushRecent(item: Omit<RecentItem, "visitedAt">): void {
  if (!isBrowser()) return;
  const key = `${item.type}:${item.id}`;
  const existing = readAll().filter((i) => `${i.type}:${i.id}` !== key);
  const next: RecentItem[] = [{ ...item, visitedAt: Date.now() }, ...existing].slice(0, MAX_ITEMS);
  writeAll(next);
}

export function getRecent(limit?: number): RecentItem[] {
  const all = readAll().sort((a, b) => b.visitedAt - a.visitedAt);
  return typeof limit === "number" ? all.slice(0, limit) : all;
}

export function clearRecent(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
