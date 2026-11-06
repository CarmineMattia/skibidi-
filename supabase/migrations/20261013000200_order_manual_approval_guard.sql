-- NOT APPLIED. Part 2/2: no order reaches the kitchen without an explicit admin acceptance.
BEGIN;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid;

-- Allowed transitions (anything else is rejected):
--   pending   -> accepted | rejected | cancelled
--   accepted  -> preparing | cancelled
--   preparing -> ready | cancelled
--   ready     -> delivered | cancelled
--   delivered, rejected, cancelled are terminal.
CREATE OR REPLACE FUNCTION public.is_valid_order_transition(p_from text, p_to text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_from = p_to OR (p_from, p_to) IN (
    ('pending','accepted'), ('pending','rejected'), ('pending','cancelled'),
    ('accepted','preparing'), ('accepted','cancelled'),
    ('preparing','ready'), ('preparing','cancelled'),
    ('ready','delivered'), ('ready','cancelled'));
$$;

CREATE OR REPLACE FUNCTION public.enforce_order_manual_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status::text <> 'pending' THEN
      RAISE EXCEPTION 'New orders must start as pending (got %)', NEW.status;
    END IF;
    NEW.accepted_at := NULL; NEW.accepted_by := NULL;
    RETURN NEW;
  END IF;
  IF NEW.status::text = OLD.status::text THEN
    -- acceptance stamp is immutable once set
    NEW.accepted_at := OLD.accepted_at; NEW.accepted_by := OLD.accepted_by;
    RETURN NEW;
  END IF;
  IF NOT public.is_valid_order_transition(OLD.status::text, NEW.status::text) THEN
    RAISE EXCEPTION 'Invalid order status transition % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.status::text IN ('accepted','rejected') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an admin can accept or reject an order';
  END IF;
  IF NEW.status::text = 'accepted' THEN
    NEW.accepted_at := now(); NEW.accepted_by := auth.uid();
  ELSE
    NEW.accepted_at := OLD.accepted_at; NEW.accepted_by := OLD.accepted_by;
  END IF;
  IF NEW.status::text = 'preparing' AND OLD.accepted_at IS NULL THEN
    RAISE EXCEPTION 'Order must be accepted by an admin before preparation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_order_manual_approval ON public.orders;
CREATE TRIGGER trg_enforce_order_manual_approval BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_manual_approval();
REVOKE EXECUTE ON FUNCTION public.enforce_order_manual_approval() FROM anon, authenticated, PUBLIC;

-- The empty-order guard from 20261008 now fires on acceptance (pending -> accepted).
CREATE OR REPLACE FUNCTION public.prevent_empty_order_acceptance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status::text IN ('accepted','preparing') AND OLD.status::text = 'pending'
     AND NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = NEW.id) THEN
    RAISE EXCEPTION 'Cannot accept an order without saved items';
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;
