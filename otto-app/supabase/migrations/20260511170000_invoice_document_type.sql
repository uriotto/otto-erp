-- Distinguish the actual document being issued (payment request / tax invoice /
-- tax invoice receipt) from invoice_type (which is the source/category: advance,
-- monthly_hours, etc). Make can read this and decide which Finbot document to produce.

CREATE TYPE invoice_document_type AS ENUM ('payment_request', 'tax_invoice', 'tax_invoice_receipt');

ALTER TABLE public.invoices
  ADD COLUMN document_type invoice_document_type;
