-- Fixture per tests/sql/least-privilege-grants.sql. Solo DB locale usa-e-getta (PGlite).
-- Gira dopo la catena ordini + hardening e prima della migration 20261029100000.
-- Riproduce lo stato letto su prod il 2026-10-29: le tabelle che la catena locale non crea
-- esistono come stub, con i grant larghi (compreso MAINTAIN) e i default privileges larghi.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN CREATE ROLE supabase_admin; END IF;
END $$;
GRANT USAGE, CREATE ON SCHEMA public TO supabase_admin;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['menu_pricing','profiles','fiscal_audit_log','fiscal_retry_queue','order_no_shows',
                           'customer_restrictions','order_captcha_passes','order_receipt_claims','order_daily_counters'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      EXECUTE format('CREATE TABLE public.%I (id int PRIMARY KEY)', t);
    END IF;
  END LOOP;
END $$;
-- Tabella non nota alla migration: deve perdere solo MAINTAIN.
CREATE TABLE IF NOT EXISTS public.unlisted_probe (id int PRIMARY KEY);
-- Sequence di prova (su prod oggi non ce ne sono: serve a provare i default).
CREATE SEQUENCE IF NOT EXISTS public.lp_probe_seq;

-- Stato "prima": ALL (compreso MAINTAIN) ad anon e authenticated su ogni tabella.
-- (come su prod: 20261020130000 aveva gia' tolto TRUNCATE/TRIGGER/REFERENCES, MAINTAIN no.)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
SELECT 'fixture ready' AS status;
