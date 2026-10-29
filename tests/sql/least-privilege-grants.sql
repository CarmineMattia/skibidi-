-- Test della migration 20261029100000_least_privilege_table_grants.sql (PGlite).
-- Tutto in sola lettura sui grant + qualche prova di comportamento con SET ROLE.

-- 1) Matrice attesa: tabella -> privilegi anon / authenticated (scritta qui di proposito,
--    separata da quella della migration: se qualcuno allarga un grant il test lo vede).
CREATE TEMP TABLE expected (tbl text, role text, privs text[]);
INSERT INTO expected VALUES
  ('categories','anon','{SELECT}'),                    ('categories','authenticated','{SELECT,INSERT,UPDATE,DELETE}'),
  ('companies','anon','{SELECT}'),                     ('companies','authenticated','{SELECT,UPDATE}'),
  ('products','anon','{SELECT}'),                      ('products','authenticated','{SELECT,INSERT,UPDATE,DELETE}'),
  ('menu_pricing','anon','{SELECT}'),                  ('menu_pricing','authenticated','{SELECT}'),
  ('orders','anon','{}'),                              ('orders','authenticated','{SELECT,INSERT,UPDATE,DELETE}'),
  ('order_items','anon','{}'),                         ('order_items','authenticated','{SELECT,INSERT}'),
  ('profiles','anon','{}'),                            ('profiles','authenticated','{SELECT,INSERT,UPDATE,DELETE}'),
  ('customer_restrictions','anon','{}'),               ('customer_restrictions','authenticated','{SELECT}'),
  ('order_no_shows','anon','{}'),                      ('order_no_shows','authenticated','{SELECT}'),
  ('fiscal_audit_log','anon','{}'),                    ('fiscal_audit_log','authenticated','{SELECT,INSERT,UPDATE}'),
  ('fiscal_retry_queue','anon','{}'),                  ('fiscal_retry_queue','authenticated','{SELECT,INSERT,UPDATE,DELETE}'),
  ('order_daily_counters','anon','{}'),                ('order_daily_counters','authenticated','{}'),
  ('order_captcha_passes','anon','{}'),                ('order_captcha_passes','authenticated','{}'),
  ('order_receipt_claims','anon','{}'),                ('order_receipt_claims','authenticated','{}');
GRANT SELECT ON expected TO PUBLIC;

DO $$
DECLARE e record; p text; has boolean; want boolean; bad text := '';
BEGIN
  FOR e IN SELECT * FROM expected LOOP
    IF to_regclass('public.' || e.tbl) IS NULL THEN RAISE EXCEPTION 'table % missing in the test DB', e.tbl; END IF;
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      has := has_table_privilege(e.role, 'public.' || e.tbl, p);
      want := p = ANY (e.privs);
      IF has <> want THEN bad := bad || format(' %s.%s %s (has %s, want %s);', e.tbl, e.role, p, has, want); END IF;
    END LOOP;
  END LOOP;
  IF bad <> '' THEN RAISE EXCEPTION 'unexpected grants:%', bad; END IF;
  -- service_role non toccato.
  IF NOT has_table_privilege('service_role', 'public.orders', 'DELETE')
     OR NOT has_table_privilege('service_role', 'public.products', 'UPDATE') THEN
    RAISE EXCEPTION 'service_role lost privileges';
  END IF;
  -- Nessuno ha piu' MAINTAIN, nemmeno sulle tabelle non elencate; le altre cose restano.
  IF EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p')
             AND (has_table_privilege('anon', c.oid, 'MAINTAIN') OR has_table_privilege('authenticated', c.oid, 'MAINTAIN'))) THEN
    RAISE EXCEPTION 'MAINTAIN still granted on a public table';
  END IF;
  IF NOT has_table_privilege('anon', 'public.unlisted_probe', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.unlisted_probe', 'DELETE') THEN
    RAISE EXCEPTION 'unlisted table lost more than MAINTAIN';
  END IF;
  -- Sequence esistente: anon niente, authenticated solo USAGE.
  IF has_sequence_privilege('anon', 'public.lp_probe_seq', 'USAGE') OR has_sequence_privilege('anon', 'public.lp_probe_seq', 'SELECT')
     OR has_sequence_privilege('authenticated', 'public.lp_probe_seq', 'UPDATE')
     OR NOT has_sequence_privilege('authenticated', 'public.lp_probe_seq', 'USAGE') THEN
    RAISE EXCEPTION 'sequence grants wrong';
  END IF;
END $$;

-- 2) Default privileges: nuovi oggetti creati da postgres / supabase_admin.
CREATE TABLE public.lp_new_table (id int);
CREATE SEQUENCE public.lp_new_seq;
CREATE FUNCTION public.lp_new_fn() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;
SET ROLE supabase_admin;
CREATE TABLE public.lp_admin_table (id int);
CREATE SEQUENCE public.lp_admin_seq;
RESET ROLE;
DO $$
DECLARE o text; p text;
BEGIN
  FOREACH o IN ARRAY ARRAY['public.lp_new_table','public.lp_admin_table'] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      IF has_table_privilege('anon', o, p) OR has_table_privilege('authenticated', o, p) THEN
        RAISE EXCEPTION 'new table % still grants % to anon/authenticated by default', o, p;
      END IF;
    END LOOP;
    IF NOT has_table_privilege('service_role', o, 'INSERT') THEN RAISE EXCEPTION 'service_role lost default on %', o; END IF;
  END LOOP;
  FOREACH o IN ARRAY ARRAY['public.lp_new_seq','public.lp_admin_seq'] LOOP
    IF has_sequence_privilege('anon', o, 'USAGE') OR has_sequence_privilege('anon', o, 'SELECT') OR has_sequence_privilege('anon', o, 'UPDATE')
       OR has_sequence_privilege('authenticated', o, 'UPDATE') OR has_sequence_privilege('authenticated', o, 'SELECT')
       OR NOT has_sequence_privilege('authenticated', o, 'USAGE') THEN
      RAISE EXCEPTION 'new sequence % default wrong', o;
    END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public.lp_new_fn()', 'EXECUTE') OR has_function_privilege('authenticated', 'public.lp_new_fn()', 'EXECUTE') THEN
    RAISE EXCEPTION 'new function executable by anon/authenticated by default';
  END IF;
END $$;
DROP TABLE public.lp_new_table, public.lp_admin_table;
DROP SEQUENCE public.lp_new_seq, public.lp_admin_seq;
DROP FUNCTION public.lp_new_fn();

-- 3) Comportamento con i ruoli veri.
CREATE OR REPLACE FUNCTION pg_temp.expect_denied(q text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE q; EXCEPTION WHEN insufficient_privilege THEN RETURN; END;
  RAISE EXCEPTION 'Expected permission denied: %', label;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.expect_denied(text, text) TO anon, authenticated;

SET ROLE anon;
-- il menu resta leggibile
SELECT count(*) FROM public.products;
SELECT count(*) FROM public.categories;
SELECT count(*) FROM public.companies;
SELECT pg_temp.expect_denied('SELECT count(*) FROM public.orders', 'anon read orders');
SELECT pg_temp.expect_denied('SELECT count(*) FROM public.order_items', 'anon read order_items');
SELECT pg_temp.expect_denied('SELECT count(*) FROM public.profiles', 'anon read profiles');
SELECT pg_temp.expect_denied('LOCK TABLE public.orders IN ACCESS EXCLUSIVE MODE', 'anon LOCK orders');
SELECT pg_temp.expect_denied('LOCK TABLE public.products IN ACCESS EXCLUSIVE MODE', 'anon LOCK products');
SELECT pg_temp.expect_denied('DELETE FROM public.products', 'anon delete products');
SELECT pg_temp.expect_denied($q$UPDATE public.companies SET active = false$q$, 'anon update companies');
SELECT pg_temp.expect_denied('SELECT count(*) FROM public.order_daily_counters', 'anon read counters');
RESET ROLE;

SET ROLE authenticated;
SELECT pg_temp.expect_denied('LOCK TABLE public.order_items IN ACCESS EXCLUSIVE MODE', 'authenticated LOCK order_items');
SELECT pg_temp.expect_denied('DELETE FROM public.order_items', 'authenticated delete order_items');
SELECT pg_temp.expect_denied('UPDATE public.order_items SET quantity = 1', 'authenticated update order_items');
SELECT pg_temp.expect_denied('SELECT count(*) FROM public.order_daily_counters', 'authenticated read counters');
SELECT pg_temp.expect_denied('DELETE FROM public.fiscal_audit_log', 'authenticated delete fiscal_audit_log');
SELECT pg_temp.expect_denied('INSERT INTO public.order_no_shows (id) VALUES (gen_random_uuid())', 'authenticated insert order_no_shows');
-- cio' che serve resta: staff e clienti passano da queste tabelle (le policy RLS decidono le righe)
SELECT count(*) FROM public.orders;
SELECT count(*) FROM public.order_items;
SELECT count(*) FROM public.products;
SELECT count(*) FROM public.profiles;
RESET ROLE;

SELECT 'PASS: least-privilege grants (matrix, no MAINTAIN, defaults, role behaviour)' AS result;
