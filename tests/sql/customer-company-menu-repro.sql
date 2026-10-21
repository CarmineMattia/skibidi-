-- Repro BEFORE the fix (live state): a customer whose profile has company_id NULL
-- (self-signup, Google login: no company in the signup metadata) reads an empty
-- menu, while anon and a customer with the company see it.
BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000e1');
SELECT public.t_assert((SELECT count(*) FROM public.products) = 0, 'repro: NULL-company customer sees no products');
SELECT public.t_assert((SELECT count(*) FROM public.categories) = 0, 'repro: NULL-company customer sees no categories');
SELECT public.t_assert((SELECT count(*) FROM public.menu_pricing) = 1, 'repro: menu_pricing is public');
ROLLBACK;
BEGIN;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000d2');
SELECT public.t_assert((SELECT count(*) FROM public.products WHERE active) = 2, 'repro: customer with company sees the menu');
ROLLBACK;
BEGIN;
SELECT public.t_as('anon', NULL);
SELECT public.t_assert((SELECT count(*) FROM public.products WHERE active AND company_id = '00000000-0000-0000-0000-000000000001') = 2, 'repro: anon sees the menu');
ROLLBACK;
-- a new signup without company metadata (what a Google login sends) gets NULL too
INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
VALUES ('00000000-0000-0000-0000-0000000000f9', 'google@example.test', '{"full_name":"G","email_verified":true}', '{"provider":"google"}');
SELECT public.t_assert((SELECT company_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000f9') IS NULL,
  'repro: Google signup gets company_id NULL');
-- and the customer cannot fix it (company_id is admin-only)
DO $$ BEGIN
  BEGIN
    PERFORM public.t_as('authenticated', '00000000-0000-0000-0000-0000000000e1');
    UPDATE public.profiles SET company_id = '00000000-0000-0000-0000-000000000001' WHERE id = '00000000-0000-0000-0000-0000000000e1';
    RAISE EXCEPTION 'ASSERT FAILED: customer changed own company_id';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASSERT FAILED%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
SELECT 'repro ok: NULL-company customer sees an empty menu' AS status;
