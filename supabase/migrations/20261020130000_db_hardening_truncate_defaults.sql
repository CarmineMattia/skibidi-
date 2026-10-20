-- DB hardening (migration only in the PR; apply to prod only with Carmine's OK).
--
-- 1. anon/authenticated had ALL privileges on every public table, including
--    TRUNCATE (ignores RLS: anyone with the anon key could empty products,
--    categories, orders...), TRIGGER and REFERENCES. The app never uses them.
-- 2. Default privileges for objects created by postgres granted EXECUTE on new
--    functions to PUBLIC/anon/authenticated and TRUNCATE/TRIGGER/REFERENCES on
--    new tables. From now on a new function must be granted explicitly
--    (GRANT EXECUTE ... TO authenticated) if the client calls it.
-- 3. anon could insert orders / order_items directly (guest orders bypassing
--    create_order_with_items: login + antiabuse). INSERT is revoked from anon.
--    The RLS policies are NOT changed here: they belong to #32
--    (20261020140000_order_items_insert_guard.sql), so the apply order of the
--    two migrations does not matter.
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

-- 3) Orders: anon cannot insert orders / order lines directly -----------------
-- Only the table grant is touched here. The orders_insert / order_items_insert
-- policies belong to #32 (20261020140000_order_items_insert_guard.sql), so
-- applying this file before or after #32 gives the same final policies.
REVOKE INSERT ON TABLE public.orders, public.order_items FROM anon;
