-- ============================================
-- CREATE SUPER ADMIN USER
-- ============================================
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/zqubwvhstobaugifzoyb/sql/new
-- ============================================

-- Step 1: Check if admin user already exists
SELECT '=== CHECKING EXISTING ADMINS ===' as info;
SELECT 
  u.id,
  u.email,
  u.created_at,
  p.role,
  p.full_name
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email LIKE '%admin%' OR p.role = 'admin';

-- Step 2: If admin doesn't exist, we need to create via Auth API
-- SQL cannot directly insert into auth.users for security reasons

-- Step 3: Instead, verify the admin profile exists
SELECT '=== CHECKING PROFILES ===' as info;
SELECT id, email, role, full_name, created_at
FROM profiles
WHERE role = 'admin' OR email = 'admin@skibidi.com';

-- Step 4: If profile exists but user doesn't, here's what to do:
-- 
-- MANUAL STEPS (required for security):
-- 1. Go to: https://supabase.com/dashboard/project/zqubwvhstobaugifzoyb/auth/users
-- 2. Click "Add user" → "Create new user"
-- 3. Fill in:
--    - Email: admin@skibidi.com
--    - Password: Admin123!
--    - ✓ Auto Confirm User (IMPORTANT!)
--    - User Metadata: {"full_name":"Admin User","role":"admin"}
-- 4. Click "Create user"
--
-- Step 5: After creating user, verify it worked
SELECT '=== NEXT STEPS ===' as info;
SELECT '1. Create user via Auth Dashboard (see instructions above)' as step;
SELECT '2. Make sure "Auto Confirm User" is CHECKED' as step;
SELECT '3. Set role to "admin" in User Metadata' as step;
SELECT '4. Come back here and test login with:' as step;
SELECT '   Email: admin@skibidi.com' as step;
SELECT '   Password: Admin123!' as step;

-- Step 6: Verify all users with admin role
SELECT '=== ALL ADMINS ===' as info;
SELECT 
  u.email,
  p.role,
  p.full_name,
  u.created_at
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE p.role = 'admin'
ORDER BY u.created_at DESC;
