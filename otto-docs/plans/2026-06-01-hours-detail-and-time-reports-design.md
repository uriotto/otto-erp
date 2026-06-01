# Hours detail on invoices + Time reports export — Design

> Date: 2026-06-01
> Status: approved (brainstorming) — pending implementation plan

## Problem

1. Hour-based clients want, at end of month / when an invoice is sent, a detailed
   breakdown of exactly which hours the invoice covers (date, description, duration).
   Today no such breakdown reaches the client.
2. The `/time` hours table needs export / copy of reports, split by customer and by
   period/month.

## Key discovery

Both "produce invoice from hours" flows never actually create an invoice — they only
flip `time_entries.billing_status` to `invoiced` and (for overage) fire a webhook:

- `createHourlyInvoice(customerId)` in `app/(app)/time/actions.ts` — the "הפק חשבונית"
  button on `/time`. Marks pending/overage hours invoiced, returns hours/amount, **no
  invoice row, no webhook**.
- `invoiceOverageSeparately(...)` in `app/(app)/hour-banks/actions.ts` — already fixed
  on 2026-06-01 to create a real overage invoice + items + link entries + fire
  `invoice.created`.

The moment the user clicks "הפק חשבונית" the exact set of entries is already gathered.
That is the natural place to (a) create the real invoice, (b) link the entries, and
(c) bake the hours detail into the invoice.

## Decisions (from brainstorming)

- Detail reaches the client **both** as text in the invoice notes (flows to Finbot via
  the webhook) **and** as a separate downloadable/copyable report on the invoice page.
- Detail source = the `time_entries` linked to the invoice (`invoice_id`).
- Export/copy lives on the `/time` table only, filtered by customer and by period/month.
- Export formats: CSV/Excel + copy-to-clipboard (no PDF).
- Whether to attach the detail is controlled by a **checkbox at generation time**
  ("צרף פירוט שעות", default on).

## Feature A — Hours detail baked at invoice generation

### A1. Make `createHourlyInvoice` create a real invoice

Mirror the fixed `invoiceOverageSeparately`:

- Fetch the customer's billable `pending`/`overage` entries with
  `id, start_time, duration_minutes, notes` (+ project/task names for the description).
- Effective rate per entry: `hourly_rate_at_entry ?? customer.hourly_rate_override ??
  tenant default_hourly_rate ?? 0`.
- Insert `invoices` row: `type = 'monthly_hours'`, `document_type` (from caller, default
  `payment_request`), `status = 'draft'`, `tax_rate = 18`, `currency = 'ILS'`.
- Build invoice line items (grouped by rate, like overage).
- Link entries: `billing_status = 'invoiced'`, `invoice_id = <new>`.
- Fire `invoice.created` webhook with the same payload shape as `createInvoice`, plus a
  structured `hours_detail` array and the notes text.
- New signature: `createHourlyInvoice(customerId, opts?: { documentType?, attachHoursDetail? })`.

### A2. Hours-detail builder (shared util)

`lib/hours-detail.ts` — pure function turning a list of entries into:

- a Hebrew text block for the invoice `notes` (table: תאריך · תיאור · משך, with a total line)
- a structured array `{ date, description, minutes }[]` for the webhook payload.

Used by both `createHourlyInvoice` and `invoiceOverageSeparately`.

### A3. Generation UI (checkbox)

The "הפק חשבונית" button in `time-list.tsx` opens a small confirm with:
- document type select (payment_request / tax_invoice / tax_invoice_receipt)
- "צרף פירוט שעות" checkbox (default on)

Pass both into `createHourlyInvoice`. The overage dialog already has the document-type
selector; add the same "צרף פירוט שעות" checkbox there.

### A4. Invoice detail page — linked hours + export

On `app/(app)/invoices/[id]`: a "שעות מקושרות" panel listing the linked entries
(`time_entries` where `invoice_id = this`), with "הורד CSV" + "העתק" of the breakdown.

## Feature B — `/time` reports: period + export/copy

- **Period selector**: this month / last month / custom range. Drives the server query
  via URL params (`from`, `to`). `app/(app)/time/page.tsx` currently hard-codes the last
  30 days — replace with the selected range (default = current month).
- **Export CSV**: reuse `components/ui/ExportCsvButton` — columns: date, customer,
  project, task, hours, billable, status, notes. Respects active customer + period filter.
- **Copy**: copy the same rows (TSV) to clipboard for paste into WhatsApp/email.
- Per-customer subtotal rows in the export when not filtered to a single customer.

## Data model

No schema changes. Reuses existing `invoices`, `invoice_items`, and
`time_entries.invoice_id` / `billing_status`. `invoice_document_type` enum already exists.

## Error handling

- No pending entries → return existing "אין שעות ממתינות לחיוב".
- Invoice insert ok but items insert fails → delete the invoice (best-effort rollback,
  matching `createInvoice`).
- Webhook failures stay swallowed/logged (existing `fireMakeWebhook` behaviour).

## Out of scope (YAGNI)

- Export on the invoices table (only `/time` was requested).
- PDF generation.
- Per-customer "always attach detail" setting (checkbox at generation chosen instead).
- Auto-linking hours to manually-created invoices via the new-invoice dialog.

## Verification

- `npm run typecheck` + `npm run build`.
- Manually: generate an hourly invoice with detail on → invoice appears with notes table
  + linked hours; with detail off → no notes table. Export + copy from `/time` for a
  chosen month and customer.
