"use client";

import { useEffect, useState, useTransition } from "react";
import { X, Download, ExternalLink, FileText, File } from "lucide-react";
import { getDocumentSignedUrl } from "./actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import type { DocumentItem } from "./documents-list";

function isImage(mime: string | null) {
  return !!mime?.startsWith("image/");
}

function isPdf(mime: string | null) {
  return mime === "application/pdf";
}

export function DocumentPreviewDialog({
  doc,
  onClose,
}: {
  doc: DocumentItem;
  onClose: () => void;
}) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const res = await getDocumentSignedUrl(doc.id);
      if (!res.ok) {
        toast.error(res.error);
        onClose();
        return;
      }
      setSignedUrl(res.url);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canPreview = isImage(doc.mime_type) || isPdf(doc.mime_type);

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div className="bg-navy/60 fixed inset-0" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 mx-auto flex h-full w-full max-w-4xl flex-col p-4 sm:p-6">
        {/* Header */}
        <div className="bg-cream-paper border-ink-line mb-3 flex items-center justify-between rounded-2xl border px-4 py-3 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <div className="border-ink-line bg-cream flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
              {isPdf(doc.mime_type) ? (
                <FileText size={15} className="text-red-400" />
              ) : isImage(doc.mime_type) ? (
                <FileText size={15} className="text-blue-400" />
              ) : (
                <File size={15} className="text-ink-faded" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-navy truncate text-sm font-semibold">{doc.title}</div>
              {doc.customer_name && (
                <div className="text-ink-faded text-xs">{doc.customer_name}</div>
              )}
            </div>
          </div>
          <div className="ms-3 flex shrink-0 items-center gap-1">
            {signedUrl && (
              <>
                <a
                  href={signedUrl}
                  download
                  className="border-ink-line hover:bg-cream text-ink-soft flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
                >
                  <Download size={13} />
                  הורד
                </a>
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-ink-line hover:bg-cream text-ink-soft flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
                >
                  <ExternalLink size={13} />
                  פתח בטאב
                </a>
              </>
            )}
            <button
              onClick={onClose}
              className="border-ink-line hover:bg-cream text-ink-soft rounded-lg border p-1.5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-cream-paper border-ink-line flex-1 overflow-hidden rounded-2xl border shadow-sm">
          {isPending || !signedUrl ? (
            <div className="flex h-full items-center justify-center">
              <Spinner size={24} />
            </div>
          ) : isPdf(doc.mime_type) ? (
            <iframe src={signedUrl} className="h-full w-full rounded-2xl" title={doc.title} />
          ) : isImage(doc.mime_type) ? (
            <div className="flex h-full items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signedUrl}
                alt={doc.title}
                className="max-h-full max-w-full rounded-xl object-contain shadow-md"
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <File size={40} className="text-ink-faded opacity-40" />
              <div>
                <p className="text-navy font-medium">{doc.title}</p>
                <p className="text-ink-soft mt-1 text-sm">סוג הקובץ לא תומך בתצוגה מקדימה</p>
              </div>
              <a
                href={signedUrl}
                download
                className="bg-navy text-cream-paper hover:bg-navy/90 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium"
              >
                <Download size={15} />
                הורד קובץ
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
