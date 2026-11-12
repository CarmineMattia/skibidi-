-- ============================================
-- FIX MISSING PROFILES AND ROLES
-- ============================================

-- 1. Create a Trigger to automatically create a profile for new users
-- This ensures that users created via Supabase Dashboard or Sign Up flow always have a profile

-- Stesso corpo di 20261112003000_company_storage_and_orders_anon.sql.
-- Non leggere role né company_id dai metadata. Il nome Google sta in `name`
-- quando manca full_name. L'avatar si copia solo se la colonna esiste.
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

-- Drop the trigger if it exists to clean up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill missing profiles for existing users
-- This fixes the issue for users who already exist but have no profile (appear as "Ospite")

INSERT INTO public.profiles (id, email, full_name, role, company_id)
SELECT
  id,
  email,
  coalesce(nullif(btrim(raw_user_meta_data->>'full_name'), ''), nullif(btrim(raw_user_meta_data->>'name'), '')),
  'customer'::public.user_role,
  public.default_customer_company_id()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 3. Ensure Admin users have the correct role in profiles
-- Explicitly set admin role for known admin emails if they exist

UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@skibidi.com';

UPDATE public.profiles
SET role = 'admin'
WHERE email = 'cassiere@skibidi.com';

-- 4. Verify the fix
SELECT p.id, p.email, p.role, p.full_name
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'admin@skibidi.com';
