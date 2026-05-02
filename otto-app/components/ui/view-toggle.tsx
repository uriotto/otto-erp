"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

export type ViewOption<T extends string = string> = {
  id: T;
  icon: LucideIcon;
  label: string;
};

type Props<T extends string> = {
  storageKey: string;
  views: ViewOption<T>[];
  defaultView: T;
  current: T;
  onChange: (view: T) => void;
};

export function ViewToggle<T extends string>({
  storageKey,
  views,
  defaultView,
  current,
  onChange,
}: Props<T>) {
  // hydrate from localStorage on mount
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    setHydrated(true);
    const saved = localStorage.getItem(storageKey) as T | null;
    if (saved && views.some((v) => v.id === saved) && saved !== current) {
      onChange(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(id: T) {
    localStorage.setItem(storageKey, id);
    onChange(id);
  }

  return (
    <div className="border-ink-line bg-cream flex rounded-xl border p-0.5">
      {views.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          title={label}
          onClick={() => handleChange(id)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            current === id ? "bg-navy text-cream-paper shadow-sm" : "text-ink-soft hover:text-navy"
          }`}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

export function useStoredView<T extends string>(
  storageKey: string,
  defaultView: T,
): [T, (v: T) => void] {
  const [view, setView] = useState<T>(defaultView);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey) as T | null;
    if (saved) setView(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function change(v: T) {
    localStorage.setItem(storageKey, v);
    setView(v);
  }

  return [view, change];
}
