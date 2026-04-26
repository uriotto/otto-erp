"use client";

import { MessageCircle } from "lucide-react";

export function WhatsAppButton({
  phone,
  variant = "icon",
}: {
  phone: string | null;
  variant?: "icon" | "full";
}) {
  if (!phone) return null;
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const href = `https://wa.me/${normalized}`;

  if (variant === "icon") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title="שלח וואטסאפ"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-green-200 bg-green-50 text-green-600 transition-colors hover:bg-green-100"
        aria-label="שלח וואטסאפ"
      >
        <MessageCircle size={13} />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100"
    >
      <MessageCircle size={14} />
      וואטסאפ
    </a>
  );
}

function normalizePhone(raw: string): string | null {
  // משאיר רק ספרות + סימן פלוס
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  // +972XXXXXXXXX → 972XXXXXXXXX
  if (cleaned.startsWith("+")) return cleaned.slice(1);

  // 0XXXXXXXXX (ישראלי) → 972XXXXXXXXX
  if (cleaned.startsWith("0")) return "972" + cleaned.slice(1);

  return cleaned;
}
