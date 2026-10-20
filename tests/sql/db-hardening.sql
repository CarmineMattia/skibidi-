-- Runs after db-hardening-schema.sql, 20260904 + 20261013 (display code) and
-- 20261020130000_db_hardening_truncate_defaults.sql. Disposable local DB only.

-- 1) No TRUNCATE / TRIGGER / REFERENCES on any public table for client roles.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(format('%s:%s:%s', c.relname, r.role, p.priv), ', ') INTO bad
  FROM pg_class c
  CROSS JOIN (VALUES ('anon'), ('authenticated')) r(role)
  CROSS JOIN (VALUES ('TRUNCATE'), ('TRIGGER'), ('REFERENCES')) p(priv)
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
    AND has_table_privilege(r.role, c.oid, p.priv);
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'still granted: %', bad; END IF;
  -- normal DML used by the app (behind RLS) is untouched
  IF NOT has_table_privilege('authenticated', 'public.products', 'SELECT,INSERT,UPDATE,DELETE')
     OR NOT has_table_privilege('anon', 'public.products', 'SELECT') THEN
    RAISE EXCEPTION 'DML privileges were removed';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.products', 'TRUNCATE') THEN
    RAISE EXCEPTION 'service_role lost TRUNCATE';
  END IF;
END $$;

SET ROLE anon;
DO $$ BEGIN
  BEGIN TRUNCATE public.products CASCADE; RAISE EXCEPTION 'anon could TRUNCATE products';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN TRUNCATE public.companies CASCADE; RAISE EXCEPTION 'authenticated could TRUNCATE companies';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

-- 2) Default privileges: new functions/tables created by postgres are not
--    executable / truncatable by client roles unless granted explicitly.
CREATE FUNCTION public.hardening_probe_fn() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;
CREATE TABLE public.hardening_probe_tbl(id int);
DO $$ BEGIN
  IF has_function_privilege('anon', 'public.hardening_probe_fn()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.hardening_probe_fn()', 'EXECUTE') THEN
    RAISE EXCEPTION 'new functions are still executable by client roles';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.hardening_probe_fn()', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role default EXECUTE lost';
  END IF;
  IF has_table_privilege('anon', 'public.hardening_probe_tbl', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.hardening_probe_tbl', 'TRIGGER')
     OR has_table_privilege('authenticated', 'public.hardening_probe_tbl', 'REFERENCES') THEN
    RAISE EXCEPTION 'new tables still grant TRUNCATE/TRIGGER/REFERENCES';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.hardening_probe_tbl', 'SELECT') THEN
    RAISE EXCEPTION 'default DML on new tables changed unexpectedly';
  END IF;
END $$;
DROP FUNCTION public.hardening_probe_fn();
DROP TABLE public.hardening_probe_tbl;

-- 3) Orders: anon and guest (customer_id NULL) direct inserts are refused,
--    a logged-in customer can only insert pending orders for themselves.
CREATE OR REPLACE FUNCTION pg_temp.expect_denied(q text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- RLS refusal (42501); a non-pending status may already be stopped by the
  -- manual-approval trigger (raise_exception), which is also a refusal.
  BEGIN EXECUTE q; EXCEPTION WHEN insufficient_privilege OR raise_exception THEN RETURN; END;
  RAISE EXCEPTION 'Expected denial: %', label;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.expect_denied(text, text) TO anon, authenticated;

SET ROLE anon;
SELECT pg_temp.expect_denied($q$INSERT INTO public.orders (id, company_id, status, fiscal_status, total_amount, order_type)
  VALUES ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000001','pending','pending',5,'take_away')$q$, 'anon order insert');
SELECT pg_temp.expect_denied($q$INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
  VALUES ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000011',1,5,5)$q$, 'anon order_items insert');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
SELECT set_config('request.jwt.claims', '{"is_anonymous":false}', false);
SET test.staff = 'false';
SELECT pg_temp.expect_denied($q$INSERT INTO public.orders (id, company_id, customer_id, status, fiscal_status, total_amount, order_type)
  VALUES ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-000000000001',NULL,'pending','pending',5,'take_away')$q$, 'guest order (customer_id NULL)');
SELECT pg_temp.expect_denied($q$INSERT INTO public.orders (id, company_id, customer_id, status, fiscal_status, total_amount, order_type)
  VALUES ('00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c9','pending','pending',5,'take_away')$q$, 'order for another customer');
SELECT pg_temp.expect_denied($q$INSERT INTO public.orders (id, company_id, customer_id, status, fiscal_status, total_amount, order_type)
  VALUES ('00000000-0000-0000-0000-0000000000d4','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','accepted','pending',5,'take_away')$q$, 'non-pending order');

-- 4) Real reserve_order_display_code: sequential per company/day, counters
--    table not readable directly (RLS, no policy).
DO $$
DECLARE a text; b text;
BEGIN
  a := public.reserve_order_display_code('00000000-0000-0000-0000-000000000001');
  b := public.reserve_order_display_code('00000000-0000-0000-0000-000000000001');
  IF a !~ '^Ordine #[0-9]+$' OR split_part(b, '#', 2)::int <> split_part(a, '#', 2)::int + 1 THEN
    RAISE EXCEPTION 'display codes not sequential: %, %', a, b;
  END IF;
  IF EXISTS (SELECT 1 FROM public.order_daily_counters) THEN
    RAISE EXCEPTION 'order_daily_counters readable by authenticated';
  END IF;
END $$;

-- 5) Checkout still works: create_order_with_items (SECURITY INVOKER) as a
--    logged-in customer, using the real reserved display code.
DO $$
DECLARE code text; r jsonb;
BEGIN
  code := public.reserve_order_display_code('00000000-0000-0000-0000-000000000001');
  r := public.create_order_with_items(
    jsonb_build_object('id','00000000-0000-0000-0000-0000000000d5','company_id','00000000-0000-0000-0000-000000000001',
      'customer_id','00000000-0000-0000-0000-0000000000c1','display_code',code,'total_amount',5,'order_type','take_away'),
    jsonb_build_array(jsonb_build_object('product_id','00000000-0000-0000-0000-000000000011','quantity',1,'unit_price',5,'total_price',5)));
  IF r->>'id' <> '00000000-0000-0000-0000-0000000000d5' OR r->>'display_code' <> code THEN
    RAISE EXCEPTION 'checkout did not save the order: %', r;
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.order_items WHERE order_id = '00000000-0000-0000-0000-0000000000d5') <> 1 THEN
    RAISE EXCEPTION 'checkout lines missing';
  END IF;
END $$;
SELECT 'PASS: no TRUNCATE/TRIGGER/REFERENCES, default privileges, no direct guest orders, real display code, checkout ok' AS result;
