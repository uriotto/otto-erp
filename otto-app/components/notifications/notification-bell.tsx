"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, OctagonAlert } from "lucide-react";

import { markAllNotificationsRead, markNotificationRead } from "@/app/(app)/notifications/actions";
import type { NotificationItem, NotificationsResponse } from "@/app/api/notifications/route";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { relativeTimeHebrew } from "@/lib/relative-time";

const POLL_MS = 60_000;

const SEVERITY_STYLES: Record<
  NotificationItem["severity"],
  { icon: React.ReactNode; bar: string }
> = {
  info: {
    icon: <Info size={16} className="text-sky-600" />,
    bar: "bg-sky-500",
  },
  warning: {
    icon: <AlertTriangle size={16} className="text-amber-600" />,
    bar: "bg-amber-500",
  },
  critical: {
    icon: <OctagonAlert size={16} className="text-rose-600" />,
    bar: "bg-rose-500",
  },
  success: {
    icon: <CheckCircle2 size={16} className="text-emerald-600" />,
    bar: "bg-emerald-500",
  },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationsResponse>({ unreadCount: 0, items: [] });
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as NotificationsResponse;
      setData(json);
    } catch {
      // swallow — best-effort polling
    } finally {
      setLoading(false);
    }
  }, []);

  // initial fetch + polling + focus refresh
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, POLL_MS);
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function handleClickItem(n: NotificationItem) {
    if (!n.read_at) {
      // optimistic
      setData((prev) => ({
        unreadCount: Math.max(0, prev.unreadCount - 1),
        items: prev.items.map((it) =>
          it.id === n.id ? { ...it, read_at: new Date().toISOString() } : it,
        ),
      }));
      startTransition(async () => {
        const result = await markNotificationRead(n.id);
        if (result?.error) {
          toast.error(result.error);
          void refresh();
        }
      });
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  function handleMarkAll() {
    if (data.unreadCount === 0) return;
    setData((prev) => ({
      unreadCount: 0,
      items: prev.items.map((it) => ({
        ...it,
        read_at: it.read_at ?? new Date().toISOString(),
      })),
    }));
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result?.error) {
        toast.error(result.error);
        void refresh();
      }
    });
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="התראות"
        aria-haspopup="true"
        aria-expanded={open}
        className="bg-cream-paper border-ink-line text-ink-soft hover:border-navy hover:text-navy relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors"
      >
        <Bell className="h-[18px] w-[18px]" />
        {data.unreadCount > 0 && (
          <span
            aria-label={`${data.unreadCount} התראות חדשות`}
            className="absolute -end-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white tabular-nums"
          >
            {data.unreadCount > 99 ? "99+" : data.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="רשימת התראות"
          className="bg-cream-paper border-ink-line absolute end-0 z-50 mt-2 flex w-[360px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border shadow-2xl"
        >
          <div className="border-ink-line flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-navy text-sm font-semibold">התראות</h3>
              {loading && <Spinner size={12} className="text-ink-faded" />}
            </div>
            {data.unreadCount > 0 && (
              <span className="text-ink-soft text-xs">{data.unreadCount} לא נקראו</span>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {data.items.length === 0 ? (
              <div className="text-ink-soft px-4 py-10 text-center text-sm">אין התראות כרגע</div>
            ) : (
              <ul className="divide-ink-line/70 divide-y">
                {data.items.map((n) => {
                  const sev = SEVERITY_STYLES[n.severity] ?? SEVERITY_STYLES.info;
                  const unread = !n.read_at;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleClickItem(n)}
                        className={`group relative flex w-full items-start gap-3 px-4 py-3 text-start transition-colors ${
                          unread ? "bg-cream-paper" : "bg-cream-paper/60"
                        } hover:bg-cream-deep/40`}
                      >
                        <span
                          aria-hidden
                          className={`absolute start-0 top-3 h-[calc(100%-1.5rem)] w-[3px] rounded-full ${
                            unread ? sev.bar : "bg-transparent"
                          }`}
                        />
                        <span className="mt-0.5 shrink-0">{sev.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="text-navy block truncate text-sm font-semibold">
                            {n.title}
                          </span>
                          {n.body && (
                            <span className="text-ink-soft mt-0.5 line-clamp-2 block text-xs">
                              {n.body}
                            </span>
                          )}
                          <span className="text-ink-faded mt-1 block text-[11px]">
                            {relativeTimeHebrew(n.created_at)}
                          </span>
                        </span>
                        {unread && (
                          <span
                            aria-hidden
                            className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-rose-500"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-ink-line flex items-center justify-between border-t px-4 py-2.5">
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={pending || data.unreadCount === 0}
              className="text-navy hover:text-navy-deep flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCheck size={14} />
              סמן הכל כנקרא
            </button>
            <button
              type="button"
              onClick={() => {
                void refresh();
              }}
              className="text-ink-soft hover:text-navy text-xs transition-colors"
            >
              רענן
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
