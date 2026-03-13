-- ============================================
-- VERIFY ADMIN USER EXISTS
-- ============================================
-- Run this in Supabase SQL Editor to check if admin exists
-- ============================================

-- Check if admin user exists in auth.users
SELECT '=== CHECKING AUTH USERS ===' as info;
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'admin@skibidi.com';

-- Check if admin profile exists
SELECT '=== CHECKING PROFILES ===' as info;
SELECT 
  id,
  email,
  role,
  full_name,
  created_at
FROM profiles
WHERE email = 'admin@skibidi.com' OR role = 'admin';

-- Show all users with roles
SELECT '=== ALL USERS WITH ROLES ===' as info;
SELECT 
  u.email,
  u.email_confirmed_at,
  p.role,
  p.full_name
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY u.created_at DESC;

-- Count total users
SELECT '=== TOTAL COUNTS ===' as info;
SELECT 
  (SELECT COUNT(*) FROM auth.users) as total_auth_users,
  (SELECT COUNT(*) FROM profiles) as total_profiles,
  (SELECT COUNT(*) FROM profiles WHERE role = 'admin') as admin_count;

-- ============================================
-- TO CREATE ADMIN USER:
-- ============================================
-- You MUST create via Auth Dashboard (not SQL):
-- 1. Go to: https://supabase.com/dashboard/project/zqubwvhstobaugifzoyb/auth/users
-- 2. Click "Add user" → "Create new user"
-- 3. Email: admin@skibidi.com
-- 4. Password: Admin123!
-- 5. ✓ CHECK "Auto Confirm User"
-- 6. User Metadata: {"full_name":"Admin User","role":"admin"}
-- 7. Click "Create user"
-- ============================================
