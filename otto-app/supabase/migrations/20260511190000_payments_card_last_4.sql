-- Last 4 digits of the credit card used for the payment. Required for Israeli
-- tax-invoice-receipt issuance when method = credit_card.

ALTER TABLE public.payments
  ADD COLUMN card_last_4 text;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_card_last_4_format CHECK (
    card_last_4 IS NULL OR card_last_4 ~ '^[0-9]{4}$'
  );
