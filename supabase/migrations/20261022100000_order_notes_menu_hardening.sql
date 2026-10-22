-- Server-side follow-ups (migration only in the PR; apply to prod only with Carmine's OK).
--
-- 1. Order notes (orders.notes, order_items.notes):
--    - zero-width and bidi control characters are removed (U+00AD, U+061C, U+180E,
--      U+200B-U+200F, U+202A-U+202E, U+2060-U+2064, U+2066-U+2069, U+FEFF): they can hide
--      text or reorder what the kitchen reads (e.g. a RLO turning "nessun extra" around);
--    - Unicode line/paragraph separators and VT/FF/NEL (U+2028, U+2029, U+0085, U+000B,
--      U+000C) become a space: the kitchen would show them as new lines, so a free-text
--      note could look like an extra option line ("+ Burrata") the server never priced;
--    - at most 1000 characters after cleaning (prod max today: 143 / 87). Longer notes
--      fail with DETAIL 'ORDER_NOTES_TOO_LONG' (the client shows a clear message and
--      limits the note fields to 200 characters).
--    BEFORE INSERT OR UPDATE OF notes triggers, so it covers create_order_with_items and
--    any direct write; a CHECK constraint backs up the length. No helper functions:
--    the trigger body runs as the invoker and new functions are not granted to clients.
-- 2. reserve_order_display_code(uuid): EXECUTE revoked from PUBLIC/anon/authenticated.
--    Only orders_set_display_code() and create_order_with_items() call it, both
--    SECURITY DEFINER owned by postgres; the client never calls it
--    (tests/unit/orderSubmission.spec.ts).
-- 3. Menu reads without login (anon): only active products / categories of active
--    companies. Logged-in reads are unchanged (an admin still sees inactive products,
--    customers' order history still resolves old products). Companies were already
--    limited to active = true for everyone (companies_select). Order tracking uses
--    get_order_tracking (SECURITY DEFINER) and is not affected.
--
-- Idempotent.

-- 1) Order notes -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clean_order_notes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.notes IS NOT NULL THEN
    NEW.notes := regexp_replace(
      regexp_replace(NEW.notes, '[\u2028\u2029\u0085\u000B\u000C]', ' ', 'g'),
      '[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]', '', 'g');
    IF char_length(NEW.notes) > 1000 THEN
      RAISE EXCEPTION 'Order notes too long' USING ERRCODE = '22001', DETAIL = 'ORDER_NOTES_TOO_LONG',
        HINT = json_build_object('table', TG_TABLE_NAME, 'length', char_length(NEW.notes))::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.clean_order_notes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_orders_clean_notes ON public.orders;
CREATE TRIGGER trg_orders_clean_notes BEFORE INSERT OR UPDATE OF notes ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.clean_order_notes();
DROP TRIGGER IF EXISTS trg_order_items_clean_notes ON public.order_items;
CREATE TRIGGER trg_order_items_clean_notes BEFORE INSERT OR UPDATE OF notes ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.clean_order_notes();

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_notes_length;
ALTER TABLE public.orders ADD CONSTRAINT orders_notes_length CHECK (char_length(notes) <= 1000);
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_notes_length;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_notes_length CHECK (char_length(notes) <= 1000);

-- 2) Display code reservation: server only -----------------------------------
REVOKE EXECUTE ON FUNCTION public.reserve_order_display_code(uuid) FROM PUBLIC, anon, authenticated;

-- 3) Menu without login: active rows of active companies only -----------------
DROP POLICY IF EXISTS products_select ON public.products;
CREATE POLICY products_select ON public.products
  FOR SELECT
  USING (
    ((SELECT auth.uid()) IS NULL
      AND active
      AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = products.company_id AND c.active))
    OR ((SELECT auth.uid()) IS NOT NULL
      AND ((company_id = (SELECT public.get_my_company_id()))
        OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = products.company_id AND c.active)))
  );

DROP POLICY IF EXISTS categories_select ON public.categories;
CREATE POLICY categories_select ON public.categories
  FOR SELECT
  USING (
    ((SELECT auth.uid()) IS NULL
      AND active
      AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = categories.company_id AND c.active))
    OR ((SELECT auth.uid()) IS NOT NULL
      AND ((company_id = (SELECT public.get_my_company_id()))
        OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = categories.company_id AND c.active)))
  );
