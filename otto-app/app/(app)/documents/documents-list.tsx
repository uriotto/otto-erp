"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Search,
  FileText,
  FileImage,
  File,
  Trash2,
  Download,
  PenLine,
  CheckCircle2,
  Eye,
  EyeOff,
  Filter,
  X,
  LayoutGrid,
  Table2,
  Building2,
} from "lucide-react";
import { deleteDocument, getDocumentSignedUrl, bulkDeleteDocuments } from "./actions";
import { UploadDocumentDialog } from "./upload-document-dialog";
import { SignatureDialog } from "./signature-dialog";
import { DocumentPreviewDialog } from "./document-preview-dialog";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { relativeTimeHebrew } from "@/lib/relative-time";
import { ViewToggle, useStoredView } from "@/components/ui/view-toggle";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";

export type DocumentItem = {
  id: string;
  title: string;
  type: string;
  mime_type: string | null;
  file_url: string | null;
  file_size_bytes: number | null;
  signature_required: boolean;
  signed_at: string | null;
  signed_by_name: string | null;
  visible_to_client: boolean;
  tags: string[];
  notes: string | null;
  created_at: string;
  customer_id: string | null;
  customer_name: string | null;
  project_id: string | null;
  project_name: string | null;
};

type CustomerOption = { id: string; name: string; company: string | null };
type ProjectOption = { id: string; name: string; customer_id: string | null };

const TYPE_LABELS: Record<string, string> = {
  contract: "חוזה",
  spec: "אפיון",
  deliverable: "תוצר",
  reference: "חומר רקע",
  other: "אחר",
};

const TYPE_STYLES: Record<string, string> = {
  contract: "bg-blue-50 text-blue-700 border-blue-200",
  spec: "bg-purple-50 text-purple-700 border-purple-200",
  deliverable: "bg-green-50 text-green-700 border-green-200",
  reference: "bg-amber-50 text-amber-700 border-amber-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileMimeIcon({ mime }: { mime: string | null }) {
  if (!mime) return <File size={20} className="text-ink-faded" />;
  if (mime.startsWith("image/")) return <FileImage size={20} className="text-blue-400" />;
  if (mime === "application/pdf") return <FileText size={20} className="text-red-400" />;
  return <FileText size={20} className="text-ink-faded" />;
}

function ViewButton({ doc }: { doc: DocumentItem }) {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function handleView() {
    startTransition(async () => {
      const res = await getDocumentSignedUrl(doc.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <button
      onClick={handleView}
      disabled={isPending}
      className="text-ink-faded hover:text-navy rounded p-1 transition-colors disabled:opacity-50"
      title="פתח / הורד"
    >
      {isPending ? <Spinner size={13} /> : <Download size={13} />}
    </button>
  );
}

function DeleteButton({ doc }: { doc: DocumentItem }) {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function handleDelete() {
    if (!confirm(`למחוק את "${doc.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteDocument(doc.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("המסמך נמחק");
      router.refresh();
    });
  }

  if (doc.signed_at) return null;

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-ink-faded rounded p-1 transition-colors hover:text-red-500 disabled:opacity-50"
      title="מחק"
    >
      {isPending ? <Spinner size={13} /> : <Trash2 size={13} />}
    </button>
  );
}

export function DocumentsList({
  documents,
  customers,
  projects,
}: {
  documents: DocumentItem[];
  customers: CustomerOption[];
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useStoredView<"grid" | "table">("documents-view", "grid");
  const [showUpload, setShowUpload] = useState(false);
  const [signingDoc, setSigningDoc] = useState<DocumentItem | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();

  const filtered = documents.filter((d) => {
    if (filterType && d.type !== filterType) return false;
    if (filterCustomer && d.customer_id !== filterCustomer) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.title.toLowerCase().includes(q) ||
        d.notes?.toLowerCase().includes(q) ||
        d.customer_name?.toLowerCase().includes(q) ||
        d.project_name?.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const hasFilters = filterType || filterCustomer;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((d) => d.id)));
    }
  }

  function handleBulkDelete() {
    const ids = Array.from(selected);
    if (!confirm(`למחוק ${ids.length} מסמכים? מסמכים חתומים לא יימחקו.`)) return;
    startBulk(async () => {
      const res = await bulkDeleteDocuments(ids);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const msg =
        res.skipped > 0
          ? `נמחקו ${res.deleted} מסמכים (${res.skipped} חתומים נדלגו)`
          : `נמחקו ${res.deleted} מסמכים`;
      toast.success(msg);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-display-md text-navy">מסמכים</h1>
          <p className="text-ink-soft mt-1 text-sm">
            {documents.length} מסמכים
            {documents.filter((d) => d.signature_required && !d.signed_at).length > 0 && (
              <span className="ms-2 text-amber-600">
                · {documents.filter((d) => d.signature_required && !d.signed_at).length} ממתינים
                לחתימה
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle
            storageKey="documents-view"
            views={[
              { id: "grid", icon: LayoutGrid, label: "גריד" },
              { id: "table", icon: Table2, label: "טבלה" },
            ]}
            defaultView="grid"
            current={view}
            onChange={setView}
          />
          <button
            onClick={() => setShowUpload(true)}
            className="bg-navy text-cream-paper hover:bg-navy/90 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
          >
            <Upload size={15} />
            העלאת מסמך
          </button>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-2">
        <div className="border-ink-line bg-cream-paper relative flex-1 overflow-hidden rounded-xl border">
          <Search size={15} className="text-ink-faded absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, תגית, לקוח..."
            className="w-full bg-transparent py-2.5 ps-9 pe-3 text-sm outline-none"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors ${
            hasFilters
              ? "border-navy bg-navy/5 text-navy"
              : "border-ink-line hover:border-navy/40 text-ink-soft"
          }`}
        >
          <Filter size={14} />
          סינון
          {hasFilters && (
            <span className="bg-navy text-cream-paper flex h-4 w-4 items-center justify-center rounded-full text-[10px]">
              {[filterType, filterCustomer].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="bg-cream-paper border-ink-line flex flex-wrap gap-3 rounded-xl border p-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border-ink-line bg-cream focus:border-navy rounded-lg border px-3 py-1.5 text-sm outline-none"
          >
            <option value="">כל הסוגים</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            className="border-ink-line bg-cream focus:border-navy rounded-lg border px-3 py-1.5 text-sm outline-none"
          >
            <option value="">כל הלקוחות</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={() => {
                setFilterType("");
                setFilterCustomer("");
              }}
              className="text-ink-faded hover:text-navy flex items-center gap-1 text-sm"
            >
              <X size={13} /> נקה סינון
            </button>
          )}
        </div>
      )}

      {/* Documents grid/table */}
      {filtered.length === 0 ? (
        <div className="border-ink-line rounded-2xl border py-16 text-center">
          <FileText size={32} className="text-ink-faded mx-auto mb-3 opacity-40" />
          <p className="text-ink-soft text-sm">
            {search || hasFilters ? "לא נמצאו מסמכים" : "אין מסמכים עדיין"}
          </p>
          {!search && !hasFilters && (
            <button
              onClick={() => setShowUpload(true)}
              className="text-navy mt-2 text-sm underline underline-offset-2"
            >
              העלה מסמך ראשון
            </button>
          )}
        </div>
      ) : view === "table" ? (
        <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-ink-line/60 border-b">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="cursor-pointer rounded"
                  />
                </th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">כותרת</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">סוג</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">לקוח</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">פרויקט</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">חתימה</th>
                <th className="text-ink-soft px-4 py-3 text-start font-medium">תאריך</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-ink-line/40 divide-y">
              {filtered.map((doc) => (
                <tr
                  key={doc.id}
                  className={`transition-colors ${selected.has(doc.id) ? "bg-navy/5" : "hover:bg-cream/30"}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(doc.id)}
                      onChange={() => toggleSelect(doc.id)}
                      className="cursor-pointer rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="text-navy text-start font-medium hover:underline"
                      onClick={() => setPreviewDoc(doc)}
                    >
                      {doc.title}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[doc.type] ?? TYPE_STYLES.other}`}
                    >
                      {TYPE_LABELS[doc.type] ?? doc.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {doc.customer_name ? (
                      <span className="text-ink-soft inline-flex items-center gap-1 text-xs">
                        <Building2 size={11} />
                        {doc.customer_name}
                      </span>
                    ) : (
                      <span className="text-ink-faded text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-ink-soft text-xs">{doc.project_name ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {doc.signed_at ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <CheckCircle2 size={11} /> חתום
                      </span>
                    ) : doc.signature_required ? (
                      <span className="text-xs text-amber-600">ממתין</span>
                    ) : (
                      <span className="text-ink-faded text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-ink-soft text-xs">
                      {new Date(doc.created_at).toLocaleDateString("he-IL")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ViewButton doc={doc} />
                      {doc.signature_required && !doc.signed_at && (
                        <button
                          onClick={() => setSigningDoc(doc)}
                          className="rounded p-1 text-amber-600 transition-colors hover:text-amber-700"
                          title="חתום"
                        >
                          <PenLine size={13} />
                        </button>
                      )}
                      <DeleteButton doc={doc} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onSign={() => setSigningDoc(doc)}
              onPreview={() => setPreviewDoc(doc)}
            />
          ))}
        </div>
      )}

      <BulkActionBar
        selectedCount={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            label: "מחק",
            icon: Trash2,
            variant: "danger",
            isPending: bulkPending,
            onClick: handleBulkDelete,
          },
        ]}
      />

      {showUpload && (
        <UploadDocumentDialog
          customers={customers}
          projects={projects}
          onClose={() => setShowUpload(false)}
        />
      )}

      {signingDoc && (
        <SignatureDialog
          documentId={signingDoc.id}
          documentTitle={signingDoc.title}
          onClose={() => setSigningDoc(null)}
        />
      )}

      {previewDoc && <DocumentPreviewDialog doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}

function DocumentCard({
  doc,
  onSign,
  onPreview,
}: {
  doc: DocumentItem;
  onSign: () => void;
  onPreview: () => void;
}) {
  return (
    <div
      className="bg-cream-paper border-ink-line group flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 transition-shadow hover:shadow-sm"
      onClick={onPreview}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="border-ink-line bg-cream mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
          <FileMimeIcon mime={doc.mime_type} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-navy line-clamp-2 text-sm leading-snug font-semibold">
            {doc.title}
          </div>
          {doc.customer_name && (
            <div className="text-ink-faded mt-0.5 truncate text-xs">{doc.customer_name}</div>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-1.5">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[doc.type] ?? TYPE_STYLES.other}`}
        >
          {TYPE_LABELS[doc.type] ?? doc.type}
        </span>
        {doc.signed_at && (
          <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">
            <CheckCircle2 size={10} /> חתום
          </span>
        )}
        {doc.signature_required && !doc.signed_at && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            <PenLine size={10} /> ממתין לחתימה
          </span>
        )}
        {doc.visible_to_client && (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
            <Eye size={10} /> גלוי ללקוח
          </span>
        )}
      </div>

      {/* Tags */}
      {doc.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {doc.tags.map((t) => (
            <span key={t} className="bg-navy/5 text-ink-soft rounded-full px-2 py-0.5 text-xs">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="border-ink-line mt-auto flex items-center justify-between border-t pt-3">
        <span className="text-ink-faded text-xs">{relativeTimeHebrew(doc.created_at)}</span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <ViewButton doc={doc} />
          {doc.signature_required && !doc.signed_at && (
            <button
              onClick={onSign}
              className="rounded p-1 text-amber-600 transition-colors hover:text-amber-700"
              title="חתום"
            >
              <PenLine size={13} />
            </button>
          )}
          <DeleteButton doc={doc} />
        </div>
      </div>
    </div>
  );
}
