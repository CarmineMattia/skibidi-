-- ============================================
-- FIX MISSING PROFILES AND ROLES
-- ============================================

-- 1. Create a Trigger to automatically create a profile for new users
-- This ensures that users created via Supabase Dashboard or Sign Up flow always have a profile

-- Non leggere role né company_id dai metadata: chi si iscrive non sceglie il ruolo.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, company_id)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    'customer'::public.user_role,
    public.default_customer_company_id()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  RETURN new;
END;
$$;

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
  raw_user_meta_data->>'full_name',
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
