-- =============================================================================
-- Pizzeria Ambrosia — listino ufficiale menu1 (Netlify / Airtable)
-- Fonte: https://pizzeria-ambrosia.netlify.app/.netlify/functions/getAirtableData
-- Scaricato 2026-09-15. Nulla di più, nulla di meno.
--
-- Categorie attive (7): Bevande, Dolci, Gourmet, Gustose, Bianche, Classiche,
-- Al metro. (Supplementi e Pizze Piccole disattivati / non seedati.)
-- Prodotti attivi: 85 (senza riga informativa Pizze Piccole).
--
-- Nessuna piadina, nessun builder extra, nessun supplemento splittato.
-- I vecchi record restano disattivati (FK order_items).
--
-- Eseguire nel Supabase SQL Editor.
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
  ('Bevande', NULL, 1),
  ('Dolci', NULL, 2),
  ('Gourmet', NULL, 3),
  ('Gustose', NULL, 4),
  ('Bianche', 'Pizze piccole: € 2 in meno delle pizze normali.', 5),
  ('Classiche', NULL, 6),
  ('Al metro', NULL, 7);

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
  id, company_id, name, description, display_order, active
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
  image_url text,
  ingredients text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (category_name, name)
) ON COMMIT DROP;

-- Bevande (26)
INSERT INTO ambrosia_seed_products (
  category_name, name, image_url, price, display_order, ingredients
) VALUES
  ('Bevande', 'Vino Bianco Malvasia 1/4', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80', 3.00, 1, '{}'),
  ('Bevande', 'Heineken 0.66L', 'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?auto=format&fit=crop&w=600&q=80', 3.50, 2, '{}'),
  ('Bevande', 'Ichnusa 0.5L', 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&q=80', 3.50, 3, '{}'),
  ('Bevande', 'Coca Cola piccola', 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=600&q=80', 2.00, 4, '{}'),
  ('Bevande', 'Acqua Pejo nat/gas 0.75L', 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=600&q=80', 2.00, 5, '{}'),
  ('Bevande', 'Erdinger Weissbier 0.5L', 'https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?auto=format&fit=crop&w=600&q=80', 5.00, 6, '{}'),
  ('Bevande', 'Birra Theresianer 1L', 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&q=80', 10.00, 7, '{}'),
  ('Bevande', 'Chardonnay', 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=600&q=80', 10.00, 8, '{}'),
  ('Bevande', 'Leffe Bionda 0.33L', 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=600&q=80', 3.50, 9, '{}'),
  ('Bevande', 'Leffe Rossa 0.33L', 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=600&q=80', 3.50, 10, '{}'),
  ('Bevande', 'Birra analcolica', 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&q=80', 3.50, 11, '{}'),
  ('Bevande', 'Coca Cola 1.5 LT', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80', 6.00, 12, '{}'),
  ('Bevande', 'Coca Cola media', 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=600&q=80', 3.00, 13, '{}'),
  ('Bevande', 'Birra Theresianer media', 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&q=80', 3.50, 14, '{}'),
  ('Bevande', 'The Limone/Pesca', 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80', 2.00, 15, '{}'),
  ('Bevande', 'Coca Cola', 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=600&q=80', 2.00, 16, '{}'),
  ('Bevande', 'Fanta', 'https://images.unsplash.com/photo-1624517452488-04869289c4ca?auto=format&fit=crop&w=600&q=80', 2.00, 17, '{}'),
  ('Bevande', 'Ceres 0.33L', 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&q=80', 3.50, 18, '{}'),
  ('Bevande', 'Coca Cola Zero', 'https://images.unsplash.com/photo-1543253687-c931c8e01820?auto=format&fit=crop&w=600&q=80', 2.00, 19, '{}'),
  ('Bevande', 'Sprite', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', 2.00, 20, '{}'),
  ('Bevande', 'Vino Bianco Malvasia 1L', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80', 9.00, 21, '{}'),
  ('Bevande', 'Birra Theresianer piccola', 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&q=80', 2.50, 22, '{}'),
  ('Bevande', 'Prosecco Contarini', 'https://images.unsplash.com/photo-1578911373434-0cb395d2cbfb?auto=format&fit=crop&w=600&q=80', 10.00, 23, '{}'),
  ('Bevande', 'Moretti 0.66L', 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&q=80', 3.50, 24, '{}'),
  ('Bevande', 'Acqua nat/gas 0.50', 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=600&q=80', 1.00, 25, '{}'),
  ('Bevande', 'Vino Bianco Malvasia 1/2', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80', 4.50, 26, '{}');
-- Dolci (5)
INSERT INTO ambrosia_seed_products (
  category_name, name, description, price, display_order, ingredients
) VALUES
  ('Dolci', 'Profiterol', NULL, 4.00, 1, '{}'),
  ('Dolci', 'Tartufo Bianco / Nero', NULL, 4.00, 2, '{}'),
  ('Dolci', 'Tiramisù', NULL, 4.00, 3, '{}'),
  ('Dolci', 'Torroncino', NULL, 4.00, 4, '{}'),
  ('Dolci', 'Sorbetto al Limone', NULL, 2.00, 5, '{}');
-- Gourmet (7)
INSERT INTO ambrosia_seed_products (
  category_name, name, description, price, display_order, ingredients
) VALUES
  ('Gourmet', 'La Rustica', 'mozz.fior di latte, pancetta, stracchino, patate al forno', 11.00, 1, ARRAY['mozz.fior di latte', 'pancetta', 'stracchino', 'patate al forno']),
  ('Gourmet', 'La Zuccotta', 'crema di zucca, mozz.fior di latte, gorgonzola, pancetta, pepe nero', 11.00, 2, ARRAY['crema di zucca', 'mozz.fior di latte', 'gorgonzola', 'pancetta', 'pepe nero']),
  ('Gourmet', 'Ambrosia', 'mozz. di bufala, pomodorini, pesto alla genovese', 9.00, 3, ARRAY['mozz. di bufala', 'pomodorini', 'pesto alla genovese']),
  ('Gourmet', 'Carbonara', 'mozz. di bufala, pancetta, uovo, pepe nero', 10.00, 4, ARRAY['mozz. di bufala', 'pancetta', 'uovo', 'pepe nero']),
  ('Gourmet', 'Crudo e Burrata', 'pomodoro, mozz.fior di latte, fuori cottura: crudo di Parma, burrata Pugliese, olio', 11.00, 5, ARRAY['pomodoro', 'mozz.fior di latte', 'crudo di Parma', 'burrata Pugliese', 'olio']),
  ('Gourmet', 'Cantabrico', 'pomodoro, mozz.fior di latte, fuori cottura: acciughe del mar Cantabrico', 9.00, 6, ARRAY['pomodoro', 'mozz.fior di latte', 'acciughe del mar Cantabrico']),
  ('Gourmet', 'Bologna', 'Stria, fuori cottura: mortadella, straciatella, crema di pistacchio', 11.00, 7, ARRAY['Stria', 'mortadella', 'straciatella', 'crema di pistacchio']);
-- Gustose (13)
INSERT INTO ambrosia_seed_products (
  category_name, name, description, price, display_order, ingredients
) VALUES
  ('Gustose', 'Nord e Sud', 'pomodoro, mozz.fior di latte, ''nduja e gorgonzola', 8.00, 1, ARRAY['pomodoro', 'mozz.fior di latte', '''nduja e gorgonzola']),
  ('Gustose', 'Valtellina', 'pomodoro, mozz.fior di latte, bresaola, rucola, scaglie di grana', 9.00, 2, ARRAY['pomodoro', 'mozz.fior di latte', 'bresaola', 'rucola', 'scaglie di grana']),
  ('Gustose', 'La fumè', 'pomodoro, mozz.fior di latte, speck, scamorza affumicata', 8.50, 3, ARRAY['pomodoro', 'mozz.fior di latte', 'speck', 'scamorza affumicata']),
  ('Gustose', 'Vegetariana', 'pomodoro, mozz.fior di latte, melanzane, peperoni, zucchine', 8.00, 4, ARRAY['pomodoro', 'mozz.fior di latte', 'melanzane', 'peperoni', 'zucchine']),
  ('Gustose', 'Miami', 'pomodoro, mozz.fior di latte, gamberetti, zucchine', 8.00, 5, ARRAY['pomodoro', 'mozz.fior di latte', 'gamberetti', 'zucchine']),
  ('Gustose', 'La Corte Vecia', 'pomodoro, mozz.fior di latte, rucola, scaglie di grana, glassa di aceto balsamico', 7.50, 6, ARRAY['pomodoro', 'mozz.fior di latte', 'rucola', 'scaglie di grana', 'glassa di aceto balsamico']),
  ('Gustose', 'Canossa', 'pomodoro, mozz.fior di latte, prosciutto crudo di parma, rucola, scaglie di grana, glassa di aceto balsamico', 9.50, 7, ARRAY['pomodoro', 'mozz.fior di latte', 'prosciutto crudo di parma', 'rucola', 'scaglie di grana', 'glassa di aceto balsamico']),
  ('Gustose', 'Frutti di Mare', 'pomodoro, mozz.fior di latte, seppie, calamari, vongole, cozze, polpi, surimi', 9.00, 8, ARRAY['pomodoro', 'mozz.fior di latte', 'seppie', 'calamari', 'vongole', 'cozze', 'polpi', 'surimi']),
  ('Gustose', 'Amalfi', 'pomodoro, mozz.fior di latte, scamorza affumicata, pomodorini', 7.00, 9, ARRAY['pomodoro', 'mozz.fior di latte', 'scamorza affumicata', 'pomodorini']),
  ('Gustose', 'Trentina', 'pomodoro, mozz.fior di latte, gorgonzola, speck', 8.00, 10, ARRAY['pomodoro', 'mozz.fior di latte', 'gorgonzola', 'speck']),
  ('Gustose', 'Francescana', 'pomodoro, mozz.fior di latte, gorgonzola, porcini trifolati', 7.50, 11, ARRAY['pomodoro', 'mozz.fior di latte', 'gorgonzola', 'porcini trifolati']),
  ('Gustose', 'Tirolese', 'pomodoro, mozz.fior di latte e di bufala, porcini trifolati, speck', 9.00, 12, ARRAY['pomodoro', 'mozz.fior di latte e di bufala', 'porcini trifolati', 'speck']),
  ('Gustose', 'Matildica', 'pomodoro, mozz.fior di latte, funghi porcini trifolati, pomodorini, parmigiano reggiano', 8.00, 13, ARRAY['pomodoro', 'mozz.fior di latte', 'funghi porcini trifolati', 'pomodorini', 'parmigiano reggiano']);
-- Bianche (8)
INSERT INTO ambrosia_seed_products (
  category_name, name, description, price, display_order, ingredients
) VALUES
  ('Bianche', 'Buna', 'mozz.fior di latte, salsiccia, friarielli', 7.00, 1, ARRAY['mozz.fior di latte', 'salsiccia', 'friarielli']),
  ('Bianche', 'Tartufata', 'mozz.fior di latte, porcini, crema tartufata', 8.00, 2, ARRAY['mozz.fior di latte', 'porcini', 'crema tartufata']),
  ('Bianche', 'Messicana', 'mozz.fior di latte e di bufala, pancetta, olio piccante', 7.50, 3, ARRAY['mozz.fior di latte e di bufala', 'pancetta', 'olio piccante']),
  ('Bianche', 'Piccantina', 'mozz.fior di latte, spianata calabra, acciughe, friarielli', 8.00, 4, ARRAY['mozz.fior di latte', 'spianata calabra', 'acciughe', 'friarielli']),
  ('Bianche', 'Stria', NULL, 3.00, 5, '{}'),
  ('Bianche', 'Beach', 'mozz.fior di latte, rucola, pomodorini, gamberetti', 8.00, 6, ARRAY['mozz.fior di latte', 'rucola', 'pomodorini', 'gamberetti']),
  ('Bianche', 'Pizza del Centro', 'mozz.fior di latte, melanzane, zucchine, peperoni, pomodorini, porcini', 9.50, 7, ARRAY['mozz.fior di latte', 'melanzane', 'zucchine', 'peperoni', 'pomodorini', 'porcini']),
  ('Bianche', 'Gorgonzola e Noci', 'mozz.fior di latte, gorgonzola, noci', 8.00, 8, ARRAY['mozz.fior di latte', 'gorgonzola', 'noci']);
-- Classiche (21)
INSERT INTO ambrosia_seed_products (
  category_name, name, description, price, display_order, ingredients
) VALUES
  ('Classiche', 'Margherita', 'pomodoro, mozz.fior di latte', 5.00, 1, ARRAY['pomodoro', 'mozz.fior di latte']),
  ('Classiche', 'Romana', 'pomodoro, mozz.fior di latte, acciughe, capperi, origano, olive', 6.50, 2, ARRAY['pomodoro', 'mozz.fior di latte', 'acciughe', 'capperi', 'origano', 'olive']),
  ('Classiche', 'Marinara', 'pomodoro, aglio, origano', 4.50, 3, ARRAY['pomodoro', 'aglio', 'origano']),
  ('Classiche', 'Diavola', 'pomodoro, mozz.fior di latte, spianata calabra', 6.50, 4, ARRAY['pomodoro', 'mozz.fior di latte', 'spianata calabra']),
  ('Classiche', 'Stracchino e Rucola', 'pomodoro, mozz.fior di latte, stracchino, rucola', 7.50, 5, ARRAY['pomodoro', 'mozz.fior di latte', 'stracchino', 'rucola']),
  ('Classiche', 'Napoli', 'pomodoro, mozz.fior di latte, acciughe, origano', 6.00, 6, ARRAY['pomodoro', 'mozz.fior di latte', 'acciughe', 'origano']),
  ('Classiche', 'Calzone', 'pomodoro, mozz.fior di latte, prosciutto cotto', 6.00, 7, ARRAY['pomodoro', 'mozz.fior di latte', 'prosciutto cotto']),
  ('Classiche', 'Calzone farcito', 'pomodoro, mozz.fior di latte, prosciutto cotto, funghi', 6.50, 8, ARRAY['pomodoro', 'mozz.fior di latte', 'prosciutto cotto', 'funghi']),
  ('Classiche', 'Quattro Stagioni', 'pomodoro, mozz.fior di latte, prosciutto cotto, funghi, carciofi, salsiccia', 7.00, 9, ARRAY['pomodoro', 'mozz.fior di latte', 'prosciutto cotto', 'funghi', 'carciofi', 'salsiccia']),
  ('Classiche', 'Crudo di Parma', 'pomodoro, mozz.fior di latte, prosciutto crudo di Parma', 7.50, 10, ARRAY['pomodoro', 'mozz.fior di latte', 'prosciutto crudo di Parma']),
  ('Classiche', 'Pancetta', 'pomodoro, mozz.fior di latte, pancetta', 7.50, 11, ARRAY['pomodoro', 'mozz.fior di latte', 'pancetta']),
  ('Classiche', 'Prosciutto', 'pomodoro, mozz.fior di latte, prosciutto cotto', 6.00, 12, ARRAY['pomodoro', 'mozz.fior di latte', 'prosciutto cotto']),
  ('Classiche', 'Würstel', 'pomodoro, mozz.fior di latte, Würstel', 6.00, 13, ARRAY['pomodoro', 'mozz.fior di latte', 'Würstel']),
  ('Classiche', 'Speck', 'pomodoro, mozz.fior di latte, speck', 7.50, 14, ARRAY['pomodoro', 'mozz.fior di latte', 'speck']),
  ('Classiche', 'Funghi', 'pomodoro, mozz.fior di latte, funghi', 6.00, 15, ARRAY['pomodoro', 'mozz.fior di latte', 'funghi']),
  ('Classiche', 'Tonno', 'pomodoro, mozz.fior di latte, tonno', 6.00, 16, ARRAY['pomodoro', 'mozz.fior di latte', 'tonno']),
  ('Classiche', 'Salsiccia', 'pomodoro, mozz.fior di latte, salsiccia', 6.00, 17, ARRAY['pomodoro', 'mozz.fior di latte', 'salsiccia']),
  ('Classiche', 'Quattro Formaggi', 'pomodoro, mozz.fior di latte, pecorino, emmental, gorgonzola', 6.50, 18, ARRAY['pomodoro', 'mozz.fior di latte', 'pecorino', 'emmental', 'gorgonzola']),
  ('Classiche', 'Hanz', 'pomodoro, mozz.fior di latte, würstel, patatine fritte', 6.50, 19, ARRAY['pomodoro', 'mozz.fior di latte', 'würstel', 'patatine fritte']),
  ('Classiche', 'Capricciosa', 'pomodoro, mozz.fior di latte, prosciutto cotto, funghi, carciofi, salsiccia, olive', 7.50, 20, ARRAY['pomodoro', 'mozz.fior di latte', 'prosciutto cotto', 'funghi', 'carciofi', 'salsiccia', 'olive']),
  ('Classiche', 'Speciale', 'pomodoro, mozz.fior di latte di bufala, pomodorini, basilico', 7.00, 21, ARRAY['pomodoro', 'mozz.fior di latte di bufala', 'pomodorini', 'basilico']);
-- Al metro (5)
INSERT INTO ambrosia_seed_products (
  category_name, name, description, price, display_order, ingredients
) VALUES
  ('Al metro', 'Margherita', NULL, 13.00, 1, '{}'),
  ('Al metro', 'Metà Margherita Metà Farcita', NULL, 16.00, 2, '{}'),
  ('Al metro', 'Super Farcita', NULL, 20.00, 3, '{}'),
  ('Al metro', 'Gourmet', NULL, 22.00, 4, '{}'),
  ('Al metro', 'Farcita', NULL, 18.00, 5, '{}');

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
  id, category_id, company_id, name, description, price, active, display_order, ingredients, image_url
)
SELECT
  md5('ambrosia:product:' || seed.category_name || ':' || seed.name)::uuid,
  md5('ambrosia:category:' || seed.category_name)::uuid,
  context.company_id,
  seed.name,
  seed.description,
  seed.price,
  true,
  seed.display_order,
  seed.ingredients,
  seed.image_url
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
  image_url = COALESCE(EXCLUDED.image_url, public.products.image_url),
  updated_at = now();

DO $$
DECLARE
  active_category_count integer;
  active_product_count integer;
BEGIN
  SELECT count(*) INTO active_category_count
  FROM public.categories
  WHERE company_id = (SELECT company_id FROM ambrosia_seed_context) AND active;

  SELECT count(*) INTO active_product_count
  FROM public.products
  WHERE company_id = (SELECT company_id FROM ambrosia_seed_context) AND active;

  IF active_category_count <> 7 THEN
    RAISE EXCEPTION 'Seed fallito: attese 7 categorie attive, trovate %', active_category_count;
  END IF;
  IF active_product_count <> 85 THEN
    RAISE EXCEPTION 'Seed fallito: attesi 85 prodotti attivi, trovati %', active_product_count;
  END IF;
END
$$;

COMMIT;
