-- ============================================
-- QUICK FIX - Development Mode (Temporary)
-- ============================================
-- This makes the database accessible for development
-- WARNING: Only use in development, not production!

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can do everything on profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

DROP POLICY IF EXISTS "Anyone can view active categories" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON categories;
DROP POLICY IF EXISTS "Admins can update categories" ON categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;

DROP POLICY IF EXISTS "Anyone can view active products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;

DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON orders;
DROP POLICY IF EXISTS "Admins and kiosks can update orders" ON orders;
DROP POLICY IF EXISTS "Admins can update any order" ON orders;
DROP POLICY IF EXISTS "Kiosks can update orders" ON orders;

DROP POLICY IF EXISTS "Users can view order items for their orders" ON order_items;
DROP POLICY IF EXISTS "Authenticated users can create order items" ON order_items;

-- ============================================
-- SIMPLE POLICIES FOR DEVELOPMENT
-- ============================================

-- Profiles: Anyone can read, authenticated can update own
CREATE POLICY "public_read_profiles" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "users_update_own_profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "authenticated_insert_profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Categories: Public read, no auth required for now
CREATE POLICY "public_read_categories" ON categories
    FOR SELECT USING (true);

CREATE POLICY "public_write_categories" ON categories
    FOR ALL USING (true);

-- Products: Public read and write for development
CREATE POLICY "public_read_products" ON products
    FOR SELECT USING (true);

CREATE POLICY "public_write_products" ON products
    FOR ALL USING (true);

-- Orders: Public access for development
CREATE POLICY "public_read_orders" ON orders
    FOR SELECT USING (true);

CREATE POLICY "public_write_orders" ON orders
    FOR ALL USING (true);

-- Order Items: Public access for development
CREATE POLICY "public_read_order_items" ON order_items
    FOR SELECT USING (true);

CREATE POLICY "public_write_order_items" ON order_items
    FOR ALL USING (true);

-- Success message
SELECT 'RLS policies updated successfully for development mode' as status;
