"use client";

import { KeyboardEvent, useState } from "react";
import { X } from "lucide-react";

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TagsInput({
  value,
  onChange,
  placeholder = "הוסף תגית...",
  disabled,
}: TagsInputProps) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const clean = raw.trim();
    if (!clean) return;
    if (value.includes(clean)) {
      setDraft("");
      return;
    }
    onChange([...value, clean]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
      return;
    }
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2" dir="rtl">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="bg-cream border-ink-line inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                className="text-ink-faded hover:text-navy transition-colors disabled:opacity-50"
                aria-label={`הסר ${tag}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        placeholder={placeholder}
        disabled={disabled}
        className="bg-cream border-ink-line focus:border-navy w-full rounded-md border px-2.5 py-1.5 text-xs transition-colors outline-none disabled:opacity-50"
      />
    </div>
  );
}
