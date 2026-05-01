"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, FileImage, File } from "lucide-react";
import { uploadDocument } from "./actions";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";

type CustomerOption = { id: string; name: string; company: string | null };
type ProjectOption = { id: string; name: string; customer_id: string | null };

const TYPE_LABELS: Record<string, string> = {
  contract: "חוזה",
  spec: "אפיון",
  deliverable: "תוצר",
  reference: "חומר רקע",
  other: "אחר",
};

function fileMimeIcon(mime: string | null) {
  if (!mime) return <File size={16} />;
  if (mime.startsWith("image/")) return <FileImage size={16} />;
  if (mime === "application/pdf") return <FileText size={16} />;
  return <FileText size={16} />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDocumentDialog({
  customers,
  projects,
  defaultCustomerId,
  defaultProjectId,
  onClose,
}: {
  customers: CustomerOption[];
  projects: ProjectOption[];
  defaultCustomerId?: string | null;
  defaultProjectId?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("other");
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [signatureRequired, setSignatureRequired] = useState(false);
  const [visibleToClient, setVisibleToClient] = useState(false);
  const [notes, setNotes] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  const filteredProjects = projectId
    ? projects
    : customerId
      ? projects.filter((p) => p.customer_id === customerId)
      : projects;

  function handleFile(file: File) {
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function addTag(e: React.KeyboardEvent) {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim().replace(/,$/, "");
      if (t && !tags.includes(t)) setTags([...tags, t]);
      setTagInput("");
    }
  }

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedFile) {
        toast.error("יש לבחור קובץ");
        return;
      }
      if (!title.trim()) {
        toast.error("כותרת חובה");
        return;
      }

      startTransition(async () => {
        const supabase = createClient();
        const ext = selectedFile.name.split(".").pop() ?? "";
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        setUploadProgress(10);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("documents")
          .upload(path, selectedFile, { upsert: false });

        if (uploadError) {
          toast.error(`שגיאת העלאה: ${uploadError.message}`);
          setUploadProgress(0);
          return;
        }

        setUploadProgress(70);

        const result = await uploadDocument({
          title: title.trim(),
          type: type as "contract" | "spec" | "deliverable" | "reference" | "other",
          customer_id: customerId || null,
          project_id: projectId || null,
          signature_required: signatureRequired,
          visible_to_client: visibleToClient,
          notes: notes.trim() || null,
          tags,
          file_path: uploadData.path,
          file_url: null,
          file_size_bytes: selectedFile.size,
          mime_type: selectedFile.type || null,
        });

        setUploadProgress(100);

        if (!result.ok) {
          toast.error(result.error);
          setUploadProgress(0);
          return;
        }

        toast.success("המסמך הועלה בהצלחה");
        router.refresh();
        onClose();
      });
    },
    [
      selectedFile,
      title,
      type,
      customerId,
      projectId,
      signatureRequired,
      visibleToClient,
      notes,
      tags,
      toast,
      router,
      onClose,
    ],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="bg-navy/30 fixed inset-0" onClick={onClose} />
      <div className="bg-cream-paper border-ink-line relative z-10 max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border sm:max-w-lg sm:rounded-2xl">
        <div className="border-ink-line flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-navy font-semibold">העלאת מסמך</h2>
          <button onClick={onClose} className="text-ink-faded hover:text-navy rounded p-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Drop zone */}
          <div
            className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              dragging ? "border-navy bg-navy/5" : "border-ink-line hover:border-navy/40"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <span className="text-navy">{fileMimeIcon(selectedFile.type)}</span>
                <div className="text-start">
                  <div className="text-navy max-w-[240px] truncate text-sm font-medium">
                    {selectedFile.name}
                  </div>
                  <div className="text-ink-faded text-xs">{formatBytes(selectedFile.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setUploadProgress(0);
                  }}
                  className="text-ink-faded ms-auto hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="text-ink-soft">
                <Upload size={24} className="mx-auto mb-2 opacity-40" />
                <div className="text-sm">גרור קובץ לכאן או לחץ לבחירה</div>
                <div className="text-ink-faded mt-1 text-xs">PDF, Word, Excel, תמונות</div>
              </div>
            )}
          </div>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="bg-cream-deep h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-navy h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-ink-soft mb-1 block text-xs">כותרת</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-ink-line bg-cream focus:border-navy w-full rounded-lg border px-3 py-2 text-sm outline-none"
              placeholder="שם המסמך"
              required
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-ink-soft mb-1 block text-xs">סוג</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="border-ink-line bg-cream focus:border-navy w-full rounded-lg border px-3 py-2 text-sm outline-none"
            >
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Customer + Project */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-ink-soft mb-1 block text-xs">לקוח</label>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setProjectId("");
                }}
                className="border-ink-line bg-cream focus:border-navy w-full rounded-lg border px-3 py-2 text-sm outline-none"
              >
                <option value="">ללא לקוח</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-ink-soft mb-1 block text-xs">פרויקט</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="border-ink-line bg-cream focus:border-navy w-full rounded-lg border px-3 py-2 text-sm outline-none"
              >
                <option value="">ללא פרויקט</option>
                {filteredProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-ink-soft mb-1 block text-xs">תגיות</label>
            <div className="border-ink-line bg-cream focus-within:border-navy flex flex-wrap gap-1.5 rounded-lg border px-3 py-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="bg-navy/10 text-navy flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                >
                  {t}
                  <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}>
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={addTag}
                className="min-w-[80px] flex-1 bg-transparent text-sm outline-none"
                placeholder={tags.length === 0 ? "הוסף תגית + Enter" : ""}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-ink-soft mb-1 block text-xs">הערות</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="border-ink-line bg-cream focus:border-navy w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
              placeholder="הערות נוספות..."
            />
          </div>

          {/* Checkboxes */}
          <div className="flex gap-5">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={signatureRequired}
                onChange={(e) => setSignatureRequired(e.target.checked)}
                className="rounded"
              />
              <span className="text-ink-soft">דורש חתימה</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={visibleToClient}
                onChange={(e) => setVisibleToClient(e.target.checked)}
                className="rounded"
              />
              <span className="text-ink-soft">גלוי ללקוח</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="border-ink-line hover:bg-cream rounded-lg border px-4 py-2 text-sm"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isPending || !selectedFile}
              className="bg-navy text-cream-paper hover:bg-navy/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Spinner size={14} /> מעלה...
                </>
              ) : (
                "העלה מסמך"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
