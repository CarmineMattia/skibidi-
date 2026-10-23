-- Fixture for the receipt tests: service_role as on Supabase (bypasses RLS,
-- table grants). Disposable local DB only.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
ALTER ROLE service_role BYPASSRLS;
GRANT USAGE ON SCHEMA public, auth TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders, public.order_items TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO service_role;
SELECT 'receipt fixture ready' AS status;
