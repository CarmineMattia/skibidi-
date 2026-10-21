-- Customers without a company see an empty menu (migration only in the PR;
-- apply to prod only with Carmine's OK).
--
-- Live today (read-only check, 20/10):
--   * products_select / categories_select (roles public):
--       USING (auth.uid() IS NULL OR company_id = get_my_company_id())
--     so anon reads the menu, but a logged-in user reads only the rows of
--     profiles.company_id. With company_id NULL the menu is empty.
--   * handle_new_user() sets profiles.company_id from
--     raw_user_meta_data->>'company_id'. Neither the app's signup nor a
--     Google login sends it, so every new self-signup / Google customer gets
--     company_id NULL (2 live customer profiles today, email signups of 30/03).
--   * trg_prevent_profile_privilege_escalation forbids customers to change
--     their company_id, so those users stay stuck on an empty menu.
--
-- Fix (defence in depth, both sides):
--   1) the menu is public for active companies: any session (anon or
--      authenticated, with or without a company) reads products / categories
--      of active companies, as anon already does and as menu_pricing does.
--      Writes are unchanged (admins of their company only). auth.uid() /
--      get_my_company_id() are wrapped in (select …) so they run once per query.
--   2) new customer profiles get a company: if the one supplied (signup
--      metadata or client insert) is not an active company, the only active
--      company is used; with 0 or 2+ active companies nothing is guessed
--      (company_id stays as given / NULL, and 1) still shows the menu).
--   3) backfill: customer profiles with company_id NULL get the only active
--      company (no-op when there are 0 or 2+ active companies).
-- Idempotent.

-- 1) Public menu of active companies -------------------------------------------
DROP POLICY IF EXISTS products_select ON public.products;
CREATE POLICY products_select ON public.products
  FOR SELECT
  USING (
    ((SELECT auth.uid()) IS NULL)
    OR (company_id = (SELECT public.get_my_company_id()))
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = products.company_id AND c.active)
  );

DROP POLICY IF EXISTS categories_select ON public.categories;
CREATE POLICY categories_select ON public.categories
  FOR SELECT
  USING (
    ((SELECT auth.uid()) IS NULL)
    OR (company_id = (SELECT public.get_my_company_id()))
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = categories.company_id AND c.active)
  );

-- 2) Default company for new customer profiles ---------------------------------
-- The only active company, NULL when there are 0 or several.
CREATE OR REPLACE FUNCTION public.default_customer_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN count(*) = 1 THEN (array_agg(c.id))[1] END
  FROM public.companies c
  WHERE c.active;
$$;
REVOKE ALL ON FUNCTION public.default_customer_company_id() FROM PUBLIC, anon, authenticated;

-- BEFORE INSERT on profiles: covers handle_new_user (signup / Google) and the
-- client's self-healing insert (lib/stores/AuthContext.tsx).
CREATE OR REPLACE FUNCTION public.profiles_assign_default_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS NOT DISTINCT FROM 'customer'::public.user_role
     AND (NEW.company_id IS NULL
          OR NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = NEW.company_id AND c.active)) THEN
    NEW.company_id := coalesce(public.default_customer_company_id(), NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.profiles_assign_default_company() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_assign_default_company ON public.profiles;
CREATE TRIGGER trg_profiles_assign_default_company
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_assign_default_company();

-- 3) Backfill ------------------------------------------------------------------
UPDATE public.profiles p
SET company_id = public.default_customer_company_id()
WHERE p.company_id IS NULL
  AND p.role = 'customer'::public.user_role
  AND public.default_customer_company_id() IS NOT NULL;
