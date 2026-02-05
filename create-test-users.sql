-- Create Test Users for Skibidi Orders
-- IMPORTANT: Run this in Supabase SQL Editor with service_role access
-- This script creates test users in both auth.users and profiles tables

-- Note: Passwords are hashed using bcrypt
-- All test users have password: "password123"
-- Hashed with bcrypt rounds=10: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

-- ========================================
-- ADMIN USER
-- ========================================
-- Email: admin@skibidi.com
-- Password: password123
-- Role: admin

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@skibidi.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin Principale","role":"admin"}',
  now(),
  now(),
  'authenticated',
  'authenticated'
) ON CONFLICT (email) DO NOTHING;

-- Insert profile (will be auto-created by trigger, but adding for safety)
INSERT INTO profiles (id, email, full_name, role)
SELECT id, email, 'Admin Principale', 'admin'
FROM auth.users
WHERE email = 'admin@skibidi.com'
ON CONFLICT (id) DO UPDATE
SET full_name = 'Admin Principale', role = 'admin';

-- ========================================
-- CASHIER USER (Additional Admin)
-- ========================================
-- Email: cassiere@skibidi.com
-- Password: password123
-- Role: admin

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'cassiere@skibidi.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Mario Rossi","role":"admin"}',
  now(),
  now(),
  'authenticated',
  'authenticated'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, email, full_name, role)
SELECT id, email, 'Mario Rossi', 'admin'
FROM auth.users
WHERE email = 'cassiere@skibidi.com'
ON CONFLICT (id) DO UPDATE
SET full_name = 'Mario Rossi', role = 'admin';

-- ========================================
-- CUSTOMER USERS
-- ========================================

-- Customer 1
-- Email: cliente1@skibidi.com
-- Password: password123
-- Role: customer

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'cliente1@skibidi.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Luigi Bianchi","role":"customer"}',
  now(),
  now(),
  'authenticated',
  'authenticated'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, email, full_name, role)
SELECT id, email, 'Luigi Bianchi', 'customer'
FROM auth.users
WHERE email = 'cliente1@skibidi.com'
ON CONFLICT (id) DO UPDATE
SET full_name = 'Luigi Bianchi', role = 'customer';

-- Customer 2
-- Email: cliente2@skibidi.com
-- Password: password123
-- Role: customer

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'cliente2@skibidi.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Giuseppe Verdi","role":"customer"}',
  now(),
  now(),
  'authenticated',
  'authenticated'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, email, full_name, role)
SELECT id, email, 'Giuseppe Verdi', 'customer'
FROM auth.users
WHERE email = 'cliente2@skibidi.com'
ON CONFLICT (id) DO UPDATE
SET full_name = 'Giuseppe Verdi', role = 'customer';

-- Customer 3
-- Email: cliente3@skibidi.com
-- Password: password123
-- Role: customer

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'cliente3@skibidi.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Anna Ferrari","role":"customer"}',
  now(),
  now(),
  'authenticated',
  'authenticated'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, email, full_name, role)
SELECT id, email, 'Anna Ferrari', 'customer'
FROM auth.users
WHERE email = 'cliente3@skibidi.com'
ON CONFLICT (id) DO UPDATE
SET full_name = 'Anna Ferrari', role = 'customer';

-- ========================================
-- VERIFICATION
-- ========================================

-- Check created users
SELECT
  u.email,
  u.email_confirmed_at,
  p.full_name,
  p.role,
  p.created_at
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email LIKE '%@skibidi.com'
ORDER BY p.role DESC, u.email;

-- Summary
DO $$
DECLARE
  admin_count INT;
  customer_count INT;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM profiles WHERE role = 'admin';
  SELECT COUNT(*) INTO customer_count FROM profiles WHERE role = 'customer';

  RAISE NOTICE 'Test users created successfully!';
  RAISE NOTICE 'Admins: %', admin_count;
  RAISE NOTICE 'Customers: %', customer_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Login credentials:';
  RAISE NOTICE '  Admin: admin@skibidi.com / password123';
  RAISE NOTICE '  Cashier: cassiere@skibidi.com / password123';
  RAISE NOTICE '  Customer 1: cliente1@skibidi.com / password123';
  RAISE NOTICE '  Customer 2: cliente2@skibidi.com / password123';
  RAISE NOTICE '  Customer 3: cliente3@skibidi.com / password123';
END $$;
