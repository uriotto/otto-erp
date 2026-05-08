"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { X, Upload, Link2, Loader2, FileCheck, Plus, Trash2 } from "lucide-react";
import { updateQuote, type QuoteFormState } from "./actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
const STATUSES = [
  { value: "draft", label: "טיוטה" },
  { value: "sent", label: "נשלחה" },
  { value: "signed", label: "חתומה" },
  { value: "rejected", label: "נדחתה" },
  { value: "expired", label: "פגה תוקף" },
];

type CustomerOption = { id: string; name: string; company: string | null };
type ProjectOption = { id: string; name: string; customer_id?: string | null };
type Module = { id: string; name: string; description: string; price: number; optional: boolean };
type Quote = {
  id: string;
  title: string;
  customer_id: string | null;
  project_id: string | null;
  amount: number | null;
  status: string;
  document_url: string | null;
  notes: string | null;
  valid_until: string | null;
  signed_at: string | null;
  modules?: unknown;
};

function useFileUpload(initialUrl?: string | null, initialName?: string | null) {
  const [uploading, startUpload] = useTransition();
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(initialUrl ?? null);
  const [uploadedName, setUploadedName] = useState<string | null>(initialName ?? null);
  const toast = useToast();

  async function upload(file: File) {
    startUpload(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("לא מחובר");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      if (!profile) {
        toast.error("שגיאה בטעינת פרופיל");
        return;
      }

      const ext = file.name.split(".").pop();
      const path = `${profile.tenant_id}/quotes/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage.from("documents").upload(path, file);
      if (error) {
        toast.error(`שגיאה בהעלאה: ${error.message}`);
        return;
      }

      const { data: signed } = await supabase.storage
        .from("documents")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);

      if (signed?.signedUrl) {
        setUploadedUrl(signed.signedUrl);
        setUploadedName(file.name);
      }
    });
  }

  return { upload, uploading, uploadedUrl, uploadedName, setUploadedUrl, setUploadedName };
}

export function EditQuoteDialog({
  quote,
  customers,
  projects,
  onClose,
}: {
  quote: Quote;
  customers: CustomerOption[];
  projects: ProjectOption[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [state, action, pending] = useActionState<QuoteFormState, FormData>(updateQuote, {});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isStorageUrl =
    quote.document_url?.includes("/storage/") || quote.document_url?.includes("supabase");
  const [docMode, setDocMode] = useState<"url" | "upload">(isStorageUrl ? "upload" : "url");
  const [selectedCustomerId, setSelectedCustomerId] = useState(quote.customer_id ?? "");

  const initialModules = Array.isArray(quote.modules)
    ? (quote.modules as Module[]).map((m) => ({
        id: m.id ?? crypto.randomUUID(),
        name: m.name ?? "",
        description: m.description ?? "",
        price: m.price ?? 0,
        optional: m.optional ?? false,
      }))
    : [];
  const [modules, setModules] = useState<Module[]>(initialModules);

  function addModule() {
    setModules((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", description: "", price: 0, optional: false },
    ]);
  }

  function updateModule(id: string, patch: Partial<Module>) {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function removeModule(id: string) {
    setModules((prev) => prev.filter((m) => m.id !== id));
  }

  const { upload, uploading, uploadedUrl, uploadedName, setUploadedUrl, setUploadedName } =
    useFileUpload(isStorageUrl ? quote.document_url : null, isStorageUrl ? "קובץ קיים" : null);

  const filteredProjects = selectedCustomerId
    ? projects.filter((p) => !p.customer_id || p.customer_id === selectedCustomerId)
    : projects;

  useEffect(() => {
    if (state.success) {
      toast.success("הצעת המחיר עודכנה");
      onClose();
    }
    if (state.error) toast.error(state.error);
  }, [state]);

  const fe = state.fieldErrors ?? {};

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    upload(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="bg-navy/40 fixed inset-0" onClick={onClose} />
      <div className="bg-cream-paper relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-display-sm text-navy">עריכת הצעת מחיר</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-navy rounded-lg p-1">
            <X size={18} />
          </button>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={quote.id} />

          <div>
            <label className="text-navy mb-1 block text-sm font-medium">כותרת *</label>
            <input
              name="title"
              type="text"
              required
              defaultValue={quote.title}
              className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
            />
            {fe.title && <p className="mt-1 text-xs text-red-500">{fe.title[0]}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-navy mb-1 block text-sm font-medium">לקוח *</label>
              <select
                name="customer_id"
                required
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
              >
                <option value="">בחר לקוח</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.company ? ` — ${c.company}` : ""}
                  </option>
                ))}
              </select>
              {fe.customer_id && <p className="mt-1 text-xs text-red-500">{fe.customer_id[0]}</p>}
            </div>

            <div>
              <label className="text-navy mb-1 block text-sm font-medium">פרויקט</label>
              <select
                name="project_id"
                defaultValue={quote.project_id ?? ""}
                className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-navy mb-1 block text-sm font-medium">סכום</label>
              <input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={quote.amount != null ? String(quote.amount) : ""}
                className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                placeholder="₪"
                dir="ltr"
              />
              {fe.amount && <p className="mt-1 text-xs text-red-500">{fe.amount[0]}</p>}
            </div>

            <div>
              <label className="text-navy mb-1 block text-sm font-medium">סטטוס</label>
              <select
                name="status"
                defaultValue={quote.status}
                className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-navy text-sm font-medium">מסמך</label>
              <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setDocMode("url");
                    setUploadedUrl(null);
                    setUploadedName(null);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${
                    docMode === "url"
                      ? "bg-navy text-cream-paper"
                      : "text-ink-soft hover:text-navy bg-white"
                  }`}
                >
                  <Link2 size={11} />
                  קישור
                </button>
                <button
                  type="button"
                  onClick={() => setDocMode("upload")}
                  className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${
                    docMode === "upload"
                      ? "bg-navy text-cream-paper"
                      : "text-ink-soft hover:text-navy bg-white"
                  }`}
                >
                  <Upload size={11} />
                  העלאה
                </button>
              </div>
            </div>

            {docMode === "url" ? (
              <>
                <input
                  name="document_url"
                  type="url"
                  defaultValue={!isStorageUrl ? (quote.document_url ?? "") : ""}
                  className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
                  placeholder="https://drive.google.com/..."
                  dir="ltr"
                />
                <p className="text-ink-faded mt-1 text-xs">Google Drive, Dropbox, או כל URL</p>
              </>
            ) : (
              <>
                <input type="hidden" name="document_url" value={uploadedUrl ?? ""} />
                {uploadedUrl ? (
                  <div className="border-ink-line flex items-center gap-2 rounded-xl border bg-green-50 px-3 py-2.5">
                    <FileCheck size={14} className="shrink-0 text-green-600" />
                    <span className="min-w-0 flex-1 truncate text-sm text-green-700">
                      {uploadedName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedUrl(null);
                        setUploadedName(null);
                      }}
                      className="shrink-0 text-green-600 hover:text-red-500"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="border-ink-line hover:border-navy flex w-full items-center justify-center gap-2 rounded-xl border border-dashed bg-white px-3 py-4 text-sm transition-colors disabled:opacity-60"
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={16} className="text-navy animate-spin" />
                        <span className="text-ink-soft">מעלה...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={16} className="text-ink-faded" />
                        <span className="text-ink-soft">לחץ לבחירת קובץ</span>
                        <span className="text-ink-faded text-xs">(PDF, Word, תמונה, עד 10MB)</span>
                      </>
                    )}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </>
            )}
          </div>

          <div>
            <label className="text-navy mb-1 block text-sm font-medium">תוקף עד</label>
            <input
              name="valid_until"
              type="date"
              defaultValue={quote.valid_until ?? ""}
              className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
              dir="ltr"
            />
          </div>

          <div>
            <label className="text-navy mb-1 block text-sm font-medium">הערות</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={quote.notes ?? ""}
              className="border-ink-line focus:border-navy w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none"
            />
          </div>

          {/* Modules */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-navy text-sm font-medium">מודולים / שירותים</label>
              <button
                type="button"
                onClick={addModule}
                className="text-navy hover:bg-navy/5 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium"
              >
                <Plus size={12} />
                הוסף מודול
              </button>
            </div>
            <input type="hidden" name="modules" value={JSON.stringify(modules)} />
            {modules.length === 0 ? (
              <p className="text-ink-faded border-ink-line rounded-xl border border-dashed py-3 text-center text-xs">
                אין מודולים — לחץ &quot;הוסף מודול&quot; להוספה
              </p>
            ) : (
              <div className="space-y-2">
                {modules.map((m) => (
                  <div key={m.id} className="border-ink-line rounded-xl border bg-white p-3">
                    <div className="mb-2 flex items-start gap-2">
                      <input
                        type="text"
                        placeholder="שם המודול *"
                        value={m.name}
                        onChange={(e) => updateModule(m.id, { name: e.target.value })}
                        className="border-ink-line focus:border-navy min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                      />
                      <input
                        type="number"
                        placeholder="₪ מחיר"
                        value={m.price || ""}
                        min="0"
                        onChange={(e) => updateModule(m.id, { price: Number(e.target.value) })}
                        className="border-ink-line focus:border-navy w-24 shrink-0 rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => removeModule(m.id)}
                        className="text-ink-faded rounded p-1 hover:text-red-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <textarea
                      placeholder="תיאור (אופציונלי)"
                      value={m.description}
                      onChange={(e) => updateModule(m.id, { description: e.target.value })}
                      rows={1}
                      className="border-ink-line focus:border-navy mb-2 w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
                    />
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={m.optional}
                        onChange={(e) => updateModule(m.id, { optional: e.target.checked })}
                        className="rounded accent-gray-700"
                      />
                      <span className="text-ink-soft">אופציונלי (הלקוח יכול לבטל)</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-ink-soft hover:text-navy rounded-xl px-4 py-2.5 text-sm"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={pending || uploading}
              className="bg-navy text-cream-paper hover:bg-navy-deep flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {pending && <Spinner size={14} />}
              {pending ? "שומר..." : "שמור שינויים"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
