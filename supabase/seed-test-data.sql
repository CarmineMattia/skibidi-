-- ============================================
-- SKIBIDI ORDERS - Test Data Setup
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. CREATE TEST USERS
-- ============================================

-- Admin User (email: admin@skibidi.com / password: Admin123!)
-- Note: You'll need to create this via Supabase Auth UI or API
-- For now, we'll insert directly into profiles (assuming auth.users exists)

-- INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at)
-- VALUES (
--   '00000000-0000-0000-0000-000000000001',
--   'admin@skibidi.com',
--   '$2a$10$...', -- hashed password (use Supabase UI to create)
--   NOW(),
--   NOW()
-- );

-- For testing, use Supabase Dashboard to create users:
-- Admin: admin@skibidi.com / Admin123!
-- Staff: staff@skibidi.com / Staff123!
-- Customer: customer@skibidi.com / Customer123!

-- ============================================
-- 2. CREATE CATEGORIES
-- ============================================

INSERT INTO categories (id, name, description, "order", active, created_at) VALUES
(1, 'Pizze Classiche', 'Le tradizionali pizze italiane', 1, true, NOW()),
(2, 'Pizze Speciali', 'Pizze gourmet con ingredienti premium', 2, true, NOW()),
(3, 'Bevande', 'Bibite, birre e vini', 3, true, NOW()),
(4, 'Antipasti', 'Stuzzichini e appetizer', 4, true, NOW()),
(5, 'Dolci', 'Dessert fatti in casa', 5, true, NOW());

-- ============================================
-- 3. CREATE PRODUCTS
-- ============================================

-- Pizze Classiche
INSERT INTO products (id, name, description, price, image_url, active, category_id, created_at) VALUES
(1, 'Margherita', 'Pomodoro San Marzano, mozzarella fior di latte, basilico fresco', 8.00, NULL, true, 1, NOW()),
(2, 'Marinara', 'Pomodoro San Marzano, aglio, origano, basilico', 7.00, NULL, true, 1, NOW()),
(3, 'Diavola', 'Pomodoro, mozzarella, salame piccante calabrese', 10.00, NULL, true, 1, NOW()),
(4, 'Prosciutto e Funghi', 'Pomodoro, mozzarella, prosciutto cotto, funghi champignon', 11.00, NULL, true, 1, NOW()),
(5, 'Quattro Stagioni', 'Pomodoro, mozzarella, carciofi, funghi, prosciutto, olive', 12.00, NULL, true, 1, NOW()),
(6, 'Capricciosa', 'Pomodoro, mozzarella, carciofi, funghi, prosciutto, olive, uovo', 12.50, NULL, true, 1, NOW());

-- Pizze Speciali
INSERT INTO products (id, name, description, price, image_url, active, category_id, created_at) VALUES
(7, 'Bufalina', 'Pomodoro San Marzano, mozzarella di bufala DOP, basilico', 13.00, NULL, true, 2, NOW()),
(8, 'Parmigiana', 'Pomodoro, melanzane fritte, parmigiano, mozzarella, basilico', 13.50, NULL, true, 2, NOW()),
(9, 'Ortolana', 'Pomodoro, mozzarella, verdure grigliate (zucchine, melanzane, peperoni)', 12.00, NULL, true, 2, NOW()),
(10, 'Carbonara', 'Mozzarella, guanciale croccante, uovo, pecorino, pepe nero', 13.00, NULL, true, 2, NOW()),
(11, 'Truffle', 'Mozzarella, crema di tartufo, funghi porcini, rucola, grana', 15.00, NULL, true, 2, NOW());

-- Bevande
INSERT INTO products (id, name, description, price, image_url, active, category_id, created_at) VALUES
(12, 'Coca Cola 33cl', 'Lattina 33cl', 3.00, NULL, true, 3, NOW()),
(13, 'Acqua Naturale 50cl', 'Bottiglia 50cl', 2.00, NULL, true, 3, NOW()),
(14, 'Birra Moretti 33cl', 'Bottiglia 33cl', 4.50, NULL, true, 3, NOW()),
(15, 'Vino della Casa (calice)', 'Rosso o Bianco', 5.00, NULL, true, 3, NOW()),
(16, 'Succhi di Frutta', 'Arancia, Pesca, Ananas', 3.50, NULL, true, 3, NOW());

-- Antipasti
INSERT INTO products (id, name, description, price, image_url, active, category_id, created_at) VALUES
(17, 'Bruschetta al Pomodoro', 'Pane tostato, pomodoro, aglio, basilico, olio EVO', 5.00, NULL, true, 4, NOW()),
(18, 'Tagliere Misto', 'Salumi e formaggi locali', 12.00, NULL, true, 4, NOW()),
(19, 'Frittatina di Pasta', 'Frittatina napoletana con piselli e prosciutto', 6.00, NULL, true, 4, NOW());

-- Dolci
INSERT INTO products (id, name, description, price, image_url, active, category_id, created_at) VALUES
(20, 'Tiramisù', 'Fatto in casa con mascarpone e caffè', 6.00, NULL, true, 5, NOW()),
(21, 'Cannolo Siciliano', 'Ricotta fresca, scorza d''arancia, cioccolato', 5.00, NULL, true, 5, NOW()),
(22, 'Delizia al Limone', 'Dolce al limone tipico sorrentino', 6.50, NULL, true, 5, NOW());

-- ============================================
-- 4. CREATE MODIFIERS (Extra/Opzioni)
-- ============================================

INSERT INTO modifiers (id, name, price, required, product_id, created_at) VALUES
-- Margherita modifiers
(1, 'Extra Mozzarella', 1.50, false, 1, NOW()),
(2, 'Senza Cipolle', 0.00, false, 1, NOW()),
(3, 'Basilico Extra', 0.50, false, 1, NOW()),

-- Diavola modifiers
(4, 'Extra Salame', 2.00, false, 3, NOW()),
(5, 'Doppio Piccante', 0.00, false, 3, NOW()),

-- Pizza modifiers (general)
(6, 'Crosta Alta', 0.00, false, NULL, NOW()),
(7, 'Crosta Sottile', 0.00, false, NULL, NOW()),
(8, 'Senza Glutine (+2€)', 2.00, false, NULL, NOW());

-- ============================================
-- 5. CREATE TEST ORDERS (Optional)
-- ============================================

-- INSERT INTO orders (id, order_number, status, type, user_id, table_number, total_price, notes, payment_method, payment_status, created_at) VALUES
-- (1, '20260312-001', 'COMPLETED', 'DINE_IN', NULL, 5, 23.00, 'Tavolo vicino alla finestra', 'CARD', 'PAID', NOW()),
-- (2, '20260312-002', 'PREPARING', 'TAKEAWAY', NULL, NULL, 15.50, 'Da asporto, ben caldo', 'CASH', 'PENDING', NOW());

-- ============================================
-- 6. VERIFY DATA
-- ============================================

-- Check categories
SELECT COUNT(*) as categories_count FROM categories;

-- Check products
SELECT COUNT(*) as products_count FROM products;

-- Check modifiers
SELECT COUNT(*) as modifiers_count FROM modifiers;

-- Show menu preview
SELECT 
  c.name as category,
  p.name as product,
  p.price as price,
  p.description
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.active = true
ORDER BY c."order", p.name;

-- ============================================
-- DONE! 🎉
-- ============================================
