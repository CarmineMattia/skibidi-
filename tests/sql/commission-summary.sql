-- Dopo 20261111180000 e 20261111193000 (ciascuna due volte). DB locale usa-e-getta.
-- Fuso di sessione UTC di proposito: il mese deve essere Europe/Rome.
SET TIME ZONE 'UTC';

CREATE OR REPLACE FUNCTION pg_temp.check(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS NOT TRUE THEN
    RAISE EXCEPTION 'check failed: %', label;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.check(boolean, text) TO anon, authenticated;
CREATE OR REPLACE FUNCTION pg_temp.expect_err(q text, want text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  d text;
  s text;
BEGIN
  BEGIN
    EXECUTE q;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS d = PG_EXCEPTION_DETAIL, s = RETURNED_SQLSTATE;
    IF SQLERRM LIKE '%' || want || '%' OR coalesce(d, '') = want OR s = want THEN
      RETURN;
    END IF;
    RAISE EXCEPTION '%: expected %, got % / % (%)', label, want, s, d, SQLERRM;
  END;
  RAISE EXCEPTION '%: expected %, but it succeeded', label, want;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.expect_err(text, text, text) TO anon, authenticated;

-- 1) Privilegi: anon niente, authenticated solo le RPC di lettura/scrittura
--    controllate, niente tabelle, niente funzioni interne, niente MAINTAIN.
SELECT pg_temp.check(
  NOT has_table_privilege('anon', 'public.commission_rates', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  AND NOT has_table_privilege('anon', 'public.commission_month_snapshots', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  AND NOT has_table_privilege('anon', 'public.platform_owners', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  AND NOT has_table_privilege('authenticated', 'public.commission_rates', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  AND NOT has_table_privilege('authenticated', 'public.commission_month_snapshots', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  AND NOT has_table_privilege('authenticated', 'public.platform_owners', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  AND NOT has_table_privilege('service_role', 'public.commission_rates', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),
  'no table privileges for anon, authenticated, service_role');

DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 170000 THEN
    IF has_table_privilege('anon', 'public.commission_rates', 'MAINTAIN')
       OR has_table_privilege('authenticated', 'public.commission_rates', 'MAINTAIN')
       OR has_table_privilege('anon', 'public.commission_month_snapshots', 'MAINTAIN')
       OR has_table_privilege('authenticated', 'public.platform_owners', 'MAINTAIN')
       OR has_table_privilege('service_role', 'public.commission_rates', 'MAINTAIN') THEN
      RAISE EXCEPTION 'MAINTAIN still granted';
    END IF;
  END IF;
END $$;

SELECT pg_temp.check(
  has_function_privilege('authenticated', 'public.commission_monthly_summary(uuid, integer)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.commission_rate_schedule(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.set_commission_rate(uuid, numeric, timestamp with time zone, date)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.cancel_scheduled_commission_rate(uuid, timestamp with time zone)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.is_platform_owner()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.commission_monthly_summary(uuid, integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.set_commission_rate(uuid, numeric, timestamp with time zone, date)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.is_platform_owner()', 'EXECUTE')
  AND NOT has_function_privilege('public', 'public.commission_monthly_summary(uuid, integer)', 'EXECUTE')
  AND NOT has_function_privilege('service_role', 'public.commission_monthly_summary(uuid, integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.commission_month_compute(uuid, date)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.commission_month_compute(uuid, date)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.commission_caller_can_read(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.commission_block_truncate()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.commission_block_truncate()', 'EXECUTE')
  AND NOT has_function_privilege('public', 'public.commission_block_truncate()', 'EXECUTE'),
  'execute grants');

SELECT pg_temp.check(
  (SELECT bool_and(prosecdef AND proconfig @> ARRAY['search_path=public'])
   FROM pg_proc
   WHERE proname IN (
     'commission_monthly_summary', 'commission_month_compute', 'commission_rate_schedule',
     'set_commission_rate', 'cancel_scheduled_commission_rate', 'is_platform_owner',
     'commission_caller_can_read')),
  'security definer and search_path');

SELECT pg_temp.check(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.commission_rates'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.commission_month_snapshots'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.platform_owners'::regclass),
  'RLS enabled');

-- Due esecuzioni della migration: una sola aliquota iniziale al 5%.
SELECT pg_temp.check(
  (SELECT count(*) FROM public.commission_rates
    WHERE company_id = '00000000-0000-0000-0000-000000000001' AND rate_percent = 5) = 1
  AND (SELECT count(*) FROM public.commission_rates
    WHERE company_id = '00000000-0000-0000-0000-000000000002') = 1,
  'seed 5 percent once per company');

-- 2) Utenti e ordini. Il confine di mese è Europe/Rome, non UTC.
CREATE TEMP TABLE t_bounds AS
SELECT
  cur,
  (cur - interval '1 month')::date AS prev,
  (cur - interval '2 months')::date AS before,
  (((cur - interval '1 month')::date)::timestamp AT TIME ZONE 'Europe/Rome') AS prev_start
FROM (
  SELECT (date_trunc('month', now() AT TIME ZONE 'Europe/Rome'))::date AS cur
) s;
GRANT SELECT ON t_bounds TO anon, authenticated;

SELECT pg_temp.check(
  (SELECT (date_trunc('month', (prev_start - interval '30 minutes') AT TIME ZONE 'Europe/Rome'))::date = before
      AND (date_trunc('month', (prev_start + interval '30 minutes') AT TIME ZONE 'Europe/Rome'))::date = prev
      AND date_trunc('month', (prev_start + interval '30 minutes') AT TIME ZONE 'UTC')
          <> date_trunc('month', (prev_start + interval '30 minutes') AT TIME ZONE 'Europe/Rome')
   FROM t_bounds),
  'rome boundary differs from UTC');

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000f1');
INSERT INTO public.profiles (id, role, company_id) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-0000000000c1', 'customer', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000d1', 'kiosk', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000e1', 'customer', NULL);
INSERT INTO public.platform_owners (user_id) VALUES ('00000000-0000-0000-0000-0000000000e1');

-- 10% dal decimo giorno del mese precedente (già nel passato: seed, non la RPC).
DO $seed$
DECLARE
  v_from timestamptz;
BEGIN
  SELECT prev_start + interval '10 days' INTO v_from FROM t_bounds;
  PERFORM set_config('skibidi.commission_write', 'seed', true);
  INSERT INTO public.commission_rates (company_id, rate_percent, effective_from)
  VALUES ('00000000-0000-0000-0000-000000000001', 10.00, v_from);
  PERFORM set_config('skibidi.commission_write', '', true);
END
$seed$;

-- 101 mese precedente al prev, 5%. 102 appena dentro prev, 5%. 103 dopo il cambio, 10%.
INSERT INTO public.orders (id, company_id, customer_id, status, total_amount, created_at)
SELECT '00000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
       '00000000-0000-0000-0000-0000000000c1'::uuid, 'delivered', 100, prev_start - interval '30 minutes' FROM t_bounds
UNION ALL
SELECT '00000000-0000-0000-0000-000000000102'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
       '00000000-0000-0000-0000-0000000000c1'::uuid, 'delivered', 100, prev_start + interval '30 minutes' FROM t_bounds
UNION ALL
SELECT '00000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
       '00000000-0000-0000-0000-0000000000c1'::uuid, 'delivered', 40, prev_start + interval '12 days' FROM t_bounds
UNION ALL
SELECT '00000000-0000-0000-0000-000000000115'::uuid, '00000000-0000-0000-0000-000000000002'::uuid,
       '00000000-0000-0000-0000-0000000000c1'::uuid, 'delivered', 30, prev_start + interval '3 days' FROM t_bounds
UNION ALL
SELECT '00000000-0000-0000-0000-000000000116'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
       '00000000-0000-0000-0000-0000000000c1'::uuid, 'delivered', 20, now() FROM t_bounds;

-- Esclusi, tutti nel mese prev della company 1, importo 999: se entrassero il lordo non sarebbe 140.
INSERT INTO public.orders (id, company_id, customer_id, status, total_amount, created_at)
SELECT v.id::uuid, '00000000-0000-0000-0000-000000000001', v.customer_id::uuid, v.status, 999, b.prev_start + interval '2 days'
FROM t_bounds b
CROSS JOIN (VALUES
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-0000000000c1', 'cancelled'),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-0000000000c1', 'rejected'),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-0000000000c1', 'ready'),
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-0000000000c1', 'pending'),
  ('00000000-0000-0000-0000-000000000108', '00000000-0000-0000-0000-0000000000c1', 'accepted'),
  ('00000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-0000000000c1', 'preparing'),
  ('00000000-0000-0000-0000-000000000110', '00000000-0000-0000-0000-0000000000c1', 'delivered'),
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-0000000000c1', 'delivered'),
  ('00000000-0000-0000-0000-000000000112', '00000000-0000-0000-0000-0000000000a1', 'delivered'),
  ('00000000-0000-0000-0000-000000000113', '00000000-0000-0000-0000-0000000000d1', 'delivered'),
  ('00000000-0000-0000-0000-000000000114', NULL, 'delivered'),
  ('00000000-0000-0000-0000-000000000117', '00000000-0000-0000-0000-0000000000f1', 'delivered')
) AS v(id, customer_id, status);

INSERT INTO public.order_items (order_id, quantity)
SELECT id, 1 FROM public.orders WHERE id <> '00000000-0000-0000-0000-000000000110';
-- Due righe sullo stesso ordine: conta una volta, il lordo è total_amount.
INSERT INTO public.order_items (order_id, quantity)
VALUES ('00000000-0000-0000-0000-000000000102', 1);
INSERT INTO public.order_no_shows (order_id) VALUES ('00000000-0000-0000-0000-000000000111');

-- Pizzeria senza aliquota: gli ordini restano «senza aliquota», commissione 0.
INSERT INTO public.companies (id) VALUES ('00000000-0000-0000-0000-000000000003');
INSERT INTO public.orders (id, company_id, customer_id, status, total_amount, created_at)
SELECT '00000000-0000-0000-0000-000000000118'::uuid, '00000000-0000-0000-0000-000000000003'::uuid,
       '00000000-0000-0000-0000-0000000000c1'::uuid, 'delivered', 15, prev_start + interval '4 days'
FROM t_bounds;
INSERT INTO public.order_items (order_id, quantity) VALUES ('00000000-0000-0000-0000-000000000118', 1);

-- 3) Titolare della company 1: inclusioni, aliquota per ordine, mesi di Roma.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);

SELECT pg_temp.check(
  (SELECT count(*) = 3 FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000001', 18)),
  'company 1 returns before, prev, current');

SELECT pg_temp.check(
  (SELECT order_count = 1 AND gross_total = 100.00 AND commission_total = 5.00
      AND unrated_order_count = 0 AND is_preview IS FALSE
      AND (SELECT count(*) FROM jsonb_array_elements(rates) e WHERE (e->>'rate_percent')::numeric = 5 AND (e->>'order_count')::int = 1) = 1
   FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000001', 18) s, t_bounds b
   WHERE s.month_start = b.before),
  'month before the boundary is 5 percent');

SELECT pg_temp.check(
  (SELECT order_count = 2 AND gross_total = 140.00 AND commission_total = 9.00
      AND unrated_order_count = 0 AND is_preview IS FALSE
      AND (SELECT count(*) FROM jsonb_array_elements(rates) e
           WHERE (e->>'rate_percent')::numeric = 5 AND (e->>'order_count')::int = 1
             AND (e->>'gross_total')::numeric = 100 AND (e->>'commission_total')::numeric = 5) = 1
      AND (SELECT count(*) FROM jsonb_array_elements(rates) e
           WHERE (e->>'rate_percent')::numeric = 10 AND (e->>'order_count')::int = 1
             AND (e->>'gross_total')::numeric = 40 AND (e->>'commission_total')::numeric = 4) = 1
   FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000001', 18) s, t_bounds b
   WHERE s.month_start = b.prev),
  'prev month splits 5 percent and 10 percent');

SELECT pg_temp.check(
  (SELECT order_count = 1 AND gross_total = 20.00 AND commission_total = 2.00
      AND is_preview IS TRUE
      AND (SELECT count(*) FROM jsonb_array_elements(rates) e WHERE (e->>'rate_percent')::numeric = 10) = 1
   FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000001', 18) s, t_bounds b
   WHERE s.month_start = b.cur),
  'current month is a preview at the rate already in effect');

CREATE TEMP TABLE t_seen AS
SELECT month_start, order_count, gross_total, commission_total, is_preview, generated_at
FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000001', 18);

-- 4) Accessi.
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000002', 18)$q$,
  'COMMISSION_FORBIDDEN', 'admin of company 1 cannot read company 2');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.commission_rates$q$,
  'permission denied', 'admin cannot read the rates table');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.set_commission_rate('00000000-0000-0000-0000-000000000001', 4)$q$,
  'COMMISSION_FORBIDDEN', 'admin cannot change the rate');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
SELECT pg_temp.check(
  (SELECT order_count = 1 AND gross_total = 30.00 AND commission_total = 1.50 AND is_preview IS FALSE
   FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000002', 18) s, t_bounds b
   WHERE s.month_start = b.prev),
  'company 2 keeps its own 5 percent');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000001', 18)$q$,
  'COMMISSION_FORBIDDEN', 'admin of company 2 cannot read company 1');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000001', 18)$q$,
  'COMMISSION_FORBIDDEN', 'customer cannot read the summary');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.commission_rate_schedule('00000000-0000-0000-0000-000000000001')$q$,
  'COMMISSION_FORBIDDEN', 'customer cannot read the schedule');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.commission_month_snapshots$q$,
  'permission denied', 'customer cannot read snapshots');
SELECT pg_temp.check(public.is_platform_owner() IS FALSE, 'customer is not platform owner');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000001', 18)$q$,
  'COMMISSION_FORBIDDEN', 'kiosk cannot read the summary');

RESET ROLE;
SET ROLE anon;
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000001', 18)$q$,
  'permission denied', 'anon cannot execute the summary');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.commission_rates$q$,
  'permission denied', 'anon cannot read rates');
SELECT pg_temp.expect_err(
  $q$SELECT public.is_platform_owner()$q$,
  'permission denied', 'anon cannot ask platform owner');
RESET ROLE;

-- Grant futuro troppo largo: il trigger rifiuta comunque il browser.
GRANT INSERT, UPDATE, DELETE ON public.commission_rates, public.commission_month_snapshots, public.platform_owners TO authenticated;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT set_config('skibidi.commission_write', 'seed', false);
SELECT pg_temp.expect_err(
  $q$INSERT INTO public.commission_rates (company_id, rate_percent, effective_from)
     VALUES ('00000000-0000-0000-0000-000000000001', 1, now())$q$,
  'COMMISSION_FORBIDDEN', 'authenticated insert into rates is rejected');
SELECT pg_temp.expect_err(
  $q$INSERT INTO public.commission_month_snapshots (company_id, month_start, order_count, gross_total, commission_total, rates)
     VALUES ('00000000-0000-0000-0000-000000000001', date '2020-01-01', 1, 1, 1, '[]')$q$,
  'COMMISSION_FORBIDDEN', 'authenticated insert into snapshots is rejected');
SELECT pg_temp.expect_err(
  $q$INSERT INTO public.platform_owners (user_id) VALUES ('00000000-0000-0000-0000-0000000000a1')$q$,
  'COMMISSION_FORBIDDEN', 'admin cannot grant himself platform owner');
RESET ROLE;
SELECT set_config('skibidi.commission_write', '', false);
REVOKE INSERT, UPDATE, DELETE ON public.commission_rates, public.commission_month_snapshots, public.platform_owners FROM authenticated;

-- 5) Proprietario della piattaforma: stesse cifre congelate, può cambiare l'aliquota solo in avanti.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
SELECT pg_temp.check(public.is_platform_owner() IS TRUE, 'platform owner flag');
SELECT pg_temp.check(
  (SELECT s.commission_total = 9.00 AND s.generated_at = f.generated_at AND s.gross_total = f.gross_total
   FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000001', 18) s
   JOIN t_seen f ON f.month_start = s.month_start AND f.is_preview IS FALSE
   JOIN t_bounds b ON b.prev = s.month_start),
  'platform owner sees the same frozen prev month');
SELECT pg_temp.check(
  (SELECT order_count = 0 AND unrated_order_count = 1 AND unrated_gross = 15.00 AND commission_total = 0
      AND is_preview IS FALSE
   FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000003', 18) s, t_bounds b
   WHERE s.month_start = b.prev),
  'orders without a rate are counted apart and not commissioned');

SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.set_commission_rate('00000000-0000-0000-0000-000000000001', 4, now() - interval '2 days', NULL)$q$,
  'COMMISSION_RATE_BACKDATE', 'cannot backdate a rate');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.set_commission_rate('00000000-0000-0000-0000-000000000001', 4.555, now() + interval '3 days', NULL)$q$,
  'COMMISSION_RATE_INVALID', 'more than two decimals');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.cancel_scheduled_commission_rate('00000000-0000-0000-0000-000000000001', timestamptz '2020-01-01 00:00:00+00')$q$,
  'COMMISSION_RATE_NOT_SCHEDULED', 'cannot cancel a rate already in effect');

SELECT pg_temp.check(
  (SELECT rate_percent = 4 AND effective_from > now()
   FROM public.set_commission_rate('00000000-0000-0000-0000-000000000001', 4, now() + interval '2 days', NULL)),
  'platform owner schedules a future rate');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.set_commission_rate('00000000-0000-0000-0000-000000000001', 7, now() + interval '1 day', NULL)$q$,
  'COMMISSION_RATE_ORDER', 'cannot insert a rate before one already scheduled');
-- L'ordine già fatto resta al 10%: la nuova aliquota non riscrive il mese in corso.
SELECT pg_temp.check(
  (SELECT commission_total = 2.00 AND order_count = 1 AND is_preview IS TRUE
   FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000001', 18) s, t_bounds b
   WHERE s.month_start = b.cur),
  'future rate does not change the current preview');
SELECT pg_temp.check(
  (SELECT is_scheduled AND rate_percent = 4
   FROM public.commission_rate_schedule('00000000-0000-0000-0000-000000000001')
   WHERE rate_percent = 4),
  'schedule shows the future rate');

WITH doomed AS (
  SELECT effective_from FROM public.commission_rate_schedule('00000000-0000-0000-0000-000000000001')
  WHERE rate_percent = 4
)
SELECT public.cancel_scheduled_commission_rate('00000000-0000-0000-0000-000000000001', effective_from) FROM doomed;
SELECT pg_temp.check(
  (SELECT count(*) = 0 FROM public.commission_rate_schedule('00000000-0000-0000-0000-000000000001') WHERE rate_percent = 4),
  'scheduled rate can be cancelled before it starts');

-- 6) Il congelato non segue le modifiche successive degli ordini.
RESET ROLE;
UPDATE public.orders SET total_amount = 1000 WHERE id = '00000000-0000-0000-0000-000000000102';
UPDATE public.orders SET status = 'delivered' WHERE id = '00000000-0000-0000-0000-000000000104';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT pg_temp.check(
  (SELECT s.order_count = f.order_count AND s.gross_total = f.gross_total
      AND s.commission_total = f.commission_total AND s.generated_at = f.generated_at
      AND f.gross_total = 140.00
   FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000001', 18) s
   JOIN t_seen f ON f.month_start = s.month_start AND f.is_preview IS FALSE
   JOIN t_bounds b ON b.prev = s.month_start),
  'frozen month ignores later order edits');

-- Il mese in corso, non congelato, segue i nuovi ordini.
RESET ROLE;
INSERT INTO public.orders (id, company_id, customer_id, status, total_amount, created_at)
VALUES ('00000000-0000-0000-0000-000000000119', '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-0000000000c1', 'delivered', 10, now());
INSERT INTO public.order_items (order_id, quantity) VALUES ('00000000-0000-0000-0000-000000000119', 1);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT pg_temp.check(
  (SELECT order_count = 2 AND gross_total = 30.00 AND commission_total = 3.00 AND is_preview IS TRUE
   FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000001', 18) s, t_bounds b
   WHERE s.month_start = b.cur),
  'current month preview includes a new collected order');

-- 7) Neppure il proprietario della tabella può scrivere l'importo a mano.
RESET ROLE;
SELECT pg_temp.check(
  (SELECT count(*) = 0 FROM public.commission_month_snapshots s, t_bounds b
    WHERE s.company_id = '00000000-0000-0000-0000-000000000001' AND s.month_start = b.cur)
  AND (SELECT count(*) = 2 FROM public.commission_month_snapshots
    WHERE company_id = '00000000-0000-0000-0000-000000000001'),
  'only closed months are frozen');
INSERT INTO public.commission_month_snapshots (
  company_id, month_start, order_count, gross_total, commission_total, unrated_order_count, unrated_gross, rates
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  (SELECT (cur - interval '20 months')::date FROM t_bounds),
  999, 999, 999, 999, 999, '{"forged":true}'
);
SELECT pg_temp.check(
  (SELECT order_count = 0 AND gross_total = 0 AND commission_total = 0 AND rates = '[]'::jsonb
   FROM public.commission_month_snapshots
   WHERE company_id = '00000000-0000-0000-0000-000000000001'
     AND month_start = (SELECT (cur - interval '20 months')::date FROM t_bounds)),
  'snapshot insert is recomputed by the trigger');
SELECT pg_temp.expect_err(
  $q$UPDATE public.commission_month_snapshots SET gross_total = 1
     WHERE company_id = '00000000-0000-0000-0000-000000000001'$q$,
  'COMMISSION_SNAPSHOT_IMMUTABLE', 'snapshot update rejected');
SELECT pg_temp.expect_err(
  $q$DELETE FROM public.commission_month_snapshots
     WHERE company_id = '00000000-0000-0000-0000-000000000001'$q$,
  'COMMISSION_SNAPSHOT_IMMUTABLE', 'snapshot delete rejected');
SELECT pg_temp.expect_err(
  $q$UPDATE public.commission_rates SET rate_percent = 1
     WHERE company_id = '00000000-0000-0000-0000-000000000001'$q$,
  'COMMISSION_RATE_IMMUTABLE', 'rate update rejected');
SELECT pg_temp.expect_err(
  $q$DELETE FROM public.commission_rates
     WHERE company_id = '00000000-0000-0000-0000-000000000001' AND rate_percent = 5$q$,
  'COMMISSION_FORBIDDEN', 'deleting an effective rate is rejected');

-- 8) Il mese di Roma in corso (e un mese futuro) non si congela, neanche da postgres.
-- Il JWT di sessione dei casi precedenti non deve restare acceso.
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT pg_temp.expect_err(
  $q$INSERT INTO public.commission_month_snapshots (
       company_id, month_start, order_count, gross_total, commission_total, rates
     ) VALUES (
       '00000000-0000-0000-0000-000000000001',
       (SELECT cur FROM t_bounds),
       1, 1, 1, '[]'
     )$q$,
  'COMMISSION_SNAPSHOT_OPEN', 'current Rome month cannot be snapshotted');
SELECT pg_temp.expect_err(
  $q$INSERT INTO public.commission_month_snapshots (
       company_id, month_start, order_count, gross_total, commission_total, rates
     ) VALUES (
       '00000000-0000-0000-0000-000000000001',
       (SELECT (cur + interval '1 month')::date FROM t_bounds),
       1, 1, 1, '[]'
     )$q$,
  'COMMISSION_SNAPSHOT_OPEN', 'future month cannot be snapshotted');
SELECT pg_temp.check(
  (SELECT count(*) = 0 FROM public.commission_month_snapshots s, t_bounds b
    WHERE s.company_id = '00000000-0000-0000-0000-000000000001'
      AND s.month_start >= b.cur),
  'open month insert left no snapshot');

SELECT pg_temp.check(
  (SELECT count(*) = 2
     AND bool_and(pg_get_triggerdef(t.oid) ILIKE '%BEFORE TRUNCATE%')
   FROM pg_trigger t
   WHERE NOT t.tgisinternal
     AND t.tgname IN ('commission_snapshots_block_truncate', 'commission_rates_block_truncate')),
  'truncate triggers are statement-level');
SELECT pg_temp.expect_err(
  $q$TRUNCATE public.commission_month_snapshots$q$,
  'COMMISSION_SNAPSHOT_IMMUTABLE', 'truncate cannot wipe frozen months');
SELECT pg_temp.expect_err(
  $q$TRUNCATE public.commission_rates$q$,
  'COMMISSION_RATE_IMMUTABLE', 'truncate cannot wipe rate history');
SELECT pg_temp.check(
  (SELECT count(*) > 0 FROM public.commission_month_snapshots
    WHERE company_id = '00000000-0000-0000-0000-000000000001')
  AND (SELECT count(*) >= 1 FROM public.commission_rates
    WHERE company_id = '00000000-0000-0000-0000-000000000001' AND rate_percent = 5),
  'rows survive a rejected truncate');

-- Anche con TRUNCATE concesso, il trigger ferma i ruoli dell'app (TRUNCATE ignora la RLS).
GRANT TRUNCATE ON public.commission_month_snapshots, public.commission_rates TO authenticated;
SET ROLE authenticated;
SELECT pg_temp.expect_err(
  $q$TRUNCATE public.commission_month_snapshots$q$,
  'COMMISSION_SNAPSHOT_IMMUTABLE', 'authenticated truncate of snapshots is rejected');
RESET ROLE;
REVOKE TRUNCATE ON public.commission_month_snapshots, public.commission_rates FROM authenticated;

-- 9) DELETE del proprietario di piattaforma: solo editor SQL senza JWT.
INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-0000000000e2');
INSERT INTO public.platform_owners (user_id) VALUES ('00000000-0000-0000-0000-0000000000e2');
DELETE FROM public.platform_owners WHERE user_id = '00000000-0000-0000-0000-0000000000e2';
SELECT pg_temp.check(
  NOT EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = '00000000-0000-0000-0000-0000000000e2')
  AND EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = '00000000-0000-0000-0000-0000000000e1'),
  'sql editor without a JWT can remove a wrong platform owner');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
SELECT pg_temp.expect_err(
  $q$DELETE FROM public.platform_owners WHERE user_id = '00000000-0000-0000-0000-0000000000e1'$q$,
  'COMMISSION_FORBIDDEN', 'a JWT on the sql editor session cannot delete a platform owner');
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT pg_temp.expect_err(
  $q$UPDATE public.platform_owners SET created_at = now()
     WHERE user_id = '00000000-0000-0000-0000-0000000000e1'$q$,
  'COMMISSION_FORBIDDEN', 'platform owner rows cannot be updated');

-- RLS spenta di proposito: il divieto deve venire dal trigger, non dalla policy assente.
-- DELETE senza WHERE: il WHERE su una colonna chiederebbe anche SELECT.
ALTER TABLE public.platform_owners DISABLE ROW LEVEL SECURITY;
GRANT DELETE ON public.platform_owners TO authenticated, service_role;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT pg_temp.expect_err(
  $q$DELETE FROM public.platform_owners$q$,
  'COMMISSION_FORBIDDEN', 'authenticated cannot delete a platform owner');
RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT pg_temp.expect_err(
  $q$DELETE FROM public.platform_owners$q$,
  'COMMISSION_FORBIDDEN', 'service_role cannot delete a platform owner');
RESET ROLE;
REVOKE DELETE ON public.platform_owners FROM authenticated, service_role;
ALTER TABLE public.platform_owners ENABLE ROW LEVEL SECURITY;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT pg_temp.check(
  EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = '00000000-0000-0000-0000-0000000000e1')
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.platform_owners'::regclass),
  'platform owner row remains and RLS is back on');

-- 10) 5% poi 8% poi di nuovo 5% sono tre periodi, non una sola fetta al 5%.
INSERT INTO public.companies (id) VALUES ('00000000-0000-0000-0000-000000000004');
DO $periods$
DECLARE
  v_start timestamptz;
BEGIN
  SELECT prev_start INTO v_start FROM t_bounds;
  PERFORM set_config('skibidi.commission_write', 'seed', true);
  INSERT INTO public.commission_rates (company_id, rate_percent, effective_from) VALUES
    ('00000000-0000-0000-0000-000000000004', 5.00, v_start),
    ('00000000-0000-0000-0000-000000000004', 8.00, v_start + interval '10 days'),
    ('00000000-0000-0000-0000-000000000004', 5.00, v_start + interval '20 days');
  PERFORM set_config('skibidi.commission_write', '', true);
END
$periods$;
INSERT INTO public.orders (id, company_id, customer_id, status, total_amount, created_at)
SELECT '00000000-0000-0000-0000-000000000401'::uuid, '00000000-0000-0000-0000-000000000004'::uuid,
       '00000000-0000-0000-0000-0000000000c1'::uuid, 'delivered', 100, prev_start + interval '1 day' FROM t_bounds
UNION ALL
SELECT '00000000-0000-0000-0000-000000000402'::uuid, '00000000-0000-0000-0000-000000000004'::uuid,
       '00000000-0000-0000-0000-0000000000c1'::uuid, 'delivered', 50, prev_start + interval '11 days' FROM t_bounds
UNION ALL
SELECT '00000000-0000-0000-0000-000000000403'::uuid, '00000000-0000-0000-0000-000000000004'::uuid,
       '00000000-0000-0000-0000-0000000000c1'::uuid, 'delivered', 40, prev_start + interval '21 days' FROM t_bounds;
INSERT INTO public.order_items (order_id, quantity) VALUES
  ('00000000-0000-0000-0000-000000000401', 1),
  ('00000000-0000-0000-0000-000000000402', 1),
  ('00000000-0000-0000-0000-000000000403', 1);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
SELECT pg_temp.check(
  (SELECT order_count = 3 AND gross_total = 190.00 AND commission_total = 11.00
      AND jsonb_array_length(rates) = 3
      AND (SELECT count(*) FROM jsonb_array_elements(rates) e WHERE (e->>'rate_percent')::numeric = 5) = 2
      AND (SELECT count(*) FROM jsonb_array_elements(rates) e
           WHERE (e->>'rate_percent')::numeric = 5
             AND (e->>'order_count')::int = 1
             AND (e->>'effective_from')::timestamptz = (SELECT prev_start FROM t_bounds)) = 1
      AND (SELECT count(*) FROM jsonb_array_elements(rates) e
           WHERE (e->>'rate_percent')::numeric = 8
             AND (e->>'order_count')::int = 1
             AND (e->>'gross_total')::numeric = 50
             AND (e->>'commission_total')::numeric = 4
             AND (e->>'effective_from')::timestamptz = (SELECT prev_start + interval '10 days' FROM t_bounds)) = 1
      AND (SELECT count(*) FROM jsonb_array_elements(rates) e
           WHERE (e->>'rate_percent')::numeric = 5
             AND (e->>'order_count')::int = 1
             AND (e->>'gross_total')::numeric = 40
             AND (e->>'commission_total')::numeric = 2
             AND (e->>'effective_from')::timestamptz = (SELECT prev_start + interval '20 days' FROM t_bounds)) = 1
   FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000004', 18) s, t_bounds b
   WHERE s.month_start = b.prev),
  'repeated percents stay separate periods');

-- 11) Sconto punti: solo la conferma abbassa la base. La richiesta no.
--     100 € senza sconto → 5,00. 100 € richiesti ma non confermati → 5,00.
--     100 € con 5 € confermati → 4,75. 4 € con 5 € confermati → base 0.
RESET ROLE;
INSERT INTO public.companies (id) VALUES ('00000000-0000-0000-0000-000000000005');
DO $coin_rate$
BEGIN
  PERFORM set_config('skibidi.commission_write', 'seed', true);
  INSERT INTO public.commission_rates (company_id, rate_percent, effective_from)
  VALUES ('00000000-0000-0000-0000-000000000005', 5.00, timestamptz '2020-01-01 00:00:00+00');
  PERFORM set_config('skibidi.commission_write', '', true);
END
$coin_rate$;
INSERT INTO public.orders (
  id, company_id, customer_id, status, total_amount, created_at,
  points_requested, points_redeemed, points_discount_eur, points_confirmed_at
)
SELECT '00000000-0000-0000-0000-000000000501'::uuid, '00000000-0000-0000-0000-000000000005'::uuid,
       '00000000-0000-0000-0000-0000000000c1'::uuid, 'delivered', 100,
       prev_start + interval '1 day', 0, NULL::integer, NULL::numeric, NULL::timestamptz
FROM t_bounds;
INSERT INTO public.orders (
  id, company_id, customer_id, status, total_amount, created_at,
  points_requested, points_redeemed, points_discount_eur, points_confirmed_at
)
SELECT '00000000-0000-0000-0000-000000000502'::uuid, '00000000-0000-0000-0000-000000000005'::uuid,
       '00000000-0000-0000-0000-0000000000c1'::uuid, 'delivered', 100,
       prev_start + interval '2 days', 100, NULL::integer, 5.00, NULL::timestamptz
FROM t_bounds;
INSERT INTO public.orders (
  id, company_id, customer_id, status, total_amount, created_at,
  points_requested, points_redeemed, points_discount_eur, points_confirmed_at
)
SELECT '00000000-0000-0000-0000-000000000503'::uuid, '00000000-0000-0000-0000-000000000005'::uuid,
       '00000000-0000-0000-0000-0000000000c1'::uuid, 'delivered', 100,
       prev_start + interval '3 days', 100, 100, 5.00, prev_start + interval '3 days'
FROM t_bounds;
INSERT INTO public.orders (
  id, company_id, customer_id, status, total_amount, created_at,
  points_requested, points_redeemed, points_discount_eur, points_confirmed_at
)
SELECT '00000000-0000-0000-0000-000000000504'::uuid, '00000000-0000-0000-0000-000000000005'::uuid,
       '00000000-0000-0000-0000-0000000000c1'::uuid, 'delivered', 4,
       prev_start + interval '4 days', 100, 100, 5.00, prev_start + interval '4 days'
FROM t_bounds;
INSERT INTO public.order_items (order_id, quantity) VALUES
  ('00000000-0000-0000-0000-000000000501', 1),
  ('00000000-0000-0000-0000-000000000502', 1),
  ('00000000-0000-0000-0000-000000000503', 1),
  ('00000000-0000-0000-0000-000000000504', 1);

SELECT pg_temp.check(
  position('points_confirmed_at' in pg_get_functiondef('public.commission_month_compute(uuid, date)'::regprocedure)) > 0
  AND NOT has_function_privilege('authenticated', 'public.commission_month_compute(uuid, date)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.commission_month_compute(uuid, date)', 'EXECUTE')
  AND NOT has_function_privilege('public', 'public.commission_month_compute(uuid, date)', 'EXECUTE'),
  'compute uses the confirmed discount and stays internal');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);

SELECT pg_temp.check(
  (SELECT order_count = 4 AND gross_total = 295.00 AND commission_total = 14.75
      AND unrated_order_count = 0
      AND (SELECT count(*) FROM jsonb_array_elements(rates) e
           WHERE (e->>'rate_percent')::numeric = 5
             AND (e->>'order_count')::int = 4
             AND (e->>'gross_total')::numeric = 295
             AND (e->>'commission_total')::numeric = 14.75) = 1
   FROM public.commission_monthly_summary('00000000-0000-0000-0000-000000000005', 18) s, t_bounds b
   WHERE s.month_start = b.prev),
  'confirmed points discount lowers the commission base, a request does not');

SELECT 'PASS commission summary' AS result;
