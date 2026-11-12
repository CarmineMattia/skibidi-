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

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (
  '00000000-0000-0000-0000-0000000000f4',
  'giulia@example.test',
  '{"name":"Giulia Google","role":"admin","company_id":"00000000-0000-0000-0000-000000000002","picture":"https://example.test/giulia.png"}'::jsonb
);
SELECT public.t_assert(
  (SELECT full_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f4') = 'Giulia Google'
  AND (SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f4') = 'customer'
  AND (SELECT company_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f4') IS NULL,
  'google name is copied when full_name is missing; role and company are not');

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

-- 5) anon cannot read or write orders. Policies are TO authenticated.
SELECT public.t_assert(
  NOT has_table_privilege('anon', 'public.orders', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.orders', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.orders', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.orders', 'DELETE')
  AND NOT has_table_privilege('anon', 'public.order_items', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.order_items', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.order_items', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.order_items', 'DELETE')
  AND has_table_privilege('authenticated', 'public.orders', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.order_items', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.order_items', 'DELETE'),
  'anon has no privileges on orders or order_items');
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relname IN ('orders', 'order_items')
    AND (
      coalesce(cardinality(pol.polroles), 0) = 0
      OR 0::oid = ANY (coalesce(pol.polroles, ARRAY[]::oid[]))
      OR EXISTS (
        SELECT 1 FROM pg_roles r
        WHERE r.rolname = 'anon' AND r.oid = ANY (coalesce(pol.polroles, ARRAY[]::oid[]))
      )
    );
  IF n <> 0 THEN
    RAISE EXCEPTION 'orders policies still apply to anon or public (%)', n;
  END IF;
END $$;

-- 6) Product images: writes need the company prefix. Flat objects stay listable by staff.
SELECT public.t_assert(
  (SELECT "public" FROM storage.buckets WHERE id = 'products')
  AND (SELECT file_size_limit FROM storage.buckets WHERE id = 'products') = 5242880,
  'products bucket stays public with the 5 MB cap');
SELECT public.t_assert(
  position('split_part' in pg_get_expr(pol.polwithcheck, pol.polrelid)) > 0
  AND position('is_admin' in pg_get_expr(pol.polwithcheck, pol.polrelid)) > 0
  AND position('split_part' in coalesce(pg_get_expr(sel.polqual, sel.polrelid), '')) = 0
  AND position('!~' in pg_get_expr(pol.polwithcheck, pol.polrelid)) > 0,
  'writes check the company prefix and reject traversal; staff listing of flat paths does not')
FROM pg_policy pol, pg_policy sel
WHERE pol.polname = 'products_images_staff_insert'
  AND sel.polname = 'products_images_staff_select';

BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
INSERT INTO storage.objects (bucket_id, name)
VALUES ('products', '00000000-0000-0000-0000-000000000001/pizza.webp');
SELECT public.t_assert(
  EXISTS (SELECT 1 FROM storage.objects WHERE name = 'legacy-flat.jpg'),
  'admin can still read a flat-path product image');
DO $$
BEGIN
  INSERT INTO storage.objects (bucket_id, name) VALUES ('products', 'flat-new.jpg');
  RAISE EXCEPTION 'ASSERT FAILED: admin wrote a flat path';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  INSERT INTO storage.objects (bucket_id, name)
  VALUES ('products', '00000000-0000-0000-0000-000000000002/pizza.webp');
  RAISE EXCEPTION 'ASSERT FAILED: admin wrote another company prefix';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  INSERT INTO storage.objects (bucket_id, name) VALUES (
    'products',
    '00000000-0000-0000-0000-000000000001/../00000000-0000-0000-0000-000000000002/x.jpg'
  );
  RAISE EXCEPTION 'ASSERT FAILED: traversal path was stored';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  INSERT INTO storage.objects (bucket_id, name)
  VALUES ('products', '00000000-0000-0000-0000-000000000001//x.jpg');
  RAISE EXCEPTION 'ASSERT FAILED: empty path segment was stored';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  INSERT INTO storage.objects (bucket_id, name)
  VALUES ('products', '/00000000-0000-0000-0000-000000000001/x.jpg');
  RAISE EXCEPTION 'ASSERT FAILED: leading slash was stored';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  INSERT INTO storage.objects (bucket_id, name)
  VALUES ('products', E'00000000-0000-0000-0000-000000000001\\x.jpg');
  RAISE EXCEPTION 'ASSERT FAILED: backslash was stored';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
ROLLBACK;

BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c1');
DO $$
BEGIN
  INSERT INTO storage.objects (bucket_id, name)
  VALUES ('products', '00000000-0000-0000-0000-000000000001/customer.webp');
  RAISE EXCEPTION 'ASSERT FAILED: customer wrote a product image';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
ROLLBACK;

-- 7) Staff see only their company. Customers see only their own order.
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000a2', 'admin2@example.test');
UPDATE public.profiles
SET role = 'admin', company_id = '00000000-0000-0000-0000-000000000002', full_name = 'Admin Altra'
WHERE id = '00000000-0000-0000-0000-0000000000a2';
INSERT INTO public.order_items (id, order_id, product_id, quantity)
VALUES (
  '00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-000000000011',
  1
);
SELECT public.t_assert(
  position('get_my_company_id' in pg_get_expr(v.polqual, v.polrelid)) > 0
  AND position('get_my_company_id' in pg_get_expr(u.polqual, u.polrelid)) > 0
  AND position('get_my_company_id' in pg_get_expr(i.polqual, i.polrelid)) > 0,
  'legacy order policies filter staff by company')
FROM pg_policy v, pg_policy u, pg_policy i
WHERE v.polname = 'Users can view own orders'
  AND u.polname = 'Users can update own orders'
  AND i.polname = 'Users can view order items';

BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
SELECT public.t_assert(
  EXISTS (SELECT 1 FROM public.orders WHERE id = '00000000-0000-0000-0000-0000000000d1')
  AND EXISTS (SELECT 1 FROM public.order_items WHERE id = '00000000-0000-0000-0000-0000000000e1'),
  'admin sees the order of their company');
UPDATE public.orders SET notes = 'cucina' WHERE id = '00000000-0000-0000-0000-0000000000d1';
SELECT public.t_assert(
  (SELECT notes FROM public.orders WHERE id = '00000000-0000-0000-0000-0000000000d1') = 'cucina',
  'admin of the company can update the order');
ROLLBACK;

BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000b1');
SELECT public.t_assert(
  EXISTS (SELECT 1 FROM public.orders WHERE id = '00000000-0000-0000-0000-0000000000d1'),
  'kiosk of the company can see the order');
ROLLBACK;

BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c1');
SELECT public.t_assert(
  EXISTS (SELECT 1 FROM public.orders WHERE id = '00000000-0000-0000-0000-0000000000d1'),
  'customer sees their own order');
INSERT INTO public.orders (id, company_id, customer_id, status)
VALUES (
  '00000000-0000-0000-0000-0000000000d9',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000c1',
  'pending'
);
SELECT public.t_assert(
  EXISTS (SELECT 1 FROM public.orders WHERE id = '00000000-0000-0000-0000-0000000000d9'),
  'customer can still insert an order');
ROLLBACK;

BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a2');
SELECT public.t_assert(
  NOT EXISTS (SELECT 1 FROM public.orders WHERE id = '00000000-0000-0000-0000-0000000000d1')
  AND NOT EXISTS (SELECT 1 FROM public.order_items WHERE id = '00000000-0000-0000-0000-0000000000e1'),
  'admin of another company cannot see the order');
DO $$
DECLARE n integer;
BEGIN
  UPDATE public.orders SET status = 'cancelled' WHERE id = '00000000-0000-0000-0000-0000000000d1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'ASSERT FAILED: other company admin updated the order'; END IF;
END $$;
ROLLBACK;

BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000b2');
SELECT public.t_assert(
  NOT EXISTS (SELECT 1 FROM public.orders WHERE id = '00000000-0000-0000-0000-0000000000d1')
  AND NOT EXISTS (SELECT 1 FROM public.order_items WHERE id = '00000000-0000-0000-0000-0000000000e1'),
  'kiosk of another company cannot see the order');
ROLLBACK;

BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c2');
SELECT public.t_assert(
  NOT EXISTS (SELECT 1 FROM public.orders WHERE id = '00000000-0000-0000-0000-0000000000d1'),
  'another customer cannot see the order');
ROLLBACK;

-- Avatar column is optional. When it exists, picture/avatar_url is copied.
ALTER TABLE public.profiles ADD COLUMN avatar_url text;
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (
  '00000000-0000-0000-0000-0000000000f5',
  'avatar@example.test',
  '{"name":"Ada Avatar","role":"kiosk","company_id":"00000000-0000-0000-0000-000000000002","picture":"https://example.test/ada.png"}'::jsonb
);
SELECT public.t_assert(
  (SELECT full_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f5') = 'Ada Avatar'
  AND (SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f5') = 'customer'
  AND (SELECT avatar_url FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f5') = 'https://example.test/ada.png'
  AND (SELECT company_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f5')
      IS NOT DISTINCT FROM public.default_customer_company_id(),
  'avatar column receives the Google picture; role and company stay server-side');

SELECT 'PASS: security hardening grants, tracking, signup, role lock' AS result;
