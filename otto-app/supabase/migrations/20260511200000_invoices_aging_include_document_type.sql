-- Expose document_type via the invoices_aging view so the list page can render
-- the Hebrew label (דרישת תשלום / חשבונית מס / חשבונית מס קבלה / קבלה).

DROP VIEW IF EXISTS public.invoices_aging;

CREATE VIEW public.invoices_aging AS
SELECT
  id,
  tenant_id,
  customer_id,
  number,
  issue_date,
  due_date,
  total_amount,
  status,
  document_type,
  CASE
    WHEN status = 'paid'::invoice_status THEN 0
    WHEN due_date IS NULL THEN 0
    ELSE GREATEST(0, (CURRENT_DATE - due_date))
  END AS days_overdue,
  CASE
    WHEN status = 'paid'::invoice_status THEN 'paid'::text
    WHEN due_date IS NULL OR due_date >= CURRENT_DATE THEN 'current'::text
    WHEN (CURRENT_DATE - due_date) <= 30 THEN '1-30'::text
    WHEN (CURRENT_DATE - due_date) <= 60 THEN '31-60'::text
    WHEN (CURRENT_DATE - due_date) <= 90 THEN '61-90'::text
    ELSE '90+'::text
  END AS age_bucket,
  COALESCE((
    SELECT sum(p.amount) FROM payments p WHERE p.invoice_id = i.id
  ), 0::numeric) AS paid_amount
FROM invoices i;
