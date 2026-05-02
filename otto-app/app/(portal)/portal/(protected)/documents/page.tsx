import { getPortalCustomer } from "@/lib/portal";
import { FileText, FileImage, File, Download, PenLine, CheckCircle2, Eye } from "lucide-react";

export const metadata = { title: "מסמכים — פורטל לקוחות" };

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

function FileIcon({ mime }: { mime: string | null }) {
  if (!mime) return <File size={18} className="text-ink-faded" />;
  if (mime.startsWith("image/")) return <FileImage size={18} className="text-sky-500" />;
  if (mime.includes("pdf") || mime.includes("word") || mime.includes("document"))
    return <FileText size={18} className="text-blue-500" />;
  return <File size={18} className="text-ink-faded" />;
}

export default async function PortalDocumentsPage() {
  const { supabase, customer } = await getPortalCustomer();

  const { data: docs } = await supabase
    .from("documents")
    .select(
      "id, title, type, mime_type, file_url, file_path, file_size_bytes, signature_required, signed_at, signed_by_name, visible_to_client, tags, created_at",
    )
    .eq("customer_id", customer.id)
    .eq("visible_to_client", true)
    .order("created_at", { ascending: false });

  const rows = docs ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md text-navy">מסמכים</h1>
        <p className="text-ink-soft mt-1 text-sm">{rows.length} מסמכים</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-ink-faded py-12 text-center text-sm">אין מסמכים עדיין</p>
      ) : (
        <div className="bg-cream-paper border-ink-line overflow-hidden rounded-2xl border">
          <ul className="divide-ink-line/60 divide-y">
            {rows.map((doc) => {
              const fileUrl = doc.file_url ?? doc.file_path;
              const isSigned = !!doc.signed_at;

              return (
                <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="bg-cream-deep border-ink-line shrink-0 rounded-lg border p-2">
                    <FileIcon mime={doc.mime_type} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-navy truncate text-sm font-medium">{doc.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[doc.type] ?? TYPE_STYLES.other}`}
                      >
                        {TYPE_LABELS[doc.type] ?? doc.type}
                      </span>
                      {doc.file_size_bytes && (
                        <span className="text-ink-faded text-xs" dir="ltr">
                          {formatBytes(doc.file_size_bytes)}
                        </span>
                      )}
                      {doc.signature_required && (
                        <span className="inline-flex items-center gap-1 text-xs">
                          {isSigned ? (
                            <>
                              <CheckCircle2 size={11} className="text-emerald-500" />
                              <span className="text-emerald-600">
                                נחתם ע״י {doc.signed_by_name}
                              </span>
                            </>
                          ) : (
                            <>
                              <PenLine size={11} className="text-amber-500" />
                              <span className="text-amber-600">ממתין לחתימה</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {fileUrl && (
                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border-ink-line text-ink-soft hover:text-navy hover:border-navy inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                      >
                        <Eye size={13} />
                        צפה
                      </a>
                      <a
                        href={fileUrl}
                        download
                        className="border-ink-line text-ink-soft hover:text-navy hover:border-navy inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                      >
                        <Download size={13} />
                        הורד
                      </a>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
