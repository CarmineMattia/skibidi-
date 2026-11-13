-- One confirmation email per order.
-- This file is only in the repo. Do not apply it to production until Carmine says so.
-- The edge function send-order-confirmation (service role) claims the column with
-- UPDATE ... WHERE confirmation_email_sent_at IS NULL. anon/authenticated cannot
-- change it: a trigger puts the previous value back. service_role and the SQL
-- editor (auth.role() is not anon/authenticated) can write it.
-- If auth.role() is missing (local Postgres without Supabase), the trigger
-- leaves the row alone so a plain database still accepts order updates.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz;

COMMENT ON COLUMN public.orders.confirmation_email_sent_at IS
  'Claim for the customer order-confirmation email. NULL = not sent. Service role only.';

CREATE OR REPLACE FUNCTION public.preserve_confirmation_email_sent_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  BEGIN
    IF coalesce(auth.role(), '') IN ('anon', 'authenticated')
       AND NEW.confirmation_email_sent_at IS DISTINCT FROM OLD.confirmation_email_sent_at THEN
      NEW.confirmation_email_sent_at := OLD.confirmation_email_sent_at;
    END IF;
  EXCEPTION
    WHEN undefined_function OR invalid_schema_name THEN
      NULL;
  END;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.preserve_confirmation_email_sent_at() FROM PUBLIC;
DO $revoke$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.preserve_confirmation_email_sent_at() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.preserve_confirmation_email_sent_at() FROM authenticated;
  END IF;
END
$revoke$;

DROP TRIGGER IF EXISTS trg_preserve_confirmation_email_sent_at ON public.orders;
CREATE TRIGGER trg_preserve_confirmation_email_sent_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_confirmation_email_sent_at();
