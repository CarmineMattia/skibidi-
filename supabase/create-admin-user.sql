-- ============================================
-- CREATE SUPER ADMIN USER
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Create the user in auth.users
-- Note: Supabase handles password hashing automatically

-- First, let's check if user already exists
SELECT '=== CHECKING EXISTING USERS ===' as info;
SELECT email, created_at, raw_app_meta_data->>'role' as role 
FROM auth.users 
WHERE email LIKE '%@skibidi.com';

-- Step 2: If users don't exist, we need to create them via Auth UI
-- SQL cannot directly insert into auth.users (security)

-- Step 3: Instead, let's UPDATE the profiles table
-- to ensure roles are correct for existing users

SELECT '=== UPDATING PROFILES ===' as info;

-- Update admin profile (if exists)
UPDATE profiles 
SET role = 'admin',
    full_name = 'Admin User',
    updated_at = NOW()
WHERE email = 'admin@skibidi.com';

-- Update staff profile
UPDATE profiles 
SET role = 'staff',
    full_name = 'Staff Member',
    updated_at = NOW()
WHERE email = 'staff@skibidi.com';

-- Update customer profile
UPDATE profiles 
SET role = 'customer',
    full_name = 'Test Customer',
    updated_at = NOW()
WHERE email = 'customer@skibidi.com';

-- Step 4: Verify profiles
SELECT '=== PROFILES UPDATED ===' as info;
SELECT id, email, role, full_name, created_at 
FROM profiles 
WHERE email IN ('admin@skibidi.com', 'staff@skibidi.com', 'customer@skibidi.com')
ORDER BY role;

-- Step 5: Check RLS on profiles
SELECT '=== PROFILE POLICIES ===' as info;
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY policyname;

-- ============================================
-- IMPORTANT: CREATE USERS VIA DASHBOARD
-- ============================================
-- Since we can't create auth users via SQL,
-- please create them manually:
--
-- 1. Go to: https://supabase.com/dashboard/project/zqubwvhstobaugifzoyb/auth/users
-- 2. Click "Add user" → "Create new user"
-- 3. Create these 3 users:
--
--    Email: admin@skibidi.com
--    Password: Admin123!
--    ✓ Auto Confirm User (IMPORTANT!)
--    User Metadata: {"role":"admin","full_name":"Admin User"}
--
--    Email: staff@skibidi.com
--    Password: Staff123!
--    ✓ Auto Confirm User
--    User Metadata: {"role":"staff","full_name":"Staff Member"}
--
--    Email: customer@skibidi.com
--    Password: Customer123!
--    ✓ Auto Confirm User
--    User Metadata: {"role":"customer","full_name":"Test Customer"}
--
-- 4. After creating, come back and test login!
-- ============================================

SELECT '=== NEXT STEPS ===' as info;
SELECT '1. Create users via Auth Dashboard (see instructions above)' as step;
SELECT '2. Make sure "Auto Confirm User" is checked' as step;
SELECT '3. Test login in app with admin@skibidi.com / Admin123!' as step;
