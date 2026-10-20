-- Fixture for tests/sql/db-hardening.sql. Disposable local DB only (PGlite).
-- Runs after the order migration chain. Reproduces the hosted grants before the
-- hardening: anon/authenticated have ALL on every public table and Supabase's
-- default privileges for postgres in public (EXECUTE/ALL to anon+authenticated).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
-- Real sequential display code (20260711 creates the counters table, 20260904 the
-- current function, 20261013 enables RLS on the counters).
CREATE TABLE IF NOT EXISTS public.order_daily_counters (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT current_date,
  counter integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, day)
);
-- Hosted: ALL to anon+authenticated on these (customer_restrictions /
-- order_captcha_passes were already narrowed by 20261013140000 and stay as they are).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','products','categories','orders','order_items','profiles','order_daily_counters'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated', t);
    END IF;
  END LOOP;
END $$;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
SELECT 'fixture ready' AS status;
