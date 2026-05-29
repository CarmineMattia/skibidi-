-- Add decline metadata for staff/admin refusal flow.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS decline_reason_preset text,
  ADD COLUMN IF NOT EXISTS decline_reason_note text,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz;

-- Keep existing rows consistent when already cancelled.
UPDATE public.orders
SET declined_at = COALESCE(declined_at, updated_at)
WHERE status = 'cancelled'
  AND declined_at IS NULL;
