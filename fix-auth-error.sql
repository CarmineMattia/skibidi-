-- ============================================
-- FIX AUTH 500 ERROR (RLS RECURSION)
-- ============================================

-- 1. Create a secure function to check admin status
-- This function runs with "SECURITY DEFINER" privileges, bypassing RLS
-- This prevents the infinite loop when policies query the profiles table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop ALL existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can do everything on profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- 3. Re-create Profiles Policies (Safe Version)

-- Everyone can read profiles (needed for login/checks)
CREATE POLICY "Everyone can read profiles" ON profiles
    FOR SELECT USING (true);

-- Users can insert their own profile (for registration)
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Admins can do everything (using the safe function)
CREATE POLICY "Admins can update any profile" ON profiles
    FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can delete any profile" ON profiles
    FOR DELETE USING (is_admin());

-- ============================================
-- FIX OTHER TABLES (Just in case)
-- ============================================

-- Categories
DROP POLICY IF EXISTS "Admins can insert categories" ON categories;
DROP POLICY IF EXISTS "Admins can update categories" ON categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;

CREATE POLICY "Admins can insert categories" ON categories
    FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update categories" ON categories
    FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can delete categories" ON categories
    FOR DELETE USING (is_admin());

-- Products
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;

CREATE POLICY "Admins can insert products" ON products
    FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update products" ON products
    FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can delete products" ON products
    FOR DELETE USING (is_admin());

-- Orders
DROP POLICY IF EXISTS "Admins can update any order" ON orders;
DROP POLICY IF EXISTS "Kiosks can update orders" ON orders;

CREATE POLICY "Admins can update any order" ON orders
    FOR UPDATE USING (is_admin());

-- Kiosk/Customer update policy (simplified)
CREATE POLICY "Users can update own orders" ON orders
    FOR UPDATE USING (auth.uid() = customer_id);
