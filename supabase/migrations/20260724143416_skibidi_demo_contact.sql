-- Contatti di esempio del tenant demo.
-- Registrata su prod come versione 20260724143416 (skibidi_demo_contact); il file non era nel repo, qui è ricostruito
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
    RAISE NOTICE '20260724143416 skibidi_demo_contact: tabelle assenti, salto';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = '00000000-0000-0000-0000-000000000001')
     OR EXISTS (SELECT 1 FROM public.companies WHERE id = '00000000-0000-0000-0000-000000000001' AND name = 'Pizzeria Ambrosia') THEN
    RAISE NOTICE '20260724143416 skibidi_demo_contact: tenant assente o già Pizzeria Ambrosia, salto';
    RETURN;
  END IF;
  EXECUTE $q$
UPDATE companies
SET settings = jsonb_set(
  settings,
  '{branding,contact}',
  jsonb_build_object(
    'address', 'Via Demo 1, 00100 Roma (RM)',
    'city', 'Roma',
    'phone', '06 1234 567',
    'phoneHref', 'tel:+39061234567',
    'whatsappHref', 'https://wa.me/39061234567',
    'mapsUrl', 'https://www.google.com/maps/search/?api=1&query=Via+Demo+1+Roma',
    'website', 'https://demo.skibidiorders.com',
    'vatNumber', 'P.IVA 00000000000'
  )
)
WHERE id = '00000000-0000-0000-0000-000000000001';
$q$;
END
$mig$;
