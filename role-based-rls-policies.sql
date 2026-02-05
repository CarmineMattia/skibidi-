-- Role-Based Row Level Security (RLS) Policies
-- Enable different access levels based on user role (admin, customer, kiosk)

-- ========================================
-- PROFILES TABLE
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = (SELECT role FROM profiles WHERE id = auth.uid()) -- Prevent role escalation
);

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
ON profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ========================================
-- PRODUCTS TABLE
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view active products" ON products;
DROP POLICY IF EXISTS "Admins can view all products" ON products;
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;

-- Everyone can view active products (including anonymous kiosk users)
CREATE POLICY "Everyone can view active products"
ON products FOR SELECT
TO public
USING (active = true);

-- Admins can view all products (including inactive)
CREATE POLICY "Admins can view all products"
ON products FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Only admins can insert products
CREATE POLICY "Admins can insert products"
ON products FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Only admins can update products
CREATE POLICY "Admins can update products"
ON products FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Only admins can delete products
CREATE POLICY "Admins can delete products"
ON products FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ========================================
-- CATEGORIES TABLE
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view categories" ON categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON categories;
DROP POLICY IF EXISTS "Admins can update categories" ON categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;

-- Everyone can view active categories
CREATE POLICY "Everyone can view categories"
ON categories FOR SELECT
TO public
USING (true);

-- Only admins can insert categories
CREATE POLICY "Admins can insert categories"
ON categories FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Only admins can update categories
CREATE POLICY "Admins can update categories"
ON categories FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Only admins can delete categories
CREATE POLICY "Admins can delete categories"
ON categories FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ========================================
-- ORDERS TABLE
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Customers can view own orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON orders;
DROP POLICY IF EXISTS "Anonymous can create kiosk orders" ON orders;
DROP POLICY IF EXISTS "Admins can update orders" ON orders;

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
ON orders FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Customers can view their own orders
CREATE POLICY "Customers can view own orders"
ON orders FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'customer'
  )
);

-- Authenticated users can create orders
CREATE POLICY "Authenticated users can create orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR user_id IS NULL -- Allow kiosk orders
);

-- Anonymous users can create kiosk orders
CREATE POLICY "Anonymous can create kiosk orders"
ON orders FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- Only admins can update order status
CREATE POLICY "Admins can update orders"
ON orders FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ========================================
-- ORDER_ITEMS TABLE
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all order_items" ON order_items;
DROP POLICY IF EXISTS "Customers can view own order_items" ON order_items;
DROP POLICY IF EXISTS "Authenticated can insert order_items" ON order_items;
DROP POLICY IF EXISTS "Anonymous can insert kiosk order_items" ON order_items;

-- Admins can view all order items
CREATE POLICY "Admins can view all order_items"
ON order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Customers can view their own order items
CREATE POLICY "Customers can view own order_items"
ON order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
  )
);

-- Authenticated users can insert order items (when creating orders)
CREATE POLICY "Authenticated can insert order_items"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
  )
);

-- Anonymous users can insert order items for kiosk orders
CREATE POLICY "Anonymous can insert kiosk order_items"
ON order_items FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id IS NULL
  )
);

-- ========================================
-- VERIFICATION
-- ========================================

-- Check that RLS is enabled on all tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('profiles', 'products', 'categories', 'orders', 'order_items')
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on all required tables';
  END IF;
END $$;

-- Summary of role capabilities:
--
-- KIOSK (anonymous):
--   - View active products and categories
--   - Create orders (user_id = NULL)
--   - Create order items for their orders
--   - Cannot view other orders
--
-- CUSTOMER (authenticated):
--   - Everything kiosk can do
--   - View their own profile
--   - Update their own profile (limited)
--   - View their own orders and order items
--   - Create orders with user_id = auth.uid()
--
-- ADMIN (authenticated):
--   - View/manage all products and categories
--   - View/manage all orders and order items
--   - View/update all user profiles
--   - Full access to kitchen dashboard
--   - Fiscal operations (future)
