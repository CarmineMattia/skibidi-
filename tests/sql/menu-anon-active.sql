-- After 20261020170000_customer_company_menu.sql + 20261022100000_order_notes_menu_hardening.sql
-- on tests/sql/customer-company-menu-schema.sql. Disposable local DB (PGlite) only.
-- Fixture: Ambrosia (active) with Margherita, Acqua (active) and Vecchia (inactive);
-- "Chiusa" (inactive company) with Altra (active product) and its category.

-- anon (no login): only active products/categories of active companies
BEGIN;
SELECT public.t_as('anon', NULL);
SELECT public.t_assert((SELECT count(*) FROM public.products) = 2, 'anon: only the 2 active products of active companies');
SELECT public.t_assert(NOT EXISTS (SELECT 1 FROM public.products WHERE NOT active), 'anon: no inactive product');
SELECT public.t_assert(NOT EXISTS (SELECT 1 FROM public.products WHERE company_id = '00000000-0000-0000-0000-000000000002'), 'anon: nothing from the inactive company');
SELECT public.t_assert((SELECT count(*) FROM public.categories) = 2, 'anon: only categories of the active company');
SELECT public.t_assert((SELECT count(*) FROM public.companies) = 1, 'anon: only active companies (unchanged)');
SELECT public.t_assert((SELECT count(*) FROM public.products WHERE active AND company_id = '00000000-0000-0000-0000-000000000001') = 2, 'anon: menu query of the app unchanged');
ROLLBACK;

-- an inactive category of an active company is hidden to anon too
BEGIN;
UPDATE public.categories SET active = false WHERE id = '00000000-0000-0000-0000-0000000000a2';
SELECT public.t_as('anon', NULL);
SELECT public.t_assert((SELECT count(*) FROM public.categories) = 1, 'anon: inactive category hidden');
ROLLBACK;

-- logged in: unchanged
BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000d1');
SELECT public.t_assert((SELECT count(*) FROM public.products WHERE company_id = '00000000-0000-0000-0000-000000000001') = 3, 'admin still sees own inactive products');
SELECT public.t_assert((SELECT count(*) FROM public.products) = 3, 'admin: nothing from the inactive company');
ROLLBACK;
BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000d2');
SELECT public.t_assert((SELECT count(*) FROM public.products) = 3, 'customer: same rows as before (old products in order history)');
SELECT public.t_assert((SELECT count(*) FROM public.categories) = 2, 'customer: categories unchanged');
ROLLBACK;
BEGIN;  -- anonymous Supabase session (signInAnonymously): has a uid, treated as logged in (unchanged)
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000ff","is_anonymous":true}', true);
SET LOCAL ROLE authenticated;
SELECT public.t_assert((SELECT count(*) FROM public.products WHERE active AND company_id = '00000000-0000-0000-0000-000000000001') = 2, 'anonymous session sees the menu');
ROLLBACK;

-- policy shape: auth.uid() / get_my_company_id() wrapped (no auth_rls_initplan warning)
SELECT public.t_assert(
  (SELECT bool_and(qual LIKE '%( SELECT auth.uid() AS uid)%' AND qual NOT LIKE '%= auth.uid()%' AND qual LIKE '%active%')
   FROM pg_policies WHERE tablename IN ('products', 'categories') AND policyname IN ('products_select', 'categories_select')),
  'select policies keep (select auth.uid()) and filter active');
SELECT 'menu-anon-active OK' AS status;
