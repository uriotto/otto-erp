-- Allow the post-payment "קבלה" document option for cases where חשבונית מס
-- was already produced earlier and only a standalone receipt is needed now.

ALTER TYPE invoice_document_type ADD VALUE IF NOT EXISTS 'receipt';
