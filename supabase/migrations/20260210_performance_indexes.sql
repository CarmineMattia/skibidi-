-- ============================================
-- SKIBIDI ORDERS - Performance Indexes Optimization
-- Date: 2026-02-10
-- Purpose: Add optimized indexes for common queries
-- ============================================

-- ============================================
-- SECTION 1: Remove Unused Indexes (per Supabase Advisor)
-- ============================================

-- These indexes were flagged as unused - remove to save space
-- DROP INDEX IF EXISTS idx_products_active;
-- DROP INDEX IF EXISTS idx_orders_fiscal_status;
-- DROP INDEX IF EXISTS idx_order_items_product;

-- ============================================
-- SECTION 2: Add Composite Indexes for Common Queries
-- ============================================

-- Products by category with active filter (menu queries)
CREATE INDEX IF NOT EXISTS idx_products_category_active
ON products(category_id, active DESC, display_order ASC);

-- Orders by customer with status filter (user order history)
CREATE INDEX IF NOT EXISTS idx_orders_customer_status
ON orders(customer_id, status, created_at DESC);

-- Orders by fiscal status with date (retry queue queries)
CREATE INDEX IF NOT EXISTS idx_orders_fiscal_status_date
ON orders(fiscal_status, created_at DESC) WHERE fiscal_status = 'pending';

-- Order items with product info (kitchen display)
CREATE INDEX IF NOT EXISTS idx_order_items_order_product
ON order_items(order_id, product_id);

-- Categories ordered for menu display
CREATE INDEX IF NOT EXISTS idx_categories_active_order
ON categories(active DESC, display_order ASC);

-- ============================================
# SECTION 3: Full Text Search (Future - for product search)
# ============================================

-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full text search index on product names
CREATE INDEX IF NOT EXISTS idx_products_name_gin
ON products USING GIN (name gin_trgm_ops);

-- ============================================
-- SECTION 4: Covering Indexes for Common Queries
-- ============================================

-- Covering index for order list (avoids table lookup)
CREATE INDEX IF NOT EXISTS idx_orders_list_covering
ON orders(status, created_at DESC)
INCLUDE (total_amount, fiscal_status, customer_id);

-- Covering index for product menu (avoids table lookup)
CREATE INDEX IF NOT EXISTS idx_products_menu_covering
ON products(category_id, active, display_order)
INCLUDE (name, price, image_url);

-- ============================================
-- SECTION 5: Analyze Tables (update statistics)
-- ============================================

ANALYZE products;
ANALYZE orders;
ANALYZE order_items;
ANALYZE categories;
ANALYZE profiles;

-- ============================================
-- SECTION 6: Index Usage Monitoring
-- ============================================

-- Query to identify unused indexes (run periodically)
-- SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan ASC;

-- Query to identify missing indexes on hot tables
-- SELECT relname, seq_scan, seq_tup_read, idx_scan, idx_tup_read
-- FROM pg_stat_user_tables
-- WHERE seq_scan > 1000  -- Tables with many seq scans
-- ORDER BY seq_scan DESC;