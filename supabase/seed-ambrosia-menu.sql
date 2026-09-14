-- =============================================================================
-- Pizzeria Ambrosia — menu seed per il go-live
-- Fonte Bevande e ordine categorie (menu1):
-- https://pizzeria-ambrosia.netlify.app/.netlify/functions/getAirtableData
-- (verificata 2026-09-14)
--
-- Categorie / prodotti attivi:
--   Crea la tua pizza 1; Bevande 26; Dolci 6; Gourmet 9; Gustose 15;
--   Bianche 9; Classiche 21; Al metro 6; Supplementi 23.
--   Totale: 9 categorie, 116 prodotti.
--
-- Piadine non compare nel listino menu1 e resta disattivata. "Componi la tua
-- pizza" resta come voce operativa perché il client la riconosce tramite
-- BUILDER_PRODUCT_NAME.
--
-- Sicurezza di re-run:
--   * il target è solo l'unica azienda chiamata esattamente "Pizzeria Ambrosia";
--   * gli ID derivati da md5 sono deterministici, quindi gli upsert non duplicano;
--   * i vecchi record vengono disattivati, non eliminati, per non rompere le FK
--     dello storico order_items.
--
-- Eseguire nel Supabase SQL Editor. Non eseguire automaticamente in produzione.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE ambrosia_seed_context (
  company_id uuid PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO ambrosia_seed_context (company_id)
SELECT id
FROM public.companies
WHERE lower(name) = 'pizzeria ambrosia';

DO $$
DECLARE
  target_count integer;
BEGIN
  SELECT count(*) INTO target_count FROM ambrosia_seed_context;

  IF target_count <> 1 THEN
    RAISE EXCEPTION
      'Seed annullato: attesa una sola azienda chiamata "Pizzeria Ambrosia", trovate %',
      target_count;
  END IF;
END
$$;

-- Archivia il menu precedente senza invalidare gli articoli degli ordini storici.
UPDATE public.products
SET active = false, updated_at = now()
WHERE company_id = (SELECT company_id FROM ambrosia_seed_context);

UPDATE public.categories
SET active = false, updated_at = now()
WHERE company_id = (SELECT company_id FROM ambrosia_seed_context);

CREATE TEMP TABLE ambrosia_seed_categories (
  name text PRIMARY KEY,
  description text,
  display_order integer NOT NULL
) ON COMMIT DROP;

INSERT INTO ambrosia_seed_categories (name, description, display_order) VALUES
  ('Crea la tua pizza', 'Componi la tua pizza su misura', 0),
  ('Bevande', NULL, 1),
  ('Dolci', NULL, 2),
  ('Gourmet', NULL, 3),
  ('Gustose', NULL, 4),
  ('Bianche', 'Pizze piccole: € 2 in meno delle pizze normali.', 5),
  ('Classiche', NULL, 6),
  ('Al metro', NULL, 7),
  ('Supplementi', NULL, 8);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.categories AS category
    CROSS JOIN ambrosia_seed_categories AS seed
    WHERE category.id = md5('ambrosia:category:' || seed.name)::uuid
      AND category.company_id <> (
        SELECT company_id FROM ambrosia_seed_context
      )
  ) THEN
    RAISE EXCEPTION
      'Seed annullato: un ID categoria Ambrosia appartiene a un''altra azienda';
  END IF;
END
$$;

INSERT INTO public.categories (
  id,
  company_id,
  name,
  description,
  display_order,
  active
)
SELECT
  md5('ambrosia:category:' || seed.name)::uuid,
  context.company_id,
  seed.name,
  seed.description,
  seed.display_order,
  true
FROM ambrosia_seed_categories AS seed
CROSS JOIN ambrosia_seed_context AS context
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  active = true,
  updated_at = now();

CREATE TEMP TABLE ambrosia_seed_products (
  category_name text NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  display_order integer NOT NULL,
  ingredients text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (category_name, name)
) ON COMMIT DROP;

-- Voce operativa del builder (non presente nel listino pubblico).
INSERT INTO ambrosia_seed_products (
  category_name, name, description, price, display_order, ingredients
) VALUES (
  'Crea la tua pizza',
  'Componi la tua pizza',
  'Scegli taglia (piccola, media o mezzo metro), impasto, base e tutti gli ingredienti che vuoi. Prezzo a partire da 4 euro.',
  4.00,
  1,
  '{}'
);

-- Bevande (26). Il payload Airtable non fornisce descrizioni per queste voci.
INSERT INTO ambrosia_seed_products (
  category_name, name, description, price, display_order, ingredients
) VALUES
  ('Bevande', 'Vino Bianco Malvasia 1/4', NULL, 3.00, 1, '{}'),
  ('Bevande', 'Heineken 0.66L', NULL, 3.50, 2, '{}'),
  ('Bevande', 'Ichnusa 0.5L', NULL, 3.50, 3, '{}'),
  ('Bevande', 'Coca Cola piccola', NULL, 2.00, 4, '{}'),
  ('Bevande', 'Acqua Pejo nat/gas 0.75L', NULL, 2.00, 5, '{}'),
  ('Bevande', 'Erdinger Weissbier 0.5L', NULL, 5.00, 6, '{}'),
  ('Bevande', 'Birra Theresianer 1L', NULL, 10.00, 7, '{}'),
  ('Bevande', 'Chardonnay', NULL, 10.00, 8, '{}'),
  ('Bevande', 'Leffe Bionda 0.33L', NULL, 3.50, 9, '{}'),
  ('Bevande', 'Leffe Rossa 0.33L', NULL, 3.50, 10, '{}'),
  ('Bevande', 'Birra analcolica', NULL, 3.50, 11, '{}'),
  ('Bevande', 'Coca Cola 1.5 LT', NULL, 6.00, 12, '{}'),
  ('Bevande', 'Coca Cola media', NULL, 3.00, 13, '{}'),
  ('Bevande', 'Birra Theresianer media', NULL, 3.50, 14, '{}'),
  ('Bevande', 'The Limone/Pesca', NULL, 2.00, 15, '{}'),
  ('Bevande', 'Coca Cola', NULL, 2.00, 16, '{}'),
  ('Bevande', 'Fanta', NULL, 2.00, 17, '{}'),
  ('Bevande', 'Ceres 0.33L', NULL, 3.50, 18, '{}'),
  ('Bevande', 'Coca Cola Zero', NULL, 2.00, 19, '{}'),
  ('Bevande', 'Sprite', NULL, 2.00, 20, '{}'),
  ('Bevande', 'Vino Bianco Malvasia 1L', NULL, 9.00, 21, '{}'),
  ('Bevande', 'Birra Theresianer piccola', NULL, 2.50, 22, '{}'),
  ('Bevande', 'Prosecco Contarini', NULL, 10.00, 23, '{}'),
  ('Bevande', 'Moretti 0.66L', NULL, 3.50, 24, '{}'),
  ('Bevande', 'Acqua nat/gas 0.50', NULL, 1.00, 25, '{}'),
  ('Bevande', 'Vino Bianco Malvasia 1/2', NULL, 4.50, 26, '{}');

-- Classiche (21)
INSERT INTO ambrosia_seed_products (
  category_name, name, description, price, display_order, ingredients
) VALUES
  ('Classiche', 'Marinara', 'Pomodoro, aglio, origano', 4.50, 1, ARRAY['Pomodoro', 'Aglio', 'Origano']),
  ('Classiche', 'Margherita', 'Pomodoro, mozz. fior di latte', 5.00, 2, ARRAY['Pomodoro', 'Mozz. fior di latte']),
  ('Classiche', 'Funghi', 'Pomodoro, mozz. fior di latte, funghi', 6.00, 3, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Funghi']),
  ('Classiche', 'Prosciutto', 'Pomodoro, mozz. fior di latte, prosciutto cotto', 6.00, 4, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Prosciutto cotto']),
  ('Classiche', 'Salsiccia', 'Pomodoro, mozz. fior di latte, salsiccia', 6.00, 5, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Salsiccia']),
  ('Classiche', 'Napoli', 'Pomodoro, mozz. fior di latte, acciughe, origano', 6.00, 6, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Acciughe', 'Origano']),
  ('Classiche', 'Würstel', 'Pomodoro, mozz. fior di latte, würstel', 6.00, 7, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Würstel']),
  ('Classiche', 'Tonno', 'Pomodoro, mozz. fior di latte, tonno', 6.00, 8, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Tonno']),
  ('Classiche', 'Capricciosa', 'Pomodoro, mozz. fior di latte, prosciutto cotto, funghi, carciofi, salsiccia, olive', 7.00, 9, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Prosciutto cotto', 'Funghi', 'Carciofi', 'Salsiccia', 'Olive']),
  ('Classiche', 'Quattro Stagioni', 'Pomodoro, mozz. fior di latte, prosciutto cotto, funghi, carciofi, salsiccia', 7.00, 10, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Prosciutto cotto', 'Funghi', 'Carciofi', 'Salsiccia']),
  ('Classiche', 'Speciale', 'Pomodoro, mozz. fior di latte di bufala, pomodorini, basilico', 7.00, 11, ARRAY['Pomodoro', 'Mozz. fior di latte di bufala', 'Pomodorini', 'Basilico']),
  ('Classiche', 'Crudo di Parma', 'Pomodoro, mozz. fior di latte, prosciutto crudo di Parma', 7.00, 12, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Prosciutto crudo di Parma']),
  ('Classiche', 'Pancetta', 'Pomodoro, mozz. fior di latte, pancetta', 7.00, 13, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Pancetta']),
  ('Classiche', 'Speck', 'Pomodoro, mozz. fior di latte, speck', 7.00, 14, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Speck']),
  ('Classiche', 'Quattro Formaggi', 'Pomodoro, mozz. fior di latte, pecorino, emmental, gorgonzola', 6.50, 15, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Pecorino', 'Emmental', 'Gorgonzola']),
  ('Classiche', 'Romana', 'Pomodoro, mozz. fior di latte, acciughe, capperi, origano, olive', 6.50, 16, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Acciughe', 'Capperi', 'Origano', 'Olive']),
  ('Classiche', 'Hanz', 'Pomodoro, mozz. fior di latte, würstel, patatine', 6.50, 17, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Würstel', 'Patatine']),
  ('Classiche', 'Diavola', 'Pomodoro, mozz. fior di latte, spianata calabra', 6.50, 18, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Spianata calabra']),
  ('Classiche', 'Stracchino e Rucola', 'Pomodoro, mozz. fior di latte, stracchino, rucola', 7.50, 19, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Stracchino', 'Rucola']),
  ('Classiche', 'Calzone', 'Pomodoro, mozz. fior di latte, prosciutto cotto', 6.00, 20, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Prosciutto cotto']),
  ('Classiche', 'Calzone farcito', 'Pomodoro, mozz. fior di latte, prosciutto cotto, funghi', 6.50, 21, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Prosciutto cotto', 'Funghi']);

-- Gourmet (9)
INSERT INTO ambrosia_seed_products (
  category_name, name, description, price, display_order, ingredients
) VALUES
  ('Gourmet', 'Crudo e Burrata', 'Pomodoro, mozz. fior di latte, fuori cottura: crudo di Parma, burrata Pugliese, olio', 10.00, 1, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Crudo di Parma', 'Burrata Pugliese', 'Olio']),
  ('Gourmet', 'Carbonara', 'Mozz. fior di latte di bufala, pancetta, uovo, pepe nero', 9.00, 2, ARRAY['Mozz. fior di latte di bufala', 'Pancetta', 'Uovo', 'Pepe nero']),
  ('Gourmet', 'Partenopea', 'Stracciatella Pugliese, acciughe del mar Cantabrico, olive', 11.00, 3, ARRAY['Stracciatella Pugliese', 'Acciughe del mar Cantabrico', 'Olive']),
  ('Gourmet', 'Trevigiana', 'Mozz. fior di latte di bufala, crema di radicchio, fuori cottura: brasaola I.G.P.', 9.00, 4, ARRAY['Mozz. fior di latte di bufala', 'Crema di radicchio', 'Brasaola I.G.P.']),
  ('Gourmet', 'Bologna', 'Mozz. fior di latte, fuori cottura: mortadella, straciatella, crema di pistacchio', 10.00, 5, ARRAY['Mozz. fior di latte', 'Mortadella', 'Straciatella', 'Crema di pistacchio']),
  ('Gourmet', 'Cantabrico', 'Pomodoro, mozz. fior di latte, fuori cottura: acciughe del mar Cantabrico', 9.00, 6, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Acciughe del mar Cantabrico']),
  ('Gourmet', 'Ambrosia', 'Mozz. fior di latte di bufala, pomodorini, pesto alla genovese', 9.00, 7, ARRAY['Mozz. fior di latte di bufala', 'Pomodorini', 'Pesto alla genovese']),
  ('Gourmet', 'La Rustica', 'Mozz. fior di latte, pancetta, stracchino, patate al forno', 11.00, 8, ARRAY['Mozz. fior di latte', 'Pancetta', 'Stracchino', 'Patate al forno']),
  ('Gourmet', 'La Zuccotta', 'Crema di zucca, mozz. fior di latte, gorgonzola, pancetta, pepe nero', 11.00, 9, ARRAY['Crema di zucca', 'Mozz. fior di latte', 'Gorgonzola', 'Pancetta', 'Pepe nero']);

-- Gustose (15)
INSERT INTO ambrosia_seed_products (
  category_name, name, description, price, display_order, ingredients
) VALUES
  ('Gustose', '''Nduja', 'Pomodoro, mozz. fior di latte, ''nduja', 7.00, 1, ARRAY['Pomodoro', 'Mozz. fior di latte', '''Nduja']),
  ('Gustose', 'Amalfi', 'Pomodoro, mozz. fior di latte, scamorza affumicata, pomodorini', 7.00, 2, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Scamorza affumicata', 'Pomodorini']),
  ('Gustose', 'Tirolese', 'Pomodoro, mozz. fior di latte di bufala, porcini trifolati, speck', 8.50, 3, ARRAY['Pomodoro', 'Mozz. fior di latte di bufala', 'Porcini trifolati', 'Speck']),
  ('Gustose', 'Trentina', 'Pomodoro, mozz. fior di latte, gorgonzola, speck', 7.50, 4, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Gorgonzola', 'Speck']),
  ('Gustose', 'Francescana', 'Pomodoro, mozz. fior di latte, gorgonzola, porcini trifolati', 7.50, 5, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Gorgonzola', 'Porcini trifolati']),
  ('Gustose', 'Matildica', 'Pomodoro, mozz. fior di latte, funghi porcini trifolati, pomodorini, parmigiano reggiano', 7.50, 6, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Funghi porcini trifolati', 'Pomodorini', 'Parmigiano reggiano']),
  ('Gustose', 'Pizza del Centro', 'Pomodoro, mozz. fior di latte, melanzane, zucchine, peperoni, pomodorini, porcini', 8.50, 7, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Melanzane', 'Zucchine', 'Peperoni', 'Pomodorini', 'Porcini']),
  ('Gustose', 'La Corte Vecia', 'Pomodoro, mozz. fior di latte, rucola, scaglie di grana, glassa di aceto balsamico', 7.50, 8, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Rucola', 'Scaglie di grana', 'Glassa di aceto balsamico']),
  ('Gustose', 'Canossa', 'Pomodoro, mozz. fior di latte, prosciutto crudo, rucola, scaglie di grana, glassa di aceto balsamico', 9.00, 9, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Prosciutto crudo', 'Rucola', 'Scaglie di grana', 'Glassa di aceto balsamico']),
  ('Gustose', 'Valtellina', 'Pomodoro, mozz. fior di latte, bresaola, rucola, scaglie di grana', 9.00, 10, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Bresaola', 'Rucola', 'Scaglie di grana']),
  ('Gustose', 'Frutti di Mare', 'Pomodoro, mozz. fior di latte, seppie, calamari, vongole, cozze, polpi, surimi', 9.00, 11, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Seppie', 'Calamari', 'Vongole', 'Cozze', 'Polpi', 'Surimi']),
  ('Gustose', 'Miami', 'Pomodoro, mozz. fior di latte, gamberetti, zucchine', 8.00, 12, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Gamberetti', 'Zucchine']),
  ('Gustose', 'Vegetariana', 'Pomodoro, mozz. fior di latte, melanzane, peperoni, zucchine', 7.00, 13, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Melanzane', 'Peperoni', 'Zucchine']),
  ('Gustose', 'La Rosa Selvaggia', 'Pomodoro, mozz. fior di latte, salsiccia, crema di radicchio, scamorza affumicata, glassa di aceto balsamico', 9.00, 14, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Salsiccia', 'Crema di radicchio', 'Scamorza affumicata', 'Glassa di aceto balsamico']),
  ('Gustose', 'La fumè', 'Pomodoro, mozz. fior di latte, speck, scamorza affumicata', 8.50, 15, ARRAY['Pomodoro', 'Mozz. fior di latte', 'Speck', 'Scamorza affumicata']);

-- Bianche (9). La riduzione per le pizze piccole è nella descrizione categoria.
INSERT INTO ambrosia_seed_products (
  category_name, name, description, price, display_order, ingredients
) VALUES
  ('Bianche', 'Tartufata', 'Mozz. fior di latte, porcini, crema tartufata', 8.00, 1, ARRAY['Mozz. fior di latte', 'Porcini', 'Crema tartufata']),
  ('Bianche', 'Buna', 'Mozz. fior di latte, salsiccia, friarielli', 7.00, 2, ARRAY['Mozz. fior di latte', 'Salsiccia', 'Friarielli']),
  ('Bianche', 'Beach', 'Mozz. fior di latte, rucola, pomodorini, gamberetti', 8.00, 3, ARRAY['Mozz. fior di latte', 'Rucola', 'Pomodorini', 'Gamberetti']),
  ('Bianche', 'Mediterranea', 'Mozz. fior di latte, friarielli, spianata calabra, salsiccia', 8.00, 4, ARRAY['Mozz. fior di latte', 'Friarielli', 'Spianata calabra', 'Salsiccia']),
  ('Bianche', 'Messicana', 'Mozz. fior di latte di bufala, pancetta, olio piccante', 7.50, 5, ARRAY['Mozz. fior di latte di bufala', 'Pancetta', 'Olio piccante']),
  ('Bianche', 'Piccantina', 'Mozz. fior di latte, spianata calabra, acciughe, friarielli', 8.00, 6, ARRAY['Mozz. fior di latte', 'Spianata calabra', 'Acciughe', 'Friarielli']),
  ('Bianche', 'Salamina', 'Mozz. fior di latte, spianata calabra, friarielli', 7.50, 7, ARRAY['Mozz. fior di latte', 'Spianata calabra', 'Friarielli']),
  ('Bianche', 'Gorgonzola e Noci', 'Mozz. fior di latte, gorgonzola, noci', 8.00, 8, ARRAY['Mozz. fior di latte', 'Gorgonzola', 'Noci']),
  ('Bianche', 'Stria', NULL, 3.00, 9, '{}');

-- Al metro (6)
INSERT INTO ambrosia_seed_products (
  category_name, name, description, price, display_order, ingredients
) VALUES
  ('Al metro', 'Margherita', NULL, 13.00, 1, '{}'),
  ('Al metro', 'Metà Margherita, Metà Farcita', NULL, 14.50, 2, '{}'),
  ('Al metro', 'Due terzi Farcita', NULL, 16.00, 3, '{}'),
  ('Al metro', 'Farcita', NULL, 18.00, 4, '{}'),
  ('Al metro', 'Super Farcita', NULL, 20.00, 5, '{}'),
  ('Al metro', 'Gourmet', NULL, 22.00, 6, '{}');

-- Supplementi (23): ogni supplemento del listino è rappresentato da un prodotto.
INSERT INTO ambrosia_seed_products (
  category_name, name, description, price, display_order, ingredients
) VALUES
  ('Supplementi', 'Olive', NULL, 0.50, 1, '{}'),
  ('Supplementi', 'Funghi', NULL, 0.50, 2, '{}'),
  ('Supplementi', 'Acciughe', NULL, 0.50, 3, '{}'),
  ('Supplementi', 'Carciofi', NULL, 0.50, 4, '{}'),
  ('Supplementi', 'Prosciutto cotto', NULL, 0.50, 5, '{}'),
  ('Supplementi', 'Würstel', NULL, 0.50, 6, '{}'),
  ('Supplementi', 'Salsiccia', NULL, 0.50, 7, '{}'),
  ('Supplementi', 'Cipolla', NULL, 0.50, 8, '{}'),
  ('Supplementi', 'Gorgonzola', NULL, 1.00, 9, '{}'),
  ('Supplementi', 'Grana a scaglie', NULL, 1.00, 10, '{}'),
  ('Supplementi', 'Bufala', NULL, 1.00, 11, '{}'),
  ('Supplementi', 'Pomodorini freschi', NULL, 1.00, 12, '{}'),
  ('Supplementi', 'Rucola', NULL, 1.00, 13, '{}'),
  ('Supplementi', 'Doppia pasta', NULL, 1.00, 14, '{}'),
  ('Supplementi', 'Doppia mozz. fior di latte', NULL, 1.00, 15, '{}'),
  ('Supplementi', 'Tirata margherita', NULL, 1.00, 16, '{}'),
  ('Supplementi', 'Scamorza', NULL, 1.50, 17, '{}'),
  ('Supplementi', 'Salamino piccante', NULL, 1.50, 18, '{}'),
  ('Supplementi', 'Crudo', NULL, 2.50, 19, '{}'),
  ('Supplementi', 'Speck', NULL, 2.50, 20, '{}'),
  ('Supplementi', 'Pancetta', NULL, 2.50, 21, '{}'),
  ('Supplementi', 'Bresaola', NULL, 2.50, 22, '{}'),
  ('Supplementi', 'Burrata', NULL, 2.50, 23, '{}');

-- Dolci (6)
INSERT INTO ambrosia_seed_products (
  category_name, name, description, price, display_order, ingredients
) VALUES
  ('Dolci', 'Mascarpone', NULL, 3.50, 1, '{}'),
  ('Dolci', 'Profiterol', NULL, 3.50, 2, '{}'),
  ('Dolci', 'Tiramisu', NULL, 3.50, 3, '{}'),
  ('Dolci', 'Tartufo Bianco / Nero', NULL, 3.50, 4, '{}'),
  ('Dolci', 'Torronocino', NULL, 3.50, 5, '{}'),
  ('Dolci', 'Sorbetto Limone', NULL, 2.00, 6, '{}');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.products AS product
    CROSS JOIN ambrosia_seed_products AS seed
    WHERE product.id = md5(
      'ambrosia:product:' || seed.category_name || ':' || seed.name
    )::uuid
      AND product.company_id <> (
        SELECT company_id FROM ambrosia_seed_context
      )
  ) THEN
    RAISE EXCEPTION
      'Seed annullato: un ID prodotto Ambrosia appartiene a un''altra azienda';
  END IF;
END
$$;

INSERT INTO public.products (
  id,
  category_id,
  company_id,
  name,
  description,
  price,
  active,
  display_order,
  ingredients
)
SELECT
  md5(
    'ambrosia:product:' || seed.category_name || ':' || seed.name
  )::uuid,
  md5('ambrosia:category:' || seed.category_name)::uuid,
  context.company_id,
  seed.name,
  seed.description,
  seed.price,
  true,
  seed.display_order,
  seed.ingredients
FROM ambrosia_seed_products AS seed
CROSS JOIN ambrosia_seed_context AS context
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  active = true,
  display_order = EXCLUDED.display_order,
  ingredients = EXCLUDED.ingredients,
  updated_at = now();

DO $$
DECLARE
  active_category_count integer;
  active_product_count integer;
BEGIN
  SELECT count(*)
  INTO active_category_count
  FROM public.categories
  WHERE company_id = (SELECT company_id FROM ambrosia_seed_context)
    AND active;

  SELECT count(*)
  INTO active_product_count
  FROM public.products
  WHERE company_id = (SELECT company_id FROM ambrosia_seed_context)
    AND active;

  IF active_category_count <> 9 OR active_product_count <> 116 THEN
    RAISE EXCEPTION
      'Seed Ambrosia incompleto: attese 9 categorie/116 prodotti, ottenute %/%',
      active_category_count,
      active_product_count;
  END IF;
END
$$;

COMMIT;

-- Riepilogo del menu attivo appena inserito.
SELECT c.name AS categoria, count(p.id) AS prodotti
FROM public.categories AS c
LEFT JOIN public.products AS p
  ON p.category_id = c.id
  AND p.active
WHERE EXISTS (
    SELECT 1
    FROM public.companies AS company
    WHERE company.id = c.company_id
      AND lower(company.name) = 'pizzeria ambrosia'
  )
  AND c.active
GROUP BY c.name, c.display_order
ORDER BY c.display_order;
