-- DB hardening (migration only in the PR; apply to prod only with Carmine's OK).
--
-- 1. anon/authenticated had ALL privileges on every public table, including
--    TRUNCATE (ignores RLS: anyone with the anon key could empty products,
--    categories, orders...), TRIGGER and REFERENCES. The app never uses them.
-- 2. Default privileges for objects created by postgres granted EXECUTE on new
--    functions to PUBLIC/anon/authenticated and TRUNCATE/TRIGGER/REFERENCES on
--    new tables. From now on a new function must be granted explicitly
--    (GRANT EXECUTE ... TO authenticated) if the client calls it.
-- 3. orders_insert let anon (and any session) insert orders directly with
--    customer_id NULL, bypassing create_order_with_items (login + antiabuse).
--    Orders now come only from logged-in sessions for themselves
--    (create_order_with_items is SECURITY INVOKER, so it still needs this
--    narrow policy) or from staff of the same company.
--
-- Idempotent. Default privileges owned by supabase_admin cannot be changed by
-- postgres and are left as they are.

-- 1) Table privileges -------------------------------------------------------
DO $$
DECLARE t regclass;
BEGIN
  FOR t IN SELECT c.oid::regclass FROM pg_class c
           WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %s FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;

-- 2) Default privileges ------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;

-- 3) Orders: no direct inserts from anon / guests ---------------------------
DROP POLICY IF EXISTS orders_insert ON public.orders;
CREATE POLICY orders_insert ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin() AND company_id = public.get_my_company_id())
    OR (
      auth.uid() IS NOT NULL
      AND customer_id = auth.uid()
      AND status = 'pending'
      AND fiscal_status = 'pending'
    )
  );

DROP POLICY IF EXISTS order_items_insert ON public.order_items;
CREATE POLICY order_items_insert ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (public.can_insert_order_item(order_id));

REVOKE INSERT ON TABLE public.orders, public.order_items FROM anon;
