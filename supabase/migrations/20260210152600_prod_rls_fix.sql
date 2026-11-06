-- ============================================
-- SKIBIDI ORDERS - Production RLS Fix Migration
-- Date: 2026-02-10
-- Purpose: Fix security vulnerabilities identified by Supabase Advisor
-- ============================================

-- ============================================
-- SECTION 1: Fix Function Security (search_path)
-- ============================================

-- Drop and recreate with secure search_path
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS is_admin(UUID);
DROP FUNCTION IF EXISTS handle_new_user();

-- Secure function for updated_at with proper search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Admin check function with secure search_path
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- New user handler with secure search_path
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        'customer'::public.user_role
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- ============================================
-- SECTION 2: Remove Overly Permissive RLS Policies
-- ============================================

-- Drop all existing overly permissive policies (those with USING (true) and WITH CHECK (true))
DROP POLICY IF EXISTS public_write_categories ON categories;
DROP POLICY IF EXISTS public_write_products ON products;
DROP POLICY IF EXISTS public_write_orders ON orders;
DROP POLICY IF EXISTS public_write_order_items ON order_items;

-- ============================================
-- SECTION 3: Create Secure, Production-Ready RLS Policies
-- ============================================

-- CATEGORIES: Read access for all, admin-only write
CREATE POLICY "Anyone can view categories" ON categories
    FOR SELECT USING (true);

CREATE POLICY "Admins can insert categories" ON categories
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update categories" ON categories
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can delete categories" ON categories
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- PRODUCTS: Read access for all, admin-only write
CREATE POLICY "Anyone can view products" ON products
    FOR SELECT USING (true);

CREATE POLICY "Admins can insert products" ON products
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update products" ON products
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can delete products" ON products
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ORDERS: Read/Write based on role and ownership
CREATE POLICY "Users can view own orders" ON orders
    FOR SELECT USING (
        customer_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'kiosk'))
    );

CREATE POLICY "Anyone can create orders" ON orders
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own orders" ON orders
    FOR UPDATE USING (
        customer_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'kiosk'))
    );

-- ORDER_ITEMS: Access through orders
CREATE POLICY "Users can view order items" ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND (
                orders.customer_id = auth.uid() OR
                EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'kiosk'))
            )
        )
    );

CREATE POLICY "Anyone can create order items" ON order_items
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- SECTION 4: Optimize RLS Performance (auth.uid() caching)
-- ============================================

-- Create a helper view to cache current user ID (reduces auth.uid() calls)
CREATE OR REPLACE VIEW current_user_context AS
SELECT
    auth.uid() as user_id,
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) as is_admin,
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'kiosk'
    ) as is_kiosk;

-- ============================================
-- SECTION 5: Trigger for auto-profile creation
-- ============================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- SECTION 6: Grant permissions for service role
-- ============================================

-- Note: Service role bypasses RLS, use carefully
-- This is needed for Edge Functions and admin operations