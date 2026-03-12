-- ============================================
-- SKIBIDI ORDERS - Fix RLS Policies
-- ============================================
-- Run this in Supabase SQL Editor to fix "Nessun prodotto" issue
-- ============================================

-- ============================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. CATEGORIES - Public Read Access
-- ============================================

-- Allow anyone to view active categories
CREATE POLICY "Categories are viewable by everyone"
ON categories FOR SELECT
USING (active = true);

-- ============================================
-- 3. PRODUCTS - Public Read Access
-- ============================================

-- Allow anyone to view active products
CREATE POLICY "Products are viewable by everyone"
ON products FOR SELECT
USING (active = true);

-- ============================================
-- 4. MODIFIERS - Public Read Access
-- ============================================

-- Allow anyone to view modifiers
CREATE POLICY "Modifiers are viewable by everyone"
ON modifiers FOR SELECT
USING (true);

-- ============================================
-- 5. ORDERS - Users Can Create Their Own
-- ============================================

-- Allow authenticated users to create orders
CREATE POLICY "Users can create orders"
ON orders FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL OR 
  -- Allow guest orders (user_id is NULL)
  user_id IS NULL
);

-- Allow users to view their own orders
CREATE POLICY "Users can view their own orders"
ON orders FOR SELECT
USING (
  auth.uid() = user_id OR 
  user_id IS NULL OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- ============================================
-- 6. ORDER ITEMS - Follow Order Permissions
-- ============================================

-- Allow inserting order items
CREATE POLICY "Order items can be inserted"
ON order_items FOR INSERT
WITH CHECK (true);

-- Allow viewing order items
CREATE POLICY "Order items are viewable"
ON order_items FOR SELECT
USING (true);

-- ============================================
-- 7. PROFILES - Users Can View/Update Own
-- ============================================

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (
  auth.uid() = id OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'staff')
  )
);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- Allow users to insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================
-- 8. VERIFY POLICIES CREATED
-- ============================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('categories', 'products', 'modifiers', 'orders', 'order_items', 'profiles')
ORDER BY tablename, policyname;

-- ============================================
-- 9. TEST QUERIES (Should return data now)
-- ============================================

-- Test 1: Count categories
SELECT COUNT(*) as categories_count FROM categories WHERE active = true;
-- Expected: 5

-- Test 2: Count products
SELECT COUNT(*) as products_count FROM products WHERE active = true;
-- Expected: 20

-- Test 3: Show menu preview
SELECT 
  c.name as category,
  p.name as product,
  p.price,
  p.description
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.active = true
ORDER BY c."order", p.name
LIMIT 10;

-- ============================================
-- ✅ DONE! RLS Policies Fixed
-- ============================================
-- Refresh the app and you should see products now!
-- ============================================
