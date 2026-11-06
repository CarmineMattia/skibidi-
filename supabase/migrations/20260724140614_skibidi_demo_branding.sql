-- Branding del tenant demo "Skibidi Kitchen".
-- Registrata su prod come versione 20260724140614 (skibidi_demo_branding); il file non era nel repo, qui è ricostruito
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
  IF to_regclass('public.companies') IS NULL THEN
    RAISE NOTICE '20260724140614 skibidi_demo_branding: tabelle assenti, salto';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = '00000000-0000-0000-0000-000000000001')
     OR EXISTS (SELECT 1 FROM public.companies WHERE id = '00000000-0000-0000-0000-000000000001' AND name = 'Pizzeria Ambrosia') THEN
    RAISE NOTICE '20260724140614 skibidi_demo_branding: tenant assente o già Pizzeria Ambrosia, salto';
    RETURN;
  END IF;
  EXECUTE $q$
UPDATE companies
SET
  name = 'Skibidi Kitchen',
  slug = 'demo',
  settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
    'branding', jsonb_build_object(
      'onboardingCompleted', true,
      'isDemo', true,
      'tagline', 'Ordina. Ritira. A tavola.',
      'description', 'Ristorante demo della piattaforma Skibidi Orders.',
      'story', 'Questo è il locale dimostrativo di Skibidi Orders: usalo per esplorare menu, ordini e cucina.',
      'logoUrl', null,
      'colors', jsonb_build_object(
        'primary', '#1F4B3A',
        'primaryForeground', '#FFFFFF',
        'background', '#F4F7F5',
        'accent', '#E8A838',
        'foreground', '#14201C'
      ),
      'contact', jsonb_build_object(
        'address', '',
        'city', '',
        'phone', '',
        'phoneHref', '',
        'whatsappHref', '',
        'mapsUrl', '',
        'website', '',
        'vatNumber', ''
      ),
      'social', jsonb_build_object(),
      'media', jsonb_build_object(
        'heroImageUrl', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200&q=80',
        'galleryImageUrls', jsonb_build_array(
          'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80',
          'https://images.unsplash.com/photo-1548369937-47519962c11a?w=800&q=80',
          'https://images.unsplash.com/photo-1544982503-9f984c14501a?w=800&q=80'
        )
      ),
      'seo', jsonb_build_object(
        'titleTemplate', '{name} | Ordina online',
        'description', 'Ordina online in pochi tap.',
        'ogImageUrl', null
      )
    )
  )
WHERE id = '00000000-0000-0000-0000-000000000001';
$q$;
END
$mig$;
