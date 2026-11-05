-- products_select e order_daily_counters dopo 20261029100000 (PGlite).
-- Fixture locale: azienda attiva A (prodotto attivo + spento), azienda spenta B.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
INSERT INTO public.companies (id, active) VALUES
  ('0000000a-0000-0000-0000-000000000001', true), ('0000000b-0000-0000-0000-000000000001', false)
  ON CONFLICT (id) DO UPDATE SET active = excluded.active;
INSERT INTO public.products (id, company_id, active, price) VALUES
  ('0000000a-0000-0000-0000-0000000000a1', '0000000a-0000-0000-0000-000000000001', true, 5),
  ('0000000a-0000-0000-0000-0000000000a0', '0000000a-0000-0000-0000-000000000001', false, 5),
  ('0000000b-0000-0000-0000-0000000000b1', '0000000b-0000-0000-0000-000000000001', true, 5);
CREATE FUNCTION pg_temp.vis() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(right(id::text, 2), ',' ORDER BY id::text), '')
  FROM public.products WHERE left(id::text, 8) IN ('0000000a', '0000000b') $$;
GRANT EXECUTE ON FUNCTION pg_temp.vis() TO anon, authenticated;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_daily_counters') THEN RAISE EXCEPTION 'policy left on order_daily_counters'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.order_daily_counters'::regclass) THEN RAISE EXCEPTION 'RLS off on order_daily_counters'; END IF;
END $$;

CREATE TEMP TABLE r (who text, got text); GRANT ALL ON r TO PUBLIC;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false), set_config('test.company_id', '', false), set_config('test.staff', 'false', false);
INSERT INTO r SELECT 'anon', pg_temp.vis();
RESET ROLE;
SET ROLE authenticated;
-- cliente della stessa azienda A (company_id = A, non admin)
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false),
       set_config('test.company_id', '0000000a-0000-0000-0000-000000000001', false), set_config('test.staff', 'false', false);
INSERT INTO r SELECT 'customer', pg_temp.vis();
-- admin di A
SELECT set_config('test.staff', 'true', false);
INSERT INTO r SELECT 'admin', pg_temp.vis();
-- admin di B (azienda spenta): vede i suoi
SELECT set_config('test.company_id', '0000000b-0000-0000-0000-000000000001', false);
INSERT INTO r SELECT 'adminB', pg_temp.vis();
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false), set_config('test.company_id', '', false), set_config('test.staff', '', false);

DO $$ DECLARE bad text; BEGIN
  SELECT string_agg(format('%s got [%s] want [%s]', r.who, r.got, w.want), '; ') INTO bad
  FROM r JOIN (VALUES ('anon','a1'),('customer','a1'),('admin','a0,a1'),('adminB','a1,b1')) w(who, want) USING (who)
  WHERE r.got <> w.want;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'products_select: %', bad; END IF;
END $$;
SELECT 'PASS: products_select (solo attivi per anon/clienti, spenti solo admin) + order_daily_counters senza policy' AS result;
