-- Follow-up to 20261111234500. File only: not applied to production.
--
-- 1. products bucket writes: is_admin() and the first path segment must be
--    the caller's company id ({company_id}/...). Names with '..', a
--    backslash, a leading slash or an empty segment ('//') are rejected, so
--    a key like {company}/../other/x.jpg cannot slip through if the host
--    normalizes the path. Flat keys such as margherita.jpg stay readable:
--    the bucket stays public, and the staff SELECT policy is not limited to
--    the company prefix, so existing public URLs and admin listing of old
--    objects keep working.
-- 2. orders / order_items: every policy that still applied to PUBLIC or anon
--    is pinned to authenticated. anon (and PUBLIC) lose every table privilege.
--    Authenticated keeps the commands its policies use. order_items stays
--    without UPDATE/DELETE for the client.
-- 3. handle_new_user copies the Google display name (name when full_name is
--    empty) and avatar_url/picture when a profile column for it exists.
--    role and company_id still never come from metadata.

-- ---------------------------------------------------------------------------
-- 1. Storage writes are per company
-- ---------------------------------------------------------------------------

DO $company_storage$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE '20261112003000: schema storage assente, salto le policy di scrittura';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS products_images_staff_insert ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS products_images_staff_update ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS products_images_staff_delete ON storage.objects';

  -- split_part is the first folder. storage.foldername is not required.
  -- The regex rejects traversal even when the first segment is the company.
  EXECUTE $q$
    CREATE POLICY products_images_staff_insert
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'products'
      AND coalesce(public.is_admin(), false)
      AND split_part(name, '/', 1) = public.get_my_company_id()::text
      AND name !~ '(\.\.|\\|^/|//)'
    )
  $q$;
  EXECUTE $q$
    CREATE POLICY products_images_staff_update
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'products'
      AND coalesce(public.is_admin(), false)
      AND split_part(name, '/', 1) = public.get_my_company_id()::text
      AND name !~ '(\.\.|\\|^/|//)'
    )
    WITH CHECK (
      bucket_id = 'products'
      AND coalesce(public.is_admin(), false)
      AND split_part(name, '/', 1) = public.get_my_company_id()::text
      AND name !~ '(\.\.|\\|^/|//)'
    )
  $q$;
  EXECUTE $q$
    CREATE POLICY products_images_staff_delete
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'products'
      AND coalesce(public.is_admin(), false)
      AND split_part(name, '/', 1) = public.get_my_company_id()::text
      AND name !~ '(\.\.|\\|^/|//)'
    )
  $q$;
END
$company_storage$;

-- ---------------------------------------------------------------------------
-- 2. orders: no anon privileges, policies explicitly TO authenticated
-- ---------------------------------------------------------------------------

DO $orders_roles$
DECLARE
  rec record;
BEGIN
  IF to_regclass('public.orders') IS NULL THEN
    RAISE NOTICE '20261112003000: public.orders assente, salto i grant';
    RETURN;
  END IF;

  FOR rec IN
    SELECT c.relname, pol.polname
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('orders', 'order_items')
      AND (
        coalesce(cardinality(pol.polroles), 0) = 0
        OR 0::oid = ANY (coalesce(pol.polroles, ARRAY[]::oid[]))
        OR EXISTS (
          SELECT 1 FROM pg_roles r
          WHERE r.rolname = 'anon' AND r.oid = ANY (coalesce(pol.polroles, ARRAY[]::oid[]))
        )
      )
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', rec.polname, rec.relname);
  END LOOP;

  EXECUTE 'REVOKE ALL ON TABLE public.orders FROM PUBLIC';
  IF to_regclass('public.order_items') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.order_items FROM PUBLIC';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.orders FROM anon';
    IF to_regclass('public.order_items') IS NOT NULL THEN
      EXECUTE 'REVOKE ALL ON TABLE public.order_items FROM anon';
    END IF;
  END IF;

  -- Direct grants. PUBLIC no longer carries them, and anon must not get them back.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO authenticated';
    IF to_regclass('public.order_items') IS NOT NULL THEN
      EXECUTE 'GRANT SELECT, INSERT ON TABLE public.order_items TO authenticated';
    END IF;
  END IF;

  -- 20260210152600 left staff SELECT/UPDATE on every company's orders.
  -- Customers still see and update only their own rows. Staff (admin and
  -- kiosk, which is the kitchen/cassa role) only their company. Insert
  -- policies are left as they are so a logged-in customer can still create
  -- an order; checkout RPCs are SECURITY DEFINER and do not use these policies.
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own orders" ON public.orders';
  EXECUTE $q$
    CREATE POLICY "Users can view own orders" ON public.orders
      FOR SELECT TO authenticated
      USING (
        customer_id = auth.uid()
        OR (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'kiosk')
          )
          AND company_id IS NOT DISTINCT FROM public.get_my_company_id()
        )
      )
  $q$;
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own orders" ON public.orders';
  EXECUTE $q$
    CREATE POLICY "Users can update own orders" ON public.orders
      FOR UPDATE TO authenticated
      USING (
        customer_id = auth.uid()
        OR (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'kiosk')
          )
          AND company_id IS NOT DISTINCT FROM public.get_my_company_id()
        )
      )
      WITH CHECK (
        customer_id = auth.uid()
        OR (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'kiosk')
          )
          AND company_id IS NOT DISTINCT FROM public.get_my_company_id()
        )
      )
  $q$;
  IF to_regclass('public.order_items') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view order items" ON public.order_items';
    EXECUTE $q$
      CREATE POLICY "Users can view order items" ON public.order_items
        FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
              AND (
                o.customer_id = auth.uid()
                OR (
                  EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid() AND p.role IN ('admin', 'kiosk')
                  )
                  AND o.company_id IS NOT DISTINCT FROM public.get_my_company_id()
                )
              )
          )
        )
    $q$;
  END IF;
END
$orders_roles$;

-- ---------------------------------------------------------------------------
-- 3. Signup name (and avatar only when the column exists)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_name text;
  v_avatar text;
  v_avatar_column text;
BEGIN
  -- Google puts the display name in `name`. full_name wins when both are set.
  -- role and company_id are never read from metadata.
  v_name := coalesce(
    nullif(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(NEW.raw_user_meta_data->>'name'), '')
  );
  v_avatar := coalesce(
    nullif(btrim(NEW.raw_user_meta_data->>'avatar_url'), ''),
    nullif(btrim(NEW.raw_user_meta_data->>'picture'), '')
  );

  SELECT c.column_name INTO v_avatar_column
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'profiles'
    AND c.column_name IN ('avatar_url', 'avatar', 'picture')
  ORDER BY CASE c.column_name WHEN 'avatar_url' THEN 1 WHEN 'avatar' THEN 2 ELSE 3 END
  LIMIT 1;

  IF v_avatar_column IS NULL THEN
    INSERT INTO public.profiles (id, email, full_name, role, company_id)
    VALUES (
      NEW.id,
      NEW.email,
      v_name,
      'customer'::public.user_role,
      public.default_customer_company_id()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = coalesce(EXCLUDED.full_name, public.profiles.full_name);
  ELSE
    EXECUTE format(
      'INSERT INTO public.profiles (id, email, full_name, role, company_id, %I)
       VALUES ($1, $2, $3, ''customer''::public.user_role, public.default_customer_company_id(), $4)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         full_name = coalesce(EXCLUDED.full_name, public.profiles.full_name),
         %I = coalesce(EXCLUDED.%I, public.profiles.%I)',
      v_avatar_column, v_avatar_column, v_avatar_column, v_avatar_column
    )
    USING NEW.id, NEW.email, v_name, v_avatar;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
