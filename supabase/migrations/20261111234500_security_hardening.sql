-- Security hardening (migration file only: NOT applied to production).
-- Apply on prod only with Carmine's explicit OK. Do not run this against
-- the live project from a laptop script.
--
-- 1. products bucket: authenticated users can no longer insert/update/delete
--    objects. Writes and listing are staff (is_admin()) only. The bucket stays
--    public so a known object URL still loads; there is no broad SELECT policy
--    for anon or for customers. MIME types are image/jpeg, image/png, image/webp
--    and the size cap is 5 MB.
-- 2. Table privileges RLS does not need are revoked from anon/authenticated
--    (order_daily_counters and any other public table with no policy for that
--    command). MAINTAIN, TRUNCATE, TRIGGER and REFERENCES go too. Nothing is
--    granted back except the narrowed profile columns below.
-- 3. get_order_tracking returns only the status fields the tracking screen
--    needs, and only to the order's customer (including an anonymous session
--    that owns it) or to staff of that company. The full row moves to
--    order_submission_snapshot, which create_order_with_items keeps using and
--    which clients cannot execute.
-- 4. handle_new_user ignores role and company_id in raw_user_meta_data.
--    New profiles are customers of the server-side default company.
-- 5. Authenticated users cannot insert or update profiles.role / company_id.
--    The existing privilege trigger stays as a second line if those column
--    grants are ever restored. The SQL editor (not anon/authenticated) can
--    still promote a profile.

-- ---------------------------------------------------------------------------
-- 1. Storage: products bucket
-- ---------------------------------------------------------------------------

DO $storage$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE '20261111234500: schema storage assente, salto bucket e policy';
    RETURN;
  END IF;

  EXECUTE $q$
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'products',
      'products',
      true,
      5242880,
      ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types
  $q$;

  -- storage.objects is owned by supabase_storage_admin on hosted Supabase.
  -- Migrations run as postgres, which can insert bucket rows and manage
  -- policies, but cannot change ownership or row-level-security flags.
  -- RLS is already enabled in production. A database that left it off gets
  -- a warning; this block never issues owner-only DDL.
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND c.relrowsecurity IS NOT TRUE
  ) THEN
    RAISE WARNING '20261111234500: storage.objects.relrowsecurity is false; skipped enabling row level security because postgres does not own that table on hosted Supabase';
  END IF;
END
$storage$;

DO $storage_policies$
DECLARE
  r record;
  expr text;
  legacy_name text;
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RETURN;
  END IF;

  -- Named policies shipped by earlier scripts. Dropped even if the expression
  -- match below misses a quoting difference. One statement per EXECUTE.
  FOREACH legacy_name IN ARRAY ARRAY[
    'Public Access for Product Images',
    'Authenticated users can upload product images',
    'Authenticated users can update product images',
    'Authenticated users can delete product images',
    'Public Access',
    'Allow Uploads',
    'Allow Updates',
    'Allow Deletes',
    'products_images_staff_insert',
    'products_images_staff_update',
    'products_images_staff_delete',
    'products_images_staff_select'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', legacy_name);
  END LOOP;

  FOR r IN
    SELECT pol.polname,
           pg_get_expr(pol.polqual, pol.polrelid) AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
  LOOP
    expr := coalesce(r.qual, '') || ' ' || coalesce(r.chk, '');
    -- Any products policy that does not call is_admin() is the old broad read
    -- or the old "any authenticated user can write" rule.
    IF expr ILIKE '%products%' AND expr NOT ILIKE '%is_admin%' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.polname);
    END IF;
  END LOOP;

  EXECUTE $q$
    CREATE POLICY products_images_staff_insert
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'products' AND coalesce(public.is_admin(), false))
  $q$;
  EXECUTE $q$
    CREATE POLICY products_images_staff_update
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'products' AND coalesce(public.is_admin(), false))
    WITH CHECK (bucket_id = 'products' AND coalesce(public.is_admin(), false))
  $q$;
  EXECUTE $q$
    CREATE POLICY products_images_staff_delete
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'products' AND coalesce(public.is_admin(), false))
  $q$;
  -- Admins can list. Anon and customers have no SELECT policy: a public bucket
  -- still serves a known object URL, and listing the bucket does not.
  EXECUTE $q$
    CREATE POLICY products_images_staff_select
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'products' AND coalesce(public.is_admin(), false))
  $q$;
END
$storage_policies$;

-- ---------------------------------------------------------------------------
-- 2. Privileges RLS does not need
-- ---------------------------------------------------------------------------

DO $revoke$
DECLARE
  rel record;
  role_name text;
  cmd record;
  applies boolean;
BEGIN
  FOR rel IN
    SELECT c.oid, format('%I.%I', n.nspname, c.relname) AS qualname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    FOR cmd IN
      SELECT * FROM (VALUES
        ('SELECT', 'r'::"char"),
        ('INSERT', 'a'::"char"),
        ('UPDATE', 'w'::"char"),
        ('DELETE', 'd'::"char")
      ) AS v(name, code)
    LOOP
      SELECT EXISTS (
        SELECT 1 FROM pg_policy p
        WHERE p.polrelid = rel.oid
          AND (p.polcmd = cmd.code OR p.polcmd = '*')
          AND (
            cardinality(coalesce(p.polroles, ARRAY[]::oid[])) = 0
            OR 0::oid = ANY (coalesce(p.polroles, ARRAY[]::oid[]))
          )
      ) INTO applies;
      IF NOT applies THEN
        EXECUTE format('REVOKE %s ON TABLE %s FROM PUBLIC', cmd.name, rel.qualname);
      END IF;

      FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
          CONTINUE;
        END IF;
        SELECT EXISTS (
          SELECT 1 FROM pg_policy p
          WHERE p.polrelid = rel.oid
            AND (p.polcmd = cmd.code OR p.polcmd = '*')
            AND (
              cardinality(coalesce(p.polroles, ARRAY[]::oid[])) = 0
              OR 0::oid = ANY (coalesce(p.polroles, ARRAY[]::oid[]))
              OR EXISTS (
                SELECT 1 FROM pg_roles gr
                WHERE gr.oid = ANY (coalesce(p.polroles, ARRAY[]::oid[]))
                  AND gr.rolname = role_name
              )
            )
        ) INTO applies;
        IF NOT applies THEN
          EXECUTE format('REVOKE %s ON TABLE %s FROM %I', cmd.name, rel.qualname, role_name);
        END IF;
      END LOOP;
    END LOOP;

    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %s FROM PUBLIC', rel.qualname);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %s FROM anon', rel.qualname);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %s FROM authenticated', rel.qualname);
    END IF;
    IF current_setting('server_version_num')::int >= 170000 THEN
      EXECUTE format('REVOKE MAINTAIN ON TABLE %s FROM PUBLIC', rel.qualname);
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE format('REVOKE MAINTAIN ON TABLE %s FROM anon', rel.qualname);
      END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE format('REVOKE MAINTAIN ON TABLE %s FROM authenticated', rel.qualname);
      END IF;
    END IF;
  END LOOP;
END
$revoke$;

-- Profiles: table-level UPDATE/INSERT would still cover role and company_id.
-- Leave contact fields writable by the signed-in user; role and company_id
-- are not. anon cannot write a profile. service_role / table owner unchanged.
DO $profile_cols$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE NOTICE '20261111234500: public.profiles assente, salto i grant di colonna';
    RETURN;
  END IF;
  EXECUTE 'REVOKE INSERT, UPDATE ON TABLE public.profiles FROM PUBLIC';
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE INSERT, UPDATE ON TABLE public.profiles FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE INSERT, UPDATE ON TABLE public.profiles FROM authenticated';
    EXECUTE 'GRANT UPDATE (email, full_name, phone, address) ON TABLE public.profiles TO authenticated';
    EXECUTE 'GRANT INSERT (id, email, full_name, phone, address) ON TABLE public.profiles TO authenticated';
  END IF;
END
$profile_cols$;

-- Same trigger as 20260715120000, kept here so a database that lost it still
-- refuses a JWT session that changes role or company_id. Sessions that are
-- not anon/authenticated (SQL editor, migrations) stay exempt.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'customer'::public.user_role THEN
      RAISE EXCEPTION 'Cannot self-assign role %', NEW.role;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'Only an admin can change role or company_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- ---------------------------------------------------------------------------
-- 3. Order tracking: minimal payload, owner or staff
-- ---------------------------------------------------------------------------

-- The only active company, NULL when there are 0 or several. Same body as
-- 20261020170000 so this migration can call it even if that file was skipped.
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

-- Full row for create_order_with_items (SECURITY DEFINER). Not a client RPC.
CREATE OR REPLACE FUNCTION public.order_submission_snapshot(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(o.*) || jsonb_build_object(
    'order_items', COALESCE((
      SELECT jsonb_agg(to_jsonb(oi.*) || jsonb_build_object('product', to_jsonb(p.*)))
      FROM public.order_items oi
      LEFT JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM public.orders o
  WHERE o.id = p_order_id;
$$;

REVOKE ALL ON FUNCTION public.order_submission_snapshot(uuid) FROM PUBLIC;
DO $snap_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.order_submission_snapshot(uuid) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.order_submission_snapshot(uuid) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.order_submission_snapshot(uuid) FROM service_role;
  END IF;
END
$snap_grants$;

CREATE OR REPLACE FUNCTION public.get_order_tracking(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  -- anon has no uid. An anonymous Supabase session is role authenticated and
  -- has a uid: if that uid owns the order, tracking works.
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'accepted_at', o.accepted_at,
    'display_code', o.display_code,
    'order_type', o.order_type,
    'table_number', o.table_number,
    'decline_reason_preset', o.decline_reason_preset,
    'decline_reason_note', o.decline_reason_note,
    'declined_at', o.declined_at
  )
  INTO v
  FROM public.orders o
  WHERE o.id = p_order_id
    AND (
      o.customer_id = auth.uid()
      OR (
        coalesce(public.is_admin(), false)
        AND o.company_id IS NOT DISTINCT FROM public.get_my_company_id()
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'kiosk'::public.user_role
          AND p.company_id IS NOT DISTINCT FROM o.company_id
      )
    );
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_tracking(uuid) FROM PUBLIC;
DO $track_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.get_order_tracking(uuid) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.get_order_tracking(uuid) FROM authenticated;
    GRANT EXECUTE ON FUNCTION public.get_order_tracking(uuid) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.get_order_tracking(uuid) TO service_role;
  END IF;
END
$track_grants$;

-- Point the checkout function at the internal snapshot. The body is whatever
-- version is already installed; only the helper name changes. Clients still
-- receive the small checkout payload that function already returns.
DO $rewire$
DECLARE
  src text;
BEGIN
  IF to_regprocedure('public.create_order_with_items(jsonb, jsonb)') IS NULL THEN
    RAISE NOTICE '20261111234500: create_order_with_items assente, nessun rewire';
    RETURN;
  END IF;
  src := pg_get_functiondef('public.create_order_with_items(jsonb, jsonb)'::regprocedure);
  IF src NOT LIKE '%get_order_tracking%' THEN
    RAISE NOTICE '20261111234500: create_order_with_items già sullo snapshot';
    RETURN;
  END IF;
  src := replace(src, 'public.get_order_tracking', 'public.order_submission_snapshot');
  src := replace(src, 'get_order_tracking(', 'order_submission_snapshot(');
  EXECUTE src;
END
$rewire$;

-- ---------------------------------------------------------------------------
-- 4. Signup: never trust role or company_id from user metadata
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'customer'::public.user_role,
    public.default_customer_company_id()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = coalesce(EXCLUDED.full_name, public.profiles.full_name);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
