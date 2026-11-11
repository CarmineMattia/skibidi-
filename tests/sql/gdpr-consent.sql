-- Dopo 20261111220000 applicata due volte. DB locale usa-e-getta.
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

-- 1) Bozza seminata una sola volta, con i segnaposto e senza dati inventati.
SELECT pg_temp.check(
  (SELECT count(*) FROM public.consent_documents) = 1
  AND (SELECT version FROM public.consent_documents WHERE is_current) = '2026-11-draft-1'
  AND (SELECT body FROM public.consent_documents) LIKE '%BOZZA DA FAR RILEGGERE%'
  AND (SELECT body FROM public.consent_documents) LIKE '%Pizzeria Ambrosia%'
  AND (SELECT body FROM public.consent_documents) LIKE '%[RAGIONE SOCIALE]%'
  AND (SELECT body FROM public.consent_documents) LIKE '%[PARTITA IVA]%'
  AND (SELECT body FROM public.consent_documents) LIKE '%[SEDE LEGALE]%'
  AND (SELECT body FROM public.consent_documents) LIKE '%[EMAIL PRIVACY]%'
  AND (SELECT body FROM public.consent_documents) LIKE '%[ETÀ MINIMA]%'
  AND (SELECT body FROM public.consent_documents) NOT LIKE '%12345678901%',
  'draft seeded once with placeholders only');

-- 2) Privilegi: anon niente, authenticated solo le RPC, niente tabelle, niente funzioni interne.
SELECT pg_temp.check(
  NOT has_table_privilege('anon', 'public.consent_events', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  AND NOT has_table_privilege('anon', 'public.consent_documents', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  AND NOT has_table_privilege('anon', 'public.profiling_settings', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  AND NOT has_table_privilege('authenticated', 'public.consent_events', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  AND NOT has_table_privilege('authenticated', 'public.consent_documents', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  AND NOT has_table_privilege('authenticated', 'public.profiling_settings', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  AND NOT has_table_privilege('service_role', 'public.consent_events', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),
  'no table privileges');

DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 170000 THEN
    IF has_table_privilege('anon', 'public.consent_events', 'MAINTAIN')
       OR has_table_privilege('authenticated', 'public.consent_events', 'MAINTAIN')
       OR has_table_privilege('anon', 'public.consent_documents', 'MAINTAIN')
       OR has_table_privilege('authenticated', 'public.profiling_settings', 'MAINTAIN')
       OR has_table_privilege('service_role', 'public.consent_events', 'MAINTAIN') THEN
      RAISE EXCEPTION 'MAINTAIN still granted';
    END IF;
  END IF;
END $$;

SELECT pg_temp.check(
  NOT has_sequence_privilege('anon', pg_get_serial_sequence('public.consent_events', 'seq'), 'USAGE,SELECT,UPDATE')
  AND NOT has_sequence_privilege('authenticated', pg_get_serial_sequence('public.consent_events', 'seq'), 'USAGE,SELECT,UPDATE')
  AND NOT has_sequence_privilege('service_role', pg_get_serial_sequence('public.consent_events', 'seq'), 'USAGE,SELECT,UPDATE'),
  'no sequence privileges');

SELECT pg_temp.check(
  has_function_privilege('authenticated', 'public.set_my_consent(text, boolean, text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.get_my_consent()', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.get_my_consent_history()', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.current_consent_document()', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.my_personalised_offer(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.list_inactive_customers(uuid, integer)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.venue_orders_by_weekday_hour(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.venue_top_products(uuid, integer)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.profiling_inactive_days(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.set_inactive_customer_days(uuid, integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.set_my_consent(text, boolean, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.list_inactive_customers(uuid, integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.current_consent_document()', 'EXECUTE')
  AND NOT has_function_privilege('public', 'public.list_inactive_customers(uuid, integer)', 'EXECUTE')
  AND NOT has_function_privilege('service_role', 'public.my_personalised_offer(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.consent_is_active(uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.consent_allows_personalisation(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.consent_events_guard()', 'EXECUTE')
  AND NOT has_function_privilege('public', 'public.consent_block_truncate()', 'EXECUTE'),
  'execute grants');

SELECT pg_temp.check(
  (SELECT bool_and(prosecdef AND proconfig @> ARRAY['search_path=public'])
   FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace
     AND proname IN (
       'consent_is_active', 'consent_allows_personalisation', 'consent_caller_can_read_venue',
       'current_consent_document', 'get_my_consent', 'get_my_consent_history', 'set_my_consent',
       'my_personalised_offer', 'profiling_inactive_days', 'set_inactive_customer_days',
       'list_inactive_customers', 'venue_orders_by_weekday_hour', 'venue_top_products'
     )),
  'security definer and search_path');

SELECT pg_temp.check(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.consent_events'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.consent_documents'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiling_settings'::regclass)
  AND NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    WHERE c.relname IN ('consent_events', 'consent_documents', 'profiling_settings')
  ),
  'RLS on and no open policies');

SELECT pg_temp.check(
  (SELECT proargnames FROM pg_proc WHERE proname = 'venue_top_products') @> ARRAY['product_name']::text[]
  AND NOT ((SELECT proargnames FROM pg_proc WHERE proname = 'venue_top_products')
           && ARRAY['customer_id', 'full_name', 'email', 'customer_name']::text[])
  AND NOT ((SELECT proargnames FROM pg_proc WHERE proname = 'venue_orders_by_weekday_hour')
           && ARRAY['customer_id', 'full_name', 'email', 'customer_name']::text[]),
  'aggregate signatures hide customers');

-- 3) Persone, prodotti, ordini. Il consenso si aggiunge dopo, dalle RPC.
INSERT INTO public.profiles (id, role, company_id, full_name, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin', '00000000-0000-0000-0000-000000000001', 'Titolare Uno', 'admin1@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin', '00000000-0000-0000-0000-000000000002', 'Titolare Due', 'admin2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'customer', NULL, 'Chiara Preferita', 'chiara@example.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'customer', NULL, 'Nessuno Consent', 'nessuno@example.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'customer', NULL, 'Solo Marketing', 'solo.marketing@example.test'),
  ('00000000-0000-0000-0000-0000000000c4', 'customer', NULL, 'Solo Profilo', 'solo.profilo@example.test'),
  ('00000000-0000-0000-0000-0000000000c5', 'customer', NULL, 'Ada Inattiva', 'ada.inattiva@example.test'),
  ('00000000-0000-0000-0000-0000000000c6', 'customer', NULL, 'Dario Diavola', 'dario@example.test'),
  ('00000000-0000-0000-0000-0000000000c7', 'customer', NULL, 'Lia Quaranta', 'lia.quaranta@example.test'),
  ('00000000-0000-0000-0000-0000000000c8', 'customer', NULL, 'Senza Consenso', 'senza.consenso@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'kiosk', '00000000-0000-0000-0000-000000000001', 'Cassa', 'cassa@example.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'customer', NULL, 'Piattaforma', 'piattaforma@example.test');
INSERT INTO public.platform_owners (user_id) VALUES ('00000000-0000-0000-0000-0000000000e1');

INSERT INTO public.products (id, company_id, name) VALUES
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Margherita'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Diavola'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Capricciosa'),
  ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000002', 'Solo Altra Pizzeria');

INSERT INTO public.orders (id, company_id, customer_id, status, total_amount, created_at) VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'delivered', 30, now() - interval '10 days'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c6', 'delivered', 20, now() - interval '10 days'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2', 'delivered', 15, now() - interval '90 days'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2', 'delivered', 10, timestamptz '2026-06-02 13:00:00+00'),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2', 'cancelled', 99, timestamptz '2026-06-02 13:00:00+00'),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c5', 'delivered', 8, now() - interval '90 days'),
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c5', 'rejected', 8, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000108', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c3', 'delivered', 8, now() - interval '90 days'),
  ('00000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c4', 'delivered', 8, now() - interval '90 days'),
  ('00000000-0000-0000-0000-00000000010a', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c7', 'delivered', 8, now() - interval '40 days'),
  ('00000000-0000-0000-0000-00000000010b', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c5', 'delivered', 100, now() - interval '90 days'),
  ('00000000-0000-0000-0000-00000000010c', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'delivered', 8, timestamptz '2026-06-02 22:30:00+00');

INSERT INTO public.order_items (order_id, product_id, quantity) VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000011', 3),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000012', 1),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000012', 4),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000013', 5),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000011', 2),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000011', 9),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000011', 1),
  ('00000000-0000-0000-0000-000000000108', '00000000-0000-0000-0000-000000000011', 1),
  ('00000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000011', 1),
  ('00000000-0000-0000-0000-00000000010a', '00000000-0000-0000-0000-000000000011', 1),
  ('00000000-0000-0000-0000-00000000010b', '00000000-0000-0000-0000-000000000014', 100),
  ('00000000-0000-0000-0000-00000000010c', '00000000-0000-0000-0000-000000000012', 1);

SELECT pg_temp.check(
  extract(isodow FROM timestamptz '2026-06-02 13:00:00+00' AT TIME ZONE 'Europe/Rome') = 2
  AND extract(hour FROM timestamptz '2026-06-02 13:00:00+00' AT TIME ZONE 'Europe/Rome') = 15
  AND extract(isodow FROM timestamptz '2026-06-02 22:30:00+00' AT TIME ZONE 'Europe/Rome') = 3
  AND extract(hour FROM timestamptz '2026-06-02 22:30:00+00' AT TIME ZONE 'Europe/Rome') = 0,
  'rome clock for the fixture orders');

-- 4) Il cliente accetta solo per sé. La seconda spunta identica non duplica la riga.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
SELECT * FROM public.set_my_consent('marketing', true, '2026-11-draft-1');
SELECT * FROM public.set_my_consent('profiling', true, '2026-11-draft-1');
SELECT * FROM public.set_my_consent('marketing', true, '2026-11-draft-1');

SELECT pg_temp.check(
  (SELECT count(*) FROM public.get_my_consent_history() WHERE purpose = 'marketing') = 1
  AND (SELECT count(*) FROM public.get_my_consent_history() WHERE purpose = 'profiling') = 1
  AND (SELECT count(*) FROM public.get_my_consent()) = 2
  AND (SELECT bool_and(granted) FROM public.get_my_consent())
  AND (SELECT version FROM public.current_consent_document()) = '2026-11-draft-1',
  'c1 grants once and reads the current notice');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c6', false);
SELECT * FROM public.set_my_consent('marketing', true, '2026-11-draft-1');
SELECT * FROM public.set_my_consent('profiling', true, '2026-11-draft-1');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c5', false);
SELECT * FROM public.set_my_consent('marketing', true, '2026-11-draft-1');
SELECT * FROM public.set_my_consent('profiling', true, '2026-11-draft-1');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c7', false);
SELECT * FROM public.set_my_consent('marketing', true, '2026-11-draft-1');
SELECT * FROM public.set_my_consent('profiling', true, '2026-11-draft-1');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', false);
SELECT * FROM public.set_my_consent('marketing', true, '2026-11-draft-1');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c4', false);
SELECT * FROM public.set_my_consent('profiling', true, '2026-11-draft-1');

-- c2 non ha righe: le caselle restano vuote.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
SELECT pg_temp.check(
  (SELECT count(*) FROM public.get_my_consent() WHERE granted) = 0
  AND (SELECT count(*) FROM public.get_my_consent_history()) = 0,
  'unticked customer has no consent row');

SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.set_my_consent('marketing', true, 'altra-versione')$q$,
  'CONSENT_VERSION_STALE',
  'stale notice is rejected');
SELECT pg_temp.check(
  (SELECT count(*) FROM public.get_my_consent_history()) = 0,
  'stale notice did not write a row');

-- 5) Offerte solo con entrambi i consensi, e solo sui propri ordini.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
SELECT pg_temp.check(
  (SELECT has_consent FROM public.my_personalised_offer('00000000-0000-0000-0000-000000000001'))
  AND (SELECT product_name FROM public.my_personalised_offer('00000000-0000-0000-0000-000000000001')) = 'Margherita'
  AND (SELECT quantity_total FROM public.my_personalised_offer('00000000-0000-0000-0000-000000000001')) = 3
  AND (SELECT has_consent FROM public.my_personalised_offer('00000000-0000-0000-0000-000000000002'))
  AND (SELECT product_name FROM public.my_personalised_offer('00000000-0000-0000-0000-000000000002')) IS NULL,
  'c1 sees own favorite and nothing from the other venue');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c6', false);
SELECT pg_temp.check(
  (SELECT product_name FROM public.my_personalised_offer('00000000-0000-0000-0000-000000000001')) = 'Diavola'
  AND (SELECT quantity_total FROM public.my_personalised_offer('00000000-0000-0000-0000-000000000001')) = 4,
  'c6 sees own favorite');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
SELECT pg_temp.check(
  NOT (SELECT has_consent FROM public.my_personalised_offer('00000000-0000-0000-0000-000000000001'))
  AND (SELECT product_name FROM public.my_personalised_offer('00000000-0000-0000-0000-000000000001')) IS NULL,
  'no consent means no favorite, even with a clear one');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', false);
SELECT pg_temp.check(
  NOT (SELECT has_consent FROM public.my_personalised_offer('00000000-0000-0000-0000-000000000001')),
  'marketing alone is not enough');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c4', false);
SELECT pg_temp.check(
  NOT (SELECT has_consent FROM public.my_personalised_offer('00000000-0000-0000-0000-000000000001')),
  'profiling alone is not enough');

-- 6) Elenco inattivi: solo entrambi i consensi, soglia 60, revoca immediata.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT pg_temp.check(
  public.profiling_inactive_days('00000000-0000-0000-0000-000000000001') = 60
  AND (SELECT count(*) FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000001')) = 1
  AND (SELECT email FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000001')) = 'ada.inattiva@example.test'
  AND NOT EXISTS (
    SELECT 1 FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000001')
    WHERE email IN ('nessuno@example.test', 'solo.marketing@example.test', 'solo.profilo@example.test', 'lia.quaranta@example.test')
  ),
  'default 60 days lists only the consenting inactive customer');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
SELECT pg_temp.check(
  (SELECT count(*) FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000001')) = 1
  AND (SELECT email FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000002')) = 'ada.inattiva@example.test'
  AND (SELECT coalesce(sum(order_count), 0) FROM public.venue_orders_by_weekday_hour('00000000-0000-0000-0000-000000000002')) = 1,
  'platform owner reads both venues');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
SELECT pg_temp.check(
  (SELECT email FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000002')) = 'ada.inattiva@example.test',
  'other venue admin sees only that venue');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000001')$q$,
  'CONSENT_FORBIDDEN',
  'admin of the other venue cannot list company 1');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT pg_temp.check(
  (SELECT coalesce(sum(order_count), 0) FROM public.venue_orders_by_weekday_hour('00000000-0000-0000-0000-000000000001')) = 9
  AND (SELECT order_count FROM public.venue_orders_by_weekday_hour('00000000-0000-0000-0000-000000000001') WHERE weekday = 2 AND hour = 15) = 1
  AND (SELECT order_count FROM public.venue_orders_by_weekday_hour('00000000-0000-0000-0000-000000000001') WHERE weekday = 3 AND hour = 0) = 1
  AND (SELECT quantity_total FROM public.venue_top_products('00000000-0000-0000-0000-000000000001', 8) WHERE product_name = 'Margherita') = 9
  AND (SELECT quantity_total FROM public.venue_top_products('00000000-0000-0000-0000-000000000001', 8) WHERE product_name = 'Diavola') = 6
  AND (SELECT quantity_total FROM public.venue_top_products('00000000-0000-0000-0000-000000000001', 8) WHERE product_name = 'Capricciosa') = 5
  AND NOT EXISTS (
    SELECT 1 FROM public.venue_top_products('00000000-0000-0000-0000-000000000001', 8)
    WHERE product_name = 'Solo Altra Pizzeria'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.venue_orders_by_weekday_hour('00000000-0000-0000-0000-000000000001') s
    WHERE s::text ILIKE '%@example.test%' OR s::text ILIKE '%nessuno%' OR s::text ILIKE '%ada.inattiva%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.venue_top_products('00000000-0000-0000-0000-000000000001', 8) s
    WHERE s::text ILIKE '%@example.test%' OR s::text ILIKE '%nessuno%'
  ),
  'aggregates count everyone and hide people');

SELECT pg_temp.check(
  public.set_inactive_customer_days('00000000-0000-0000-0000-000000000001', 30) = 30,
  'save threshold');
SELECT pg_temp.check(
  (SELECT count(*) FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000001', NULL)) = 2
  AND (SELECT count(*) FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000001', 120)) = 0
  AND public.profiling_inactive_days('00000000-0000-0000-0000-000000000001') = 30,
  'threshold is configurable and the override does not stick');

SELECT pg_temp.expect_err(
  $q$SELECT public.set_inactive_customer_days('00000000-0000-0000-0000-000000000001', 6)$q$,
  'CONSENT_DAYS_INVALID',
  'too small threshold');
SELECT pg_temp.expect_err(
  $q$SELECT public.set_inactive_customer_days('00000000-0000-0000-0000-000000000001', 731)$q$,
  'CONSENT_DAYS_INVALID',
  'too large threshold');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.venue_top_products('00000000-0000-0000-0000-000000000001', 0)$q$,
  'CONSENT_LIMIT_INVALID',
  'limit too small');

-- Revoca della profilazione: Ada esce subito. Lia (40 giorni, soglia 30) resta.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c5', false);
SELECT * FROM public.set_my_consent('profiling', false, '2026-11-draft-1');
SELECT pg_temp.check(
  NOT (SELECT has_consent FROM public.my_personalised_offer('00000000-0000-0000-0000-000000000001'))
  AND (SELECT product_name FROM public.my_personalised_offer('00000000-0000-0000-0000-000000000001')) IS NULL
  AND (SELECT count(*) FROM public.get_my_consent_history() WHERE purpose = 'profiling') = 2,
  'revoke stops the offer and keeps both history rows');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT pg_temp.check(
  (SELECT count(*) FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000001', NULL)) = 1
  AND (SELECT email FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000001', NULL)) = 'lia.quaranta@example.test',
  'revocation removes the customer at once');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c5', false);
SELECT * FROM public.set_my_consent('profiling', true, '2026-11-draft-1');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT pg_temp.check(
  (SELECT count(*) FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000001', NULL)) = 2,
  'granting again puts the customer back');

-- 7) Accessi negati: kiosk, cliente, anon, admin che non è customer.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000001')$q$,
  'CONSENT_FORBIDDEN',
  'kiosk cannot list inactive customers');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.venue_orders_by_weekday_hour('00000000-0000-0000-0000-000000000001')$q$,
  'CONSENT_FORBIDDEN',
  'kiosk cannot read aggregates');
SELECT pg_temp.expect_err(
  $q$SELECT public.set_inactive_customer_days('00000000-0000-0000-0000-000000000001', 60)$q$,
  'CONSENT_FORBIDDEN',
  'kiosk cannot change the threshold');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.set_my_consent('marketing', true, '2026-11-draft-1')$q$,
  'CONSENT_FORBIDDEN',
  'kiosk cannot grant consent');
SELECT pg_temp.check(
  (SELECT version FROM public.current_consent_document()) = '2026-11-draft-1',
  'kiosk may still read the notice text');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000001')$q$,
  'CONSENT_FORBIDDEN',
  'customer cannot list inactive customers');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.venue_top_products('00000000-0000-0000-0000-000000000001', 8)$q$,
  'CONSENT_FORBIDDEN',
  'customer cannot read venue stats');
SELECT pg_temp.expect_err(
  $q$SELECT count(*) FROM public.consent_events$q$,
  '42501',
  'customer cannot read the consent table');
SELECT pg_temp.expect_err(
  $q$DO $do$
BEGIN
  PERFORM set_config('skibidi.consent_write', 'event', true);
  INSERT INTO public.consent_events (user_id, purpose, granted, document_version)
  VALUES ('00000000-0000-0000-0000-0000000000c2', 'marketing', true, '2026-11-draft-1');
END
$do$;$q$,
  '42501',
  'customer has no insert privilege on the consent log');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.set_my_consent('marketing', true, '2026-11-draft-1')$q$,
  'CONSENT_FORBIDDEN',
  'admin cannot consent on behalf of a customer');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
SELECT pg_temp.expect_err(
  $q$SELECT public.set_inactive_customer_days('00000000-0000-0000-0000-000000000001', 60)$q$,
  'CONSENT_FORBIDDEN',
  'other admin cannot change company 1');

SET ROLE anon;
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.set_my_consent('marketing', true, '2026-11-draft-1')$q$,
  '42501',
  'anon cannot consent');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000001')$q$,
  '42501',
  'anon cannot list');
SELECT pg_temp.expect_err(
  $q$SELECT * FROM public.current_consent_document()$q$,
  '42501',
  'anon cannot read the notice via rpc');

-- 8) Registro append-only, anche per postgres. Poi un ordine senza consenso.
RESET ROLE;
GRANT INSERT ON TABLE public.consent_events TO authenticated;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
SELECT pg_temp.expect_err(
  $q$DO $do$
BEGIN
  PERFORM set_config('skibidi.consent_write', 'event', true);
  INSERT INTO public.consent_events (user_id, purpose, granted, document_version)
  VALUES ('00000000-0000-0000-0000-0000000000c2', 'marketing', true, '2026-11-draft-1');
END
$do$;$q$,
  'CONSENT_FORBIDDEN',
  'even a future insert grant cannot write another customer or skip the guard');
RESET ROLE;
REVOKE INSERT ON TABLE public.consent_events FROM authenticated;
SELECT pg_temp.check(
  (SELECT count(*) FROM public.consent_events WHERE user_id = '00000000-0000-0000-0000-0000000000c2') = 0
  AND (SELECT count(*) FROM public.consent_events WHERE user_id = '00000000-0000-0000-0000-0000000000c1' AND purpose = 'marketing') = 1,
  'c2 stayed empty and c1 did not double the marketing row');
CREATE TEMP TABLE t_event_count AS SELECT count(*)::integer AS n FROM public.consent_events;
SELECT pg_temp.expect_err(
  $q$INSERT INTO public.consent_events (user_id, purpose, granted, document_version)
     VALUES ('00000000-0000-0000-0000-0000000000c1', 'marketing', false, '2026-11-draft-1')$q$,
  'CONSENT_FORBIDDEN',
  'direct insert without the rpc flag fails');
SELECT pg_temp.expect_err(
  'UPDATE public.consent_events SET granted = false',
  'CONSENT_APPEND_ONLY',
  'no update of consent history');
SELECT pg_temp.expect_err(
  'DELETE FROM public.consent_events',
  'CONSENT_APPEND_ONLY',
  'no delete of consent history');
SELECT pg_temp.expect_err(
  'TRUNCATE public.consent_events',
  'CONSENT_APPEND_ONLY',
  'no truncate of consent history');
SELECT pg_temp.expect_err(
  'UPDATE public.consent_documents SET title = title',
  'CONSENT_DOCUMENT_IMMUTABLE',
  'notice text is immutable');
SELECT pg_temp.expect_err(
  'DELETE FROM public.consent_documents',
  'CONSENT_DOCUMENT_IMMUTABLE',
  'notice text cannot be deleted');
SELECT pg_temp.expect_err(
  'TRUNCATE public.profiling_settings',
  'CONSENT_FORBIDDEN',
  'settings cannot be truncated');
SELECT pg_temp.check(
  (SELECT n FROM t_event_count) = (SELECT count(*) FROM public.consent_events)
  AND (SELECT count(*) FROM public.consent_documents) = 1,
  'history and notice survived the rejected writes');

-- Ordinare non chiede il consenso: l'inserimento dell'ordine resta possibile
-- e il cliente senza righe di consenso non entra in elenco né in offerta.
INSERT INTO public.orders (id, company_id, customer_id, status, total_amount, created_at)
VALUES (
  '00000000-0000-0000-0000-00000000010d',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000c8',
  'delivered',
  12,
  now() - interval '90 days'
);
INSERT INTO public.order_items (order_id, product_id, quantity)
VALUES ('00000000-0000-0000-0000-00000000010d', '00000000-0000-0000-0000-000000000013', 8);

SELECT pg_temp.check(
  (SELECT count(*) FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    WHERE c.relname IN ('orders', 'order_items')
      AND pg_get_triggerdef(tg.oid) ILIKE '%consent%') = 0
  AND (SELECT count(*) FROM public.orders WHERE customer_id = '00000000-0000-0000-0000-0000000000c8') = 1
  AND (SELECT count(*) FROM public.consent_events WHERE user_id = '00000000-0000-0000-0000-0000000000c8') = 0,
  'an order does not require a consent row and does not touch order triggers');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c8', false);
SELECT pg_temp.check(
  NOT (SELECT has_consent FROM public.my_personalised_offer('00000000-0000-0000-0000-000000000001'))
  AND (SELECT product_name FROM public.my_personalised_offer('00000000-0000-0000-0000-000000000001')) IS NULL,
  'new order without consent produces no offer');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT pg_temp.check(
  NOT EXISTS (
    SELECT 1 FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000001', NULL)
    WHERE email = 'senza.consenso@example.test'
  )
  AND (SELECT count(*) FROM public.list_inactive_customers('00000000-0000-0000-0000-000000000001', NULL)) = 2,
  'the new order does not put a non-consenting customer on the inactive list');
