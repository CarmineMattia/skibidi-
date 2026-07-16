-- ============================================
-- SKIBIDI ORDERS — Reset password utenti test
-- Esegui in Supabase → SQL Editor
-- ============================================
-- Nota: @skibidi.com non sono caselle reali.
-- Usa login con password nell'app, non recovery email.
-- ============================================

-- Abilita pgcrypto (di solito già attivo su Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── 1) Reset password auth.users ──────────────────────────────

UPDATE auth.users
SET
  encrypted_password = extensions.crypt('Admin123!', extensions.gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email = 'admin@skibidi.com';

UPDATE auth.users
SET
  encrypted_password = extensions.crypt('Customer123!', extensions.gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email = 'customer@skibidi.com';

-- ── 2) Allinea profili ────────────────────────────────────────

INSERT INTO public.profiles (id, email, full_name, role)
SELECT u.id, u.email, 'Super Admin', 'admin'::public.user_role
FROM auth.users u
WHERE u.email = 'admin@skibidi.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  full_name = 'Super Admin',
  updated_at = NOW();

INSERT INTO public.profiles (id, email, full_name, role)
SELECT u.id, u.email, 'Test Customer', 'customer'::public.user_role
FROM auth.users u
WHERE u.email = 'customer@skibidi.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'customer',
  full_name = 'Test Customer',
  updated_at = NOW();

-- ── 3) Verifica finale ────────────────────────────────────────

SELECT
  u.email,
  u.email_confirmed_at IS NOT NULL AS auth_ok,
  p.role,
  p.full_name,
  CASE
    WHEN u.email_confirmed_at IS NULL THEN '❌ Email non confermata'
    WHEN p.role IS NULL THEN '❌ Profilo mancante'
    ELSE '✅ Pronto per login password'
  END AS esito
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email IN ('admin@skibidi.com', 'customer@skibidi.com')
ORDER BY u.email;
