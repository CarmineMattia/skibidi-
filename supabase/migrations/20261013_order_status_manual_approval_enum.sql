-- NOT APPLIED. Part 1/2 of mandatory manual approval (PR feat/manual-approval-states).
-- ADD VALUE must commit before the new labels can be used, so the guard lives in part 2.
-- Mapping: pending=in attesa di conferma, accepted=accettato, preparing=in preparazione,
-- ready=pronto, delivered=ritirato e pagato, rejected=rifiutato, cancelled=annullato.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'accepted' BEFORE 'preparing';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rejected' AFTER 'cancelled';
