-- After 20261020170000_customer_company_menu.sql (run on customer-company-menu-schema.sql).
-- 1) backfill: the NULL-company customers now have Ambrosia; staff / kiosk untouched
SELECT public.t_assert((SELECT count(*) FROM public.profiles WHERE company_id IS NULL AND role = 'customer') = 0, 'backfill: no NULL-company customers');
SELECT public.t_assert((SELECT company_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000e1') = '00000000-0000-0000-0000-000000000001', 'backfill: e1 -> Ambrosia');
SELECT public.t_assert((SELECT company_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000e3') IS NULL, 'backfill: kiosk profile untouched');
SELECT public.t_assert((SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000d1') = 'admin', 'admin unchanged');

-- 2) menu visible for every session, only active companies for logged-in users
DO $$ BEGIN UPDATE public.profiles SET company_id = NULL WHERE id = '00000000-0000-0000-0000-0000000000e2'; END $$;  -- as owner: a NULL profile again
BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000e2');
SELECT public.t_assert((SELECT count(*) FROM public.products WHERE active AND company_id = '00000000-0000-0000-0000-000000000001') = 2, 'NULL-company customer sees the active menu');
SELECT public.t_assert((SELECT count(*) FROM public.categories WHERE company_id = '00000000-0000-0000-0000-000000000001') = 2, 'NULL-company customer sees the categories');
SELECT public.t_assert((SELECT count(*) FROM public.products WHERE company_id = '00000000-0000-0000-0000-000000000002') = 0, 'inactive company menu stays hidden to customers');
SELECT public.t_assert((SELECT count(*) FROM public.categories WHERE company_id = '00000000-0000-0000-0000-000000000002') = 0, 'inactive company categories stay hidden');
ROLLBACK;
BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000e1');
SELECT public.t_assert((SELECT count(*) FROM public.products WHERE active) = 2, 'backfilled customer sees the menu');
ROLLBACK;
BEGIN;  -- anonymous Supabase session (signInAnonymously): uid set, no profile
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000ff","is_anonymous":true}', true);
SET LOCAL ROLE authenticated;
SELECT public.t_assert((SELECT count(*) FROM public.products WHERE active AND company_id = '00000000-0000-0000-0000-000000000001') = 2, 'anonymous session sees the menu');
ROLLBACK;
BEGIN;
SELECT public.t_as('anon', NULL);
SELECT public.t_assert((SELECT count(*) FROM public.products WHERE active AND company_id = '00000000-0000-0000-0000-000000000001') = 2, 'anon still sees the menu');
SELECT public.t_assert((SELECT count(*) FROM public.products) = 4, 'anon visibility unchanged (as before: all rows)');
ROLLBACK;
BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000d1');
SELECT public.t_assert((SELECT count(*) FROM public.products WHERE company_id = '00000000-0000-0000-0000-000000000001') = 3, 'admin sees own products incl. inactive');
ROLLBACK;

-- 3) writes unchanged: customers cannot write the menu, admins only their company
DO $$ DECLARE n integer; BEGIN
  PERFORM public.t_as('authenticated', '00000000-0000-0000-0000-0000000000e1');
  UPDATE public.products SET price = 0 WHERE id = '00000000-0000-0000-0000-0000000000a3';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.t_assert(n = 0, 'customer cannot update products');
  BEGIN
    INSERT INTO public.products (category_id, name, price, company_id)
    VALUES ('00000000-0000-0000-0000-0000000000a1', 'X', 1, '00000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'ASSERT FAILED: customer inserted a product';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  DELETE FROM public.categories WHERE id = '00000000-0000-0000-0000-0000000000a2';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.t_assert(n = 0, 'customer cannot delete categories');
END $$;
RESET ROLE;
SELECT public.t_assert((SELECT price FROM public.products WHERE id = '00000000-0000-0000-0000-0000000000a3') = 5, 'price untouched');

-- 4) new signups get the company (Google login: no company in metadata)
INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 'g1@example.test', '{"full_name":"G1"}', '{"provider":"google"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'g2@example.test', '{"company_id":"00000000-0000-0000-0000-000000000002"}', '{"provider":"email"}'),
  ('00000000-0000-0000-0000-0000000000f4', 'g4@example.test', '{"company_id":"00000000-0000-0000-0000-000000000001"}', '{"provider":"email"}');
SELECT public.t_assert((SELECT company_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f1') = '00000000-0000-0000-0000-000000000001', 'Google signup -> Ambrosia');
SELECT public.t_assert((SELECT company_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f2') = '00000000-0000-0000-0000-000000000001', 'signup with an inactive company in metadata -> Ambrosia');
SELECT public.t_assert((SELECT company_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f4') = '00000000-0000-0000-0000-000000000001', 'signup with the active company kept');
SELECT public.t_assert((SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f1') = 'customer', 'signup role customer');

-- client self-healing insert (no company) as the user -> Ambrosia; role escalation still refused
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000f3', 'g3@example.test');
DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f3';
BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000f3');
INSERT INTO public.profiles (id, email, role) VALUES ('00000000-0000-0000-0000-0000000000f3', 'g3@example.test', 'customer');
SELECT public.t_assert((SELECT company_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f3') = '00000000-0000-0000-0000-000000000001', 'self-heal insert -> Ambrosia');
ROLLBACK;
DO $$ BEGIN
  BEGIN
    PERFORM public.t_as('authenticated', '00000000-0000-0000-0000-0000000000f3');
    INSERT INTO public.profiles (id, email, role) VALUES ('00000000-0000-0000-0000-0000000000f3', 'g3@example.test', 'admin');
    RAISE EXCEPTION 'ASSERT FAILED: self-assigned admin';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASSERT FAILED%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
-- customers still cannot change their company
DO $$ BEGIN
  BEGIN
    PERFORM public.t_as('authenticated', '00000000-0000-0000-0000-0000000000e1');
    UPDATE public.profiles SET company_id = '00000000-0000-0000-0000-000000000002' WHERE id = '00000000-0000-0000-0000-0000000000e1';
    RAISE EXCEPTION 'ASSERT FAILED: customer changed own company_id';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASSERT FAILED%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

-- 5) two active companies: nothing is guessed, the menus are still public
UPDATE public.companies SET active = true WHERE id = '00000000-0000-0000-0000-000000000002';
SELECT public.t_assert(public.default_customer_company_id() IS NULL, 'no default with 2 active companies');
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000f5', 'g5@example.test');
SELECT public.t_assert((SELECT company_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f5') IS NULL, 'multi-tenant signup without company stays NULL');
BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000f5');
SELECT public.t_assert((SELECT count(*) FROM public.products WHERE active) = 3, 'multi-tenant NULL customer sees both active menus');
ROLLBACK;
UPDATE public.companies SET active = false WHERE id = '00000000-0000-0000-0000-000000000002';

-- 6) grants: the new functions are not callable by clients
SELECT public.t_assert(NOT has_function_privilege('anon', 'public.default_customer_company_id()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.default_customer_company_id()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.profiles_assign_default_company()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.profiles_assign_default_company()', 'EXECUTE'), 'new functions not executable by clients');
SELECT 'customer-company-menu: ALL ASSERTS PASS' AS status;
