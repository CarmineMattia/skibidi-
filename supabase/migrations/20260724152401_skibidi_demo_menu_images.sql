-- Foto Unsplash e nome di una pizza per il menu demo.
-- Registrata su prod come versione 20260724152401 (skibidi_demo_menu_images); il file non era nel repo, qui è ricostruito
-- dalla riga di supabase_migrations.schema_migrations (sola lettura, 2026-10-29).
--
-- ATTENZIONE: migrazione di DATI per il tenant demo (id 00000000-0000-0000-0000-000000000001). Su prod quella riga è
-- oggi "Pizzeria Ambrosia", quindi il testo originale, rieseguito, ne cancellerebbe nome,
-- branding, foto e prodotti. Per questo il corpo originale è protetto da due guardie
-- e diventa un no-op quando:
--   * le tabelle non esistono (database nuovo/PGlite senza schema base), oppure
--   * il tenant non esiste, oppure è già "Pizzeria Ambrosia".
-- Su prod la versione è già registrata e non viene rieseguita.
DO $mig$
BEGIN
  IF to_regclass('public.companies') IS NULL OR to_regclass('public.products') IS NULL OR to_regclass('public.categories') IS NULL THEN
    RAISE NOTICE '20260724152401 skibidi_demo_menu_images: tabelle assenti, salto';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = '00000000-0000-0000-0000-000000000001')
     OR EXISTS (SELECT 1 FROM public.companies WHERE id = '00000000-0000-0000-0000-000000000001' AND name = 'Pizzeria Ambrosia') THEN
    RAISE NOTICE '20260724152401 skibidi_demo_menu_images: tenant assente o già Pizzeria Ambrosia, salto';
    RETURN;
  END IF;
  EXECUTE $q$
UPDATE products
SET name = 'Bufala e Pesto'
WHERE company_id = '00000000-0000-0000-0000-000000000001'
  AND name = 'Ambrosia';

WITH pizza_photos(idx, url) AS (
  VALUES
    (0, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80'),
    (1, 'https://images.unsplash.com/photo-1548369937-47519962c11a?auto=format&fit=crop&w=600&q=80'),
    (2, 'https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&w=600&q=80'),
    (3, 'https://images.unsplash.com/photo-1600628421066-f6bda6a7b976?auto=format&fit=crop&w=600&q=80'),
    (4, 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80'),
    (5, 'https://images.unsplash.com/photo-1542834369-f10ebf06d3e0?auto=format&fit=crop&w=600&q=80')
),
numbered_products AS (
  SELECT
    p.id,
    (row_number() OVER (ORDER BY p.id) - 1) % 6 AS idx
  FROM products p
  JOIN categories cat ON cat.id = p.category_id
  WHERE cat.company_id = '00000000-0000-0000-0000-000000000001'
    AND cat.name IN ('Al Metro', 'Crea la tua pizza', 'Pizze Bianche', 'Pizze Gustose')
)
UPDATE products
SET image_url = pizza_photos.url
FROM numbered_products
JOIN pizza_photos ON pizza_photos.idx = numbered_products.idx
WHERE products.id = numbered_products.id;

UPDATE products
SET image_url = 'https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=600&q=80'
WHERE company_id = '00000000-0000-0000-0000-000000000001'
  AND category_id = (
    SELECT id FROM categories
    WHERE company_id = '00000000-0000-0000-0000-000000000001' AND name = 'Bevande'
  );

UPDATE products
SET image_url = 'https://images.unsplash.com/photo-1594007654729-407eedc4fe0f?auto=format&fit=crop&w=600&q=80'
WHERE company_id = '00000000-0000-0000-0000-000000000001'
  AND category_id = (
    SELECT id FROM categories
    WHERE company_id = '00000000-0000-0000-0000-000000000001' AND name = 'Piadine'
  );
$q$;
END
$mig$;
