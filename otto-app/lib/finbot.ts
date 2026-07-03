/**
 * Finbot Income API client - direct document generation (replaces the Make.com relay).
 *
 * Docs: https://finbot.helpjuice.com/he_IL/api-docs-create-income
 * Endpoint: POST https://api.finbotai.co.il/income, auth via `secret` header.
 *
 * Single-user setup: one API key in FINBOT_API_KEY (not per-tenant).
 * Finbot emails the document to the customer automatically when an email is provided.
 *
 * Two entry points, both taking a Supabase client (cookie-bound or service-role),
 * following the lib/time-entries.ts pattern so server actions, API routes and cron
 * share the exact same logic:
 *   - issueDocumentForInvoice: payment_request / tax_invoice / invoice at creation time
 *   - issueReceiptForPayment: receipt / tax_invoice_receipt when a payment is recorded
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ilDayKey, todayIL } from "@/lib/dates";

type Supabase = SupabaseClient<Database>;

const FINBOT_URL = "https://api.finbotai.co.il/income";
const TIMEOUT_MS = 15_000;

/** Finbot document type codes. */
const FINBOT_DOC_TYPE: Record<string, string> = {
  tax_invoice: "0", // חשבונית מס
  receipt: "1", // קבלה
  tax_invoice_receipt: "2", // חשבונית מס קבלה
  payment_request: "3", // דרישת תשלום
};

/** OTTO payment_method -> Finbot payments[].type code. */
const FINBOT_PAYMENT_TYPE: Record<string, string> = {
  cash: "0",
  bank_transfer: "1",
  credit_card: "2",
  check: "3",
  bit: "8",
  other: "7",
};

const DOC_LABELS: Record<string, string> = {
  payment_request: "דרישת תשלום",
  tax_invoice: "חשבונית מס",
  tax_invoice_receipt: "חשבונית מס קבלה",
  receipt: "קבלה",
};

/** Document types issued at invoice-creation time. Receipts wait for a payment. */
const CREATION_DOC_TYPES = new Set(["payment_request", "tax_invoice"]);

// Success: HTTP 201 with { status: 1, data: "https://...", message?: string }.
const SuccessSchema = z.looseObject({
  status: z.union([z.number(), z.string()]),
  message: z.string().optional(),
  data: z.unknown().optional(),
});

// Error: HTTP 4xx with a top-level array [{ code, message }].
const ErrorArraySchema = z.array(
  z.looseObject({
    code: z.union([z.number(), z.string()]).optional(),
    message: z.string().optional(),
  }),
);

export type FinbotResult =
  | { ok: true; url: string | null }
  | { ok: false; error: string; skipped?: boolean };

export function isFinbotConfigured(): boolean {
  return Boolean(process.env.FINBOT_API_KEY);
}

/** "yyyy-mm-dd" -> "dd/mm/yyyy" (Finbot date format). Falls back to today (Israel). */
function dateKeyToFinbot(key: string | null): string {
  const [y, m, d] = (key ?? "").split("-");
  if (!y || !m || !d) {
    const [ty, tm, td] = todayIL().split("-");
    return `${td}/${tm}/${ty}`;
  }
  return `${d}/${m}/${y}`;
}

function extractDocumentUrl(data: unknown): string | null {
  if (typeof data === "string" && data.startsWith("http")) return data;
  if (data && typeof data === "object") {
    for (const key of ["url", "link", "document_url", "doc_url"]) {
      const v = (data as Record<string, unknown>)[key];
      if (typeof v === "string" && v.startsWith("http")) return v;
    }
  }
  return null;
}

async function callFinbot(body: Record<string, unknown>): Promise<FinbotResult> {
  const secret = process.env.FINBOT_API_KEY;
  if (!secret) {
    return { ok: false, error: "FINBOT_API_KEY לא מוגדר", skipped: true };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(FINBOT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", secret },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const json: unknown = await res.json().catch(() => null);

    // Error responses come back as a top-level array [{ code, message }].
    const errArr = ErrorArraySchema.safeParse(json);
    if (errArr.success) {
      const details = errArr.data.map((e) => e.message).filter((m): m is string => Boolean(m));
      return {
        ok: false,
        error: details.length > 0 ? details.join("; ") : `שגיאת פינבוט (HTTP ${res.status})`,
      };
    }

    const success = SuccessSchema.safeParse(json);
    if (success.success && Number(success.data.status) === 1) {
      return { ok: true, url: extractDocumentUrl(success.data.data) };
    }
    if (success.success) {
      return { ok: false, error: success.data.message || "פינבוט החזיר סטטוס שאינו הצלחה" };
    }

    return { ok: false, error: `תשובה לא צפויה מפינבוט (HTTP ${res.status})` };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "פינבוט לא הגיב בזמן (timeout)" };
    }
    return { ok: false, error: err instanceof Error ? err.message : "שגיאת רשת מול פינבוט" };
  }
}

type CustomerRow = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  company_registration_number: string | null;
};

function customerPayload(customer: CustomerRow): Record<string, unknown> {
  return {
    name: customer.name.slice(0, 100),
    ...(customer.email ? { email: customer.email.slice(0, 50) } : {}),
    ...(customer.phone ? { phone: customer.phone.slice(0, 20) } : {}),
    ...(customer.address ? { address: customer.address.slice(0, 100) } : {}),
    ...(customer.company_registration_number
      ? { tax: customer.company_registration_number.slice(0, 9) }
      : {}),
    save: false,
  };
}

async function loadInvoiceContext(supabase: Supabase, tenantId: string, invoiceId: string) {
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, customer_id, number, type, document_type, status, issue_date, due_date, subtotal, tax_rate, total_amount, currency, notes, finbot_invoice_id, finbot_url",
    )
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!invoice) return { invoice: null, customer: null, items: [] as never[] };

  const [{ data: customer }, { data: items }] = await Promise.all([
    invoice.customer_id
      ? supabase
          .from("customers")
          .select("name, email, phone, address, company_registration_number")
          .eq("id", invoice.customer_id)
          .eq("tenant_id", tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("invoice_items")
      .select("description, quantity, unit_price, order_index")
      .eq("invoice_id", invoiceId)
      .order("order_index", { ascending: true }),
  ]);

  return { invoice, customer, items: items ?? [] };
}

/**
 * Issues the Finbot document for a freshly created (or retried) invoice and stores
 * the returned document link on the invoice. Prices are sent before VAT
 * (vatType:false) - matching how invoice_items are stored.
 *
 * Receipt-flavoured document types are NOT issued here (a receipt needs a payment);
 * they are produced by issueReceiptForPayment when the payment is recorded.
 */
export async function issueDocumentForInvoice(
  supabase: Supabase,
  tenantId: string,
  invoiceId: string,
): Promise<FinbotResult> {
  const { invoice, customer, items } = await loadInvoiceContext(supabase, tenantId, invoiceId);
  if (!invoice) return { ok: false, error: "חשבונית לא נמצאה" };
  if (!customer) return { ok: false, error: "ללקוח של החשבונית אין רשומה - לא ניתן להפיק מסמך" };
  if (items.length === 0) return { ok: false, error: "לחשבונית אין שורות פריטים" };

  const documentType = invoice.document_type ?? "payment_request";
  if (!CREATION_DOC_TYPES.has(documentType)) {
    // Receipts are issued on payment, not on creation - not an error.
    return { ok: true, url: invoice.finbot_url ?? null };
  }
  if (invoice.finbot_url) {
    return { ok: false, error: "כבר הופק מסמך פינבוט לחשבונית זו" };
  }

  const result = await callFinbot({
    type: FINBOT_DOC_TYPE[documentType],
    date: dateKeyToFinbot(invoice.issue_date),
    language: "HE",
    currency: invoice.currency ?? "ILS",
    vatType: false,
    rounding: false,
    description: `${DOC_LABELS[documentType]}${invoice.number ? ` ${invoice.number}` : ""}`.slice(
      0,
      200,
    ),
    ...(invoice.notes ? { remark: invoice.notes.slice(0, 1500) } : {}),
    customer: customerPayload(customer),
    items: items.map((it) => ({
      name: (it.description || "שירות").slice(0, 100),
      amount: Number(it.quantity),
      price: Number(it.unit_price),
    })),
  });

  if (result.ok && result.url) {
    await supabase
      .from("invoices")
      .update({ finbot_url: result.url })
      .eq("id", invoiceId)
      .eq("tenant_id", tenantId);
  }

  return result;
}

export type PaymentForReceipt = {
  amount: number;
  method: string;
  paid_at: string | null;
  reference: string | null;
  card_last_4: string | null;
};

/**
 * Issues a receipt (קבלה) or tax-invoice-receipt (חשבונית מס קבלה) in Finbot for a
 * recorded payment. Amounts are VAT-inclusive (vatType:true) with a single line for
 * the paid sum, so items always match payments - including partial payments.
 */
export async function issueReceiptForPayment(
  supabase: Supabase,
  tenantId: string,
  invoiceId: string,
  payment: PaymentForReceipt,
  issueDocument: "receipt" | "tax_invoice_receipt",
): Promise<FinbotResult> {
  const { invoice, customer } = await loadInvoiceContext(supabase, tenantId, invoiceId);
  if (!invoice) return { ok: false, error: "חשבונית לא נמצאה" };
  if (!customer) return { ok: false, error: "ללקוח של החשבונית אין רשומה - לא ניתן להפיק קבלה" };

  const amount = Math.round(Number(payment.amount) * 100) / 100;
  if (!(amount > 0)) return { ok: false, error: "סכום תשלום לא תקין" };

  const paidDate = payment.paid_at ? new Date(payment.paid_at) : new Date();
  const paidKey = Number.isNaN(paidDate.getTime()) ? null : ilDayKey(paidDate);

  const label = invoice.number ? `תשלום עבור חשבונית ${invoice.number}` : "תשלום עבור חשבונית";

  const result = await callFinbot({
    type: FINBOT_DOC_TYPE[issueDocument],
    date: dateKeyToFinbot(paidKey),
    language: "HE",
    currency: invoice.currency ?? "ILS",
    vatType: true,
    rounding: false,
    description: label.slice(0, 200),
    customer: customerPayload(customer),
    items: [{ name: label.slice(0, 100), amount: 1, price: amount }],
    payments: [
      {
        type: FINBOT_PAYMENT_TYPE[payment.method] ?? FINBOT_PAYMENT_TYPE.other,
        date: dateKeyToFinbot(paidKey),
        sum: amount,
        ...(payment.method === "credit_card" && payment.card_last_4
          ? { cardNumber: Number(payment.card_last_4) }
          : {}),
        ...(payment.reference ? { transactionNumber: payment.reference.slice(0, 40) } : {}),
      },
    ],
  });

  // If the invoice never got a Finbot document (e.g. document_type was a receipt
  // flavour to begin with), the receipt link becomes its document link.
  if (result.ok && result.url && !invoice.finbot_url) {
    await supabase
      .from("invoices")
      .update({ finbot_url: result.url })
      .eq("id", invoiceId)
      .eq("tenant_id", tenantId);
  }

  return result;
}
