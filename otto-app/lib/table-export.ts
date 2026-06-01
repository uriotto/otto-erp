/**
 * Small helpers for turning tabular data into CSV (for download, Excel-friendly)
 * or TSV (for copy-to-clipboard / paste into WhatsApp, email, Sheets).
 */

export type Cell = string | number | null | undefined;

function toDelimited(headers: string[], rows: Cell[][], delimiter: string): string {
  const escape = (value: Cell): string => {
    const s = value == null ? "" : String(value);
    if (delimiter === "," && /[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(delimiter)).join("\n");
}

/** CSV with a UTF-8 BOM so Excel renders Hebrew correctly. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  return "﻿" + toDelimited(headers, rows, ",");
}

/** Tab-separated — best for pasting into a chat or a spreadsheet. */
export function toTsv(headers: string[], rows: Cell[][]): string {
  return toDelimited(headers, rows, "\t");
}

/** Triggers a client-side file download of the given text content. */
export function downloadTextFile(content: string, filename: string, mime = "text/csv"): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
