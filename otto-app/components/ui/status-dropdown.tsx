"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Spinner } from "./spinner";

export type StatusOption = {
  readonly value: string;
  readonly label: string;
  readonly cls: string;
};

type Props = {
  status: string | null;
  options: readonly StatusOption[];
  onSave: (val: string) => Promise<void>;
};

export function StatusDropdown({ status, options, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, openUp: false });
  const btnRef = useRef<HTMLButtonElement>(null);

  const opt = options.find((o) => o.value === status) ??
    options[0] ?? { value: "", label: "—", cls: "" };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!btnRef.current?.contains(target)) {
        const portal = document.getElementById("status-dropdown-portal");
        if (!portal?.contains(target)) setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // close on scroll
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [open]);

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const dropH = options.length * 36 + 8;
    const openUp = rect.bottom + dropH > window.innerHeight - 8;
    setCoords({
      top: openUp ? rect.top + window.scrollY - dropH - 4 : rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: Math.max(rect.width, 110),
      openUp,
    });
    setOpen((v) => !v);
  }

  const dropdown = open
    ? createPortal(
        <div
          id="status-dropdown-portal"
          style={{
            position: "absolute",
            top: coords.top,
            left: coords.left,
            minWidth: coords.width,
            zIndex: 9999,
          }}
          className="bg-cream-paper border-ink-line rounded-xl border shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                setOpen(false);
                startTransition(() => onSave(s.value));
              }}
              className={`hover:bg-cream-deep flex w-full items-center gap-2 px-3 py-2 text-start text-xs transition-colors first:rounded-t-xl last:rounded-b-xl ${
                s.value === opt.value ? "font-semibold" : ""
              }`}
            >
              <span className={`h-2 w-2 rounded-full border ${s.cls}`} />
              {s.label}
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        disabled={pending}
        className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-all hover:opacity-80 disabled:opacity-50 ${opt.cls}`}
      >
        {pending ? <Spinner size={10} /> : <ChevronDown size={10} />}
        {opt.label}
      </button>
      {dropdown}
    </>
  );
}
