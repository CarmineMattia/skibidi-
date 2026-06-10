-- ============================================
-- Pizzeria Ambrosia / Matildica — Real Menu Seed
-- Source: pizzeria-matildica.netlify.app (Airtable)
-- ============================================
-- Run in Supabase SQL Editor or via MCP
-- Safe to re-run: deletes existing menu data first
-- ============================================

BEGIN;

-- ----------------------------------------
-- 1. Clean existing categories & products
--    (cascades to products via FK)
-- ----------------------------------------
DELETE FROM products;
DELETE FROM categories;

-- ----------------------------------------
-- 2. Categories
-- ----------------------------------------
INSERT INTO categories (id, name, description, display_order, active) VALUES
  (gen_random_uuid(), 'Pizze Gustose',  'Pizze con pomodoro, ingredienti freschi e genuini', 1, true),
  (gen_random_uuid(), 'Pizze Bianche',  'Pizze senza pomodoro, gusti ricercati',              2, true),
  (gen_random_uuid(), 'Al Metro',       'Pizze al metro da condividere',                      3, true),
  (gen_random_uuid(), 'Piadine',        'Piadine romagnole farcite',                          4, true),
  (gen_random_uuid(), 'Bevande',        'Bibite, birre e vini',                               5, true);

-- ----------------------------------------
-- 3. Products — Pizze Gustose
-- ----------------------------------------
WITH cat AS (SELECT id FROM categories WHERE name = 'Pizze Gustose')
INSERT INTO products (id, category_id, name, description, price, active, display_order) VALUES
  (gen_random_uuid(), (SELECT id FROM cat), 'Marinara',         'Pomodoro, origano, aglio',                                                               4.50,  true, 1),
  (gen_random_uuid(), (SELECT id FROM cat), 'Margherita',       'Pomodoro, mozzarella',                                                                   5.00,  true, 2),
  (gen_random_uuid(), (SELECT id FROM cat), 'Speciale',         'Pomodoro, mozzarella di bufala, pomodorini, basilico',                                   7.50,  true, 3),
  (gen_random_uuid(), (SELECT id FROM cat), 'Nord & Sud',       'Pomodoro, mozzarella, ''nduja, gorgonzola',                                              8.50,  true, 4),
  (gen_random_uuid(), (SELECT id FROM cat), 'Amalfi',           'Pomodoro, mozzarella, scamorza affumicata, pomodorini',                                  7.50,  true, 5),
  (gen_random_uuid(), (SELECT id FROM cat), 'Tirolese',         'Pomodoro, mozzarella di bufala, porcini trifolati, speck',                               9.00,  true, 6),
  (gen_random_uuid(), (SELECT id FROM cat), 'Trentina',         'Pomodoro, mozzarella, gorgonzola, speck',                                                8.00,  true, 7),
  (gen_random_uuid(), (SELECT id FROM cat), 'Francescana',      'Pomodoro, mozzarella, gorgonzola, porcini trifolati',                                    8.00,  true, 8),
  (gen_random_uuid(), (SELECT id FROM cat), 'Matildica',        'Pomodoro, mozzarella, funghi porcini trifolati, pomodorini, Parmigiano Reggiano',         8.00,  true, 9),
  (gen_random_uuid(), (SELECT id FROM cat), 'Pizza del Centro', 'Pomodoro, mozzarella, melanzane, zucchine, peperoni, pomodorini, porcini',               8.00,  true, 10),
  (gen_random_uuid(), (SELECT id FROM cat), 'La Corte Vecia',   'Pomodoro, mozzarella, rucola, scaglie di grana, glassa di aceto balsamico',              8.00,  true, 11),
  (gen_random_uuid(), (SELECT id FROM cat), 'Gustosa',          'Pomodoro, mozzarella, pancetta, gorgonzola, radicchio',                                  9.00,  true, 12),
  (gen_random_uuid(), (SELECT id FROM cat), 'Canossa',          'Pomodoro, mozzarella, prosciutto crudo, rucola, scaglie di grana, glassa balsamica',     9.50,  true, 13),
  (gen_random_uuid(), (SELECT id FROM cat), 'Valtellina',       'Pomodoro, mozzarella, bresaola, rucola, scaglie di grana',                               9.50,  true, 14),
  (gen_random_uuid(), (SELECT id FROM cat), 'Frutti di Mare',   'Pomodoro, mozzarella, seppie, calamari, vongole, cozze, polpi, surimi',                  8.50,  true, 15),
  (gen_random_uuid(), (SELECT id FROM cat), 'Miami',            'Pomodoro, mozzarella, gamberetti, zucchine',                                             8.50,  true, 16),
  (gen_random_uuid(), (SELECT id FROM cat), 'Vegetariana',      'Pomodoro, mozzarella, melanzane, peperoni, zucchine',                                    7.50,  true, 17),
  (gen_random_uuid(), (SELECT id FROM cat), 'La Rosa Selvaggia','Pomodoro, mozzarella, salsiccia, crema di radicchio, scamorza affumicata',               9.00,  true, 18),
  (gen_random_uuid(), (SELECT id FROM cat), 'Piccola',          '1€ in meno rispetto alle normali (formato ridotto)',                                      0.00,  true, 19);

-- ----------------------------------------
-- 4. Products — Pizze Bianche
-- ----------------------------------------
WITH cat AS (SELECT id FROM categories WHERE name = 'Pizze Bianche')
INSERT INTO products (id, category_id, name, description, price, active, display_order) VALUES
  (gen_random_uuid(), (SELECT id FROM cat), 'Tartufata',        'Mozzarella, porcini, crema tartufata',                                                   8.50,  true, 1),
  (gen_random_uuid(), (SELECT id FROM cat), 'Buna',             'Mozzarella, friarielli, salsiccia',                                                      7.50,  true, 2),
  (gen_random_uuid(), (SELECT id FROM cat), 'Mediterranea',     'Mozzarella, friarielli, salame piccante, salsiccia',                                     8.50,  true, 3),
  (gen_random_uuid(), (SELECT id FROM cat), 'Messicana',        'Mozzarella di bufala, pancetta, olio piccante',                                          8.00,  true, 4),
  (gen_random_uuid(), (SELECT id FROM cat), 'Salamina',         'Mozzarella, salamino piccante, friarielli',                                              8.00,  true, 5),
  (gen_random_uuid(), (SELECT id FROM cat), 'Gorgonzola e Noci','Mozzarella, gorgonzola, noci',                                                           8.00,  true, 6),
  (gen_random_uuid(), (SELECT id FROM cat), 'Bologna',          'Mozzarella, fuori cottura: mortadella, stracciatella, crema di pistacchio',              10.00,  true, 7),
  (gen_random_uuid(), (SELECT id FROM cat), 'La Rustica',       'Mozzarella, pancetta, stracchino, patate al forno',                                      9.00,  true, 8),
  (gen_random_uuid(), (SELECT id FROM cat), 'La Natalizia',     'Mozzarella, gorgonzola, porcini, noci',                                                  9.00,  true, 9),
  (gen_random_uuid(), (SELECT id FROM cat), 'Carbonara',        'Mozzarella di bufala, pancetta, uova, pepe nero',                                        9.00,  true, 10),
  (gen_random_uuid(), (SELECT id FROM cat), 'Ambrosia',         'Mozzarella di bufala, pomodorini, pesto genovese',                                       9.00,  true, 11),
  (gen_random_uuid(), (SELECT id FROM cat), 'Piccantina',       'Mozzarella, salame piccante, acciughe, friarielli',                                      8.50,  true, 12),
  (gen_random_uuid(), (SELECT id FROM cat), 'Stria',            'Piadina fritta, classica della tradizione emiliana',                                     3.50,  true, 13);

-- ----------------------------------------
-- 5. Products — Al Metro
-- ----------------------------------------
WITH cat AS (SELECT id FROM categories WHERE name = 'Al Metro')
INSERT INTO products (id, category_id, name, description, price, active, display_order) VALUES
  (gen_random_uuid(), (SELECT id FROM cat), 'Margherita al Metro',             'Pomodoro, mozzarella (1 metro)',                                          13.00, true, 1),
  (gen_random_uuid(), (SELECT id FROM cat), 'Metà Margherita / Metà Farcita',  'Metà margherita e metà a tua scelta',                                    15.50, true, 2),
  (gen_random_uuid(), (SELECT id FROM cat), 'Due Terzi Farcita',               'Un terzo margherita, due terzi a tua scelta',                             17.00, true, 3),
  (gen_random_uuid(), (SELECT id FROM cat), 'Farcita',                         'Ingredienti a tua scelta su tutto il metro',                              19.00, true, 4),
  (gen_random_uuid(), (SELECT id FROM cat), 'Super Farcita',                   'Ingredienti premium a tua scelta, farcitura abbondante',                  21.00, true, 5);

-- ----------------------------------------
-- 6. Products — Piadine
-- ----------------------------------------
WITH cat AS (SELECT id FROM categories WHERE name = 'Piadine')
INSERT INTO products (id, category_id, name, description, price, active, display_order) VALUES
  (gen_random_uuid(), (SELECT id FROM cat), 'Piadina Emiliana',    'Crudo, rucola, scaglie di grana',                       6.00, true, 1),
  (gen_random_uuid(), (SELECT id FROM cat), 'Piadina Valtellina',  'Bresaola, rucola, scaglie di grana',                    6.00, true, 2),
  (gen_random_uuid(), (SELECT id FROM cat), 'Piadina Vegetariana', 'Peperoni, melanzane, zucchine',                         6.00, true, 3),
  (gen_random_uuid(), (SELECT id FROM cat), 'Piadina Trentina',    'Gorgonzola, speck',                                     5.00, true, 4),
  (gen_random_uuid(), (SELECT id FROM cat), 'Piadina Buna',        'Mozzarella, salsiccia, friarielli',                     6.00, true, 5),
  (gen_random_uuid(), (SELECT id FROM cat), 'Piadina Messicana',   'Bufala, pancetta, olio piccante',                       5.00, true, 6),
  (gen_random_uuid(), (SELECT id FROM cat), 'Piadina Bologna',     'Stracciatella, mortadella, crema di pistacchio',        6.00, true, 7);

-- ----------------------------------------
-- 7. Products — Bevande
-- ----------------------------------------
WITH cat AS (SELECT id FROM categories WHERE name = 'Bevande')
INSERT INTO products (id, category_id, name, description, price, active, display_order) VALUES
  (gen_random_uuid(), (SELECT id FROM cat), 'Acqua naturale 0.5L',   'Acqua minerale naturale',                   1.00, true, 1),
  (gen_random_uuid(), (SELECT id FROM cat), 'Acqua frizzante 0.5L',  'Acqua minerale frizzante',                  1.00, true, 2),
  (gen_random_uuid(), (SELECT id FROM cat), 'Coca-Cola 33cl',        'Bibita gassata',                            2.50, true, 3),
  (gen_random_uuid(), (SELECT id FROM cat), 'Fanta 33cl',            'Bibita all''arancia',                       2.50, true, 4),
  (gen_random_uuid(), (SELECT id FROM cat), 'Sprite 33cl',           'Bibita al limone',                          2.50, true, 5),
  (gen_random_uuid(), (SELECT id FROM cat), 'Birra alla spina 0.4L', 'Birra artigianale alla spina',              3.50, true, 6),
  (gen_random_uuid(), (SELECT id FROM cat), 'Birra in bottiglia',    'Birra in bottiglia 33cl',                   3.00, true, 7),
  (gen_random_uuid(), (SELECT id FROM cat), 'Vino rosso (calice)',   'Vino rosso della casa',                     3.00, true, 8),
  (gen_random_uuid(), (SELECT id FROM cat), 'Vino bianco (calice)',  'Vino bianco della casa',                    3.00, true, 9);

-- ----------------------------------------
-- 8. Categoria e prodotto "Componi la tua pizza"
--    (apre il pizza builder nell'app; prezzo = base "a partire da")
-- ----------------------------------------
INSERT INTO categories (id, name, description, display_order, active) VALUES
  (gen_random_uuid(), 'Crea la tua pizza', 'Componi la tua pizza su misura', 0, true);

WITH cat AS (SELECT id FROM categories WHERE name = 'Crea la tua pizza')
INSERT INTO products (id, category_id, name, description, price, active, display_order) VALUES
  (gen_random_uuid(), (SELECT id FROM cat), 'Componi la tua pizza', 'Scegli taglia (piccola, media o mezzo metro), impasto, base e tutti gli ingredienti che vuoi. Prezzo a partire da 4 euro.', 4.00, true, 1);

COMMIT;

-- Verify
SELECT c.name AS categoria, COUNT(p.id) AS prodotti
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
GROUP BY c.name, c.display_order
ORDER BY c.display_order;
