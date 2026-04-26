"use server";

import { createClient } from "@/lib/supabase/server";

type SupabaseAny = Awaited<ReturnType<typeof createClient>>;

interface InvoiceCsvRow {
  id: string;
  number: string | null;
  type: string | null;
  status: string | null;
  customer_id: string | null;
  issue_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  subtotal: number | null;
  tax_rate: number | null;
  total_amount: number | null;
  notes: string | null;
}

interface PaymentCsvRow {
  id: string;
  invoice_id: string | null;
  paid_at: string | null;
  amount: number | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
}

interface CustomerLite {
  id: string;
  name: string;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(
  headers: readonly string[],
  rows: readonly (string | number | null)[][],
): string {
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(","));
  }
  return lines.join("\r\n");
}

export async function exportFinancialDataCsv(): Promise<{
  csv?: string;
  filename?: string;
  error?: string;
}> {
  const supabase = (await createClient()) as unknown as SupabaseAny;

  // Admin only check
  const { data: profile } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => { single: () => Promise<{ data: { role: string } | null }> };
      };
    }
  )
    .from("users")
    .select("role")
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "אין הרשאה לייצא נתונים פיננסיים" };
  }

  const year = new Date().getFullYear();
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;

  // We use 'from' with type cast since types.ts doesn't have invoices/payments yet
  const sb = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        gte: (
          col: string,
          val: string,
        ) => {
          lte: (col: string, val: string) => Promise<{ data: unknown[] | null; error: unknown }>;
        };
        order: (col: string) => Promise<{ data: unknown[] | null; error: unknown }>;
      };
    };
  };

  const [invoicesRes, paymentsRes, customersRes] = await Promise.all([
    sb
      .from("invoices")
      .select(
        "id, number, type, status, customer_id, issue_date, due_date, paid_at, subtotal, tax_rate, total_amount, notes",
      )
      .gte("issue_date", startOfYear)
      .lte("issue_date", endOfYear),
    sb
      .from("payments")
      .select("id, invoice_id, paid_at, amount, method, reference, notes")
      .gte("paid_at", startOfYear)
      .lte("paid_at", endOfYear),
    sb.from("customers").select("id, name").order("name"),
  ]);

  const invoices = (invoicesRes.data ?? []) as InvoiceCsvRow[];
  const payments = (paymentsRes.data ?? []) as PaymentCsvRow[];
  const customers = (customersRes.data ?? []) as CustomerLite[];
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));

  const invoiceHeaders = [
    "סוג רשומה",
    "מזהה",
    "מספר חשבונית",
    "סוג",
    "סטטוס",
    "לקוח",
    "תאריך הנפקה",
    "תאריך תשלום",
    "תאריך שולם",
    "סכום לפני מע״מ",
    "מע״מ %",
    "סכום כולל",
    "הערות",
  ];

  const invoiceRows: (string | number | null)[][] = invoices.map((inv) => [
    "חשבונית",
    inv.id ?? "",
    inv.number ?? "",
    inv.type ?? "",
    inv.status ?? "",
    inv.customer_id ? (customerMap.get(inv.customer_id) ?? inv.customer_id) : "",
    inv.issue_date ?? "",
    inv.due_date ?? "",
    inv.paid_at ?? "",
    inv.subtotal ?? 0,
    inv.tax_rate ?? 0,
    inv.total_amount ?? 0,
    inv.notes ?? "",
  ]);

  const paymentHeaders = [
    "סוג רשומה",
    "מזהה",
    "מזהה חשבונית",
    "תאריך תשלום",
    "סכום",
    "אמצעי",
    "אסמכתא",
    "",
    "",
    "",
    "",
    "",
    "הערות",
  ];

  const paymentRows: (string | number | null)[][] = payments.map((p) => [
    "תשלום",
    p.id ?? "",
    p.invoice_id ?? "",
    p.paid_at ?? "",
    p.amount ?? 0,
    p.method ?? "",
    p.reference ?? "",
    "",
    "",
    "",
    "",
    "",
    p.notes ?? "",
  ]);

  const csvBody = rowsToCsv(invoiceHeaders, [
    ...invoiceRows,
    paymentHeaders.map(() => ""),
    paymentHeaders,
    ...paymentRows,
  ]);

  // UTF-8 BOM for Excel Hebrew
  const BOM = "﻿";
  const csv = BOM + csvBody;

  return { csv, filename: `otto-finance-${year}.csv` };
}
