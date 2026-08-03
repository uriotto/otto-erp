-- Hours that were paid outside OTTO (cash, direct transfer, an invoice issued
-- elsewhere). They must leave the billing-run queue without producing a Finbot
-- document, and stay distinguishable from 'invoiced' (billed through the system)
-- and 'cancelled' (never billed at all).
ALTER TYPE time_entry_billing_status ADD VALUE IF NOT EXISTS 'settled_externally';
