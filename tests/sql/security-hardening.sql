-- After security-hardening-schema.sql and 20261111234500 (applied twice).
-- Disposable local database only.

-- 1) Grants RLS does not need are gone. Grants a policy still uses stay.
SELECT public.t_assert(
  NOT has_table_privilege('anon', 'public.order_daily_counters', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.order_daily_counters', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.order_daily_counters', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.order_daily_counters', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.order_daily_counters', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.order_daily_counters', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.order_daily_counters', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.order_daily_counters', 'DELETE')
  AND NOT has_table_privilege('public', 'public.order_daily_counters', 'SELECT'),
  'order_daily_counters has no client privileges');
SELECT public.t_assert(
  NOT has_table_privilege('anon', 'public.internal_probe', 'SELECT,INSERT,UPDATE,DELETE')
  AND NOT has_table_privilege('authenticated', 'public.internal_probe', 'SELECT,INSERT,UPDATE,DELETE')
  AND NOT has_table_privilege('public', 'public.internal_probe', 'INSERT'),
  'table with RLS and no policy is closed');
SELECT public.t_assert(
  has_table_privilege('authenticated', 'public.staff_read_only', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.staff_read_only', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.staff_read_only', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.staff_read_only', 'DELETE')
  AND NOT has_table_privilege('anon', 'public.staff_read_only', 'SELECT'),
  'select-only policy keeps only that grant');
SELECT public.t_assert(
  has_table_privilege('anon', 'public.products', 'SELECT')
  AND has_table_privilege('authenticated', 'public.products', 'SELECT')
  AND has_table_privilege('authenticated', 'public.products', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.products', 'INSERT'),
  'menu read and staff insert stay, anon insert does not');
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 170000
     AND has_table_privilege('anon', 'public.order_daily_counters', 'MAINTAIN') THEN
    RAISE EXCEPTION 'anon still has MAINTAIN on order_daily_counters';
  END IF;
  IF has_table_privilege('anon', 'public.orders', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.order_daily_counters', 'TRUNCATE') THEN
    RAISE EXCEPTION 'TRUNCATE still granted';
  END IF;
END $$;

-- 2) Tracking: owner and staff get status only. Everyone else gets nothing.
--    anon cannot execute the function.
SELECT public.t_assert(
  has_function_privilege('authenticated', 'public.get_order_tracking(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.get_order_tracking(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.order_submission_snapshot(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.order_submission_snapshot(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('service_role', 'public.order_submission_snapshot(uuid)', 'EXECUTE'),
  'tracking execute is authenticated-only; snapshot is not a client RPC');

BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c1');
SELECT public.t_assert(
  (public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') ->> 'status') = 'pending'
  AND (public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') ->> 'display_code') = 'Ordine #4'
  AND (public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') ->> 'order_type') = 'take_away'
  AND (public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') ->> 'table_number') = 'B2'
  AND (public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') ->> 'decline_reason_preset') = 'forno pieno'
  AND NOT (public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') ? 'customer_name')
  AND NOT (public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') ? 'customer_phone')
  AND NOT (public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') ? 'delivery_address')
  AND NOT (public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') ? 'notes')
  AND NOT (public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') ? 'customer_id'),
  'owner tracking is status, number and pickup only');
ROLLBACK;

BEGIN;
SELECT set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000c1","is_anonymous":true}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
SET LOCAL ROLE authenticated;
SELECT public.t_assert(
  (public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') ->> 'status') = 'pending'
  AND NOT (public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') ? 'customer_name'),
  'anonymous owner can track without PII');
ROLLBACK;

BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c2');
SELECT public.t_assert(
  public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') IS NULL,
  'another customer cannot read the order');
ROLLBACK;

BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
SELECT public.t_assert(
  (public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') ->> 'display_code') = 'Ordine #4'
  AND NOT (public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') ? 'customer_phone'),
  'admin of the company can track without the phone');
ROLLBACK;

BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000b1');
SELECT public.t_assert(
  (public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') ->> 'status') = 'pending',
  'kiosk of the company can track');
ROLLBACK;

BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000b2');
SELECT public.t_assert(
  public.get_order_tracking('00000000-0000-0000-0000-0000000000d1') IS NULL,
  'kiosk of another company cannot track');
ROLLBACK;

BEGIN;
SELECT public.t_as('anon', NULL);
DO $$
BEGIN
  PERFORM public.get_order_tracking('00000000-0000-0000-0000-0000000000d1');
  RAISE EXCEPTION 'ASSERT FAILED: anon executed get_order_tracking';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
ROLLBACK;

-- Checkout still reads the saved row through the internal snapshot.
BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c1');
SELECT public.t_assert(
  (public.create_order_with_items('{"id":"00000000-0000-0000-0000-0000000000d1"}'::jsonb, '[]'::jsonb) ->> 'customer_name') = 'Mario Rossi'
  AND position('order_submission_snapshot' in pg_get_functiondef('public.create_order_with_items(jsonb, jsonb)'::regprocedure)) > 0
  AND position('get_order_tracking' in pg_get_functiondef('public.create_order_with_items(jsonb, jsonb)'::regprocedure)) = 0,
  'create_order_with_items reads the snapshot, not the public RPC');
ROLLBACK;

-- 3) Signup ignores role and company_id in metadata.
DO $$
DECLARE src text;
BEGIN
  src := pg_get_functiondef('public.handle_new_user()'::regprocedure);
  IF src LIKE '%raw_user_meta_data->>''role''%' OR src LIKE '%raw_user_meta_data->>''company_id''%' THEN
    RAISE EXCEPTION 'handle_new_user still reads role or company_id from metadata';
  END IF;
  IF position('default_customer_company_id' in src) = 0 OR position('''customer''::public.user_role' in src) = 0 THEN
    RAISE EXCEPTION 'handle_new_user does not assign the server-side defaults';
  END IF;
END $$;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (
  '00000000-0000-0000-0000-0000000000f1',
  'attacco@example.test',
  '{"role":"admin","company_id":"00000000-0000-0000-0000-000000000002","full_name":"Attacco"}'::jsonb
);
SELECT public.t_assert(
  (SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f1') = 'customer'
  AND (SELECT company_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f1') IS NULL
  AND (SELECT full_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f1') = 'Attacco',
  'two active companies: metadata company and role are ignored');

UPDATE public.companies SET active = false WHERE id = '00000000-0000-0000-0000-000000000002';
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (
  '00000000-0000-0000-0000-0000000000f2',
  'google@example.test',
  '{"role":"kiosk","company_id":"00000000-0000-0000-0000-000000000002","full_name":"Google"}'::jsonb
);
SELECT public.t_assert(
  (SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f2') = 'customer'
  AND (SELECT company_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f2') = '00000000-0000-0000-0000-000000000001',
  'one active company: signup gets that company, not the metadata one');

-- 4) A user cannot write their own role or company_id. Contact fields still update.
SELECT public.t_assert(
  NOT has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.profiles', 'company_id', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.profiles', 'role', 'INSERT')
  AND NOT has_column_privilege('authenticated', 'public.profiles', 'company_id', 'INSERT')
  AND NOT has_column_privilege('anon', 'public.profiles', 'role', 'UPDATE')
  AND has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
  AND has_column_privilege('authenticated', 'public.profiles', 'email', 'INSERT'),
  'column privileges hide role and company_id');

BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c1');
DO $$
BEGIN
  UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-0000-0000-0000000000c1';
  RAISE EXCEPTION 'ASSERT FAILED: customer updated role';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASSERT FAILED%' THEN RAISE; END IF;
END $$;
DO $$
BEGIN
  UPDATE public.profiles SET company_id = '00000000-0000-0000-0000-000000000002'
    WHERE id = '00000000-0000-0000-0000-0000000000c1';
  RAISE EXCEPTION 'ASSERT FAILED: customer updated company';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASSERT FAILED%' THEN RAISE; END IF;
END $$;
ROLLBACK;

BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c1');
UPDATE public.profiles SET full_name = 'Mario aggiornato' WHERE id = '00000000-0000-0000-0000-0000000000c1';
COMMIT;
SELECT public.t_assert(
  (SELECT full_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000c1') = 'Mario aggiornato'
  AND (SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000c1') = 'customer',
  'customer can still update the name');

-- Trigger still blocks the column if the grant is put back.
GRANT UPDATE (role) ON TABLE public.profiles TO authenticated;
BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c1');
DO $$
BEGIN
  UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-0000-0000-0000000000c1';
  RAISE EXCEPTION 'ASSERT FAILED: trigger allowed a self-assigned role';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASSERT FAILED%' THEN RAISE; END IF;
END $$;
ROLLBACK;
REVOKE UPDATE (role) ON TABLE public.profiles FROM authenticated;

-- SQL editor (table owner, no JWT) can still promote.
UPDATE public.profiles SET role = 'kiosk' WHERE id = '00000000-0000-0000-0000-0000000000c2';
SELECT public.t_assert(
  (SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000c2') = 'kiosk',
  'sql editor can change a role');
UPDATE public.profiles SET role = 'customer' WHERE id = '00000000-0000-0000-0000-0000000000c2';

-- Self-heal insert does not send role or company_id.
-- Repeat the deactivation: a ROLLBACK above ends the transaction that
-- contained the first UPDATE, so both companies would be active again.
UPDATE public.companies SET active = false WHERE id = '00000000-0000-0000-0000-000000000002';
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000f3', 'heal@example.test');
DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f3';
BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000f3');
DO $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES ('00000000-0000-0000-0000-0000000000f3', 'heal@example.test', 'admin');
  RAISE EXCEPTION 'ASSERT FAILED: self-heal inserted a role';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
INSERT INTO public.profiles (id, email, full_name)
VALUES ('00000000-0000-0000-0000-0000000000f3', 'heal@example.test', 'Ospite');
COMMIT;
SELECT public.t_assert(
  (SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f3') = 'customer'
  AND (SELECT company_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f3') = '00000000-0000-0000-0000-000000000001',
  'self-heal insert gets customer and the default company');

SELECT 'PASS: security hardening grants, tracking, signup, role lock' AS result;
