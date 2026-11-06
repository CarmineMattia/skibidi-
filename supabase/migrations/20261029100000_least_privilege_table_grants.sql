-- Privilegi minimi su anon/authenticated nello schema public.
-- Migration solo nella PR: applicarla a prod solo con l'OK di Carmine.
--
-- Situazione letta (sola lettura) su prod il 2026-10-29:
--  * anon e authenticated hanno MAINTAIN (PostgreSQL 17+: VACUUM, ANALYZE,
--    CLUSTER, REINDEX, REFRESH MATERIALIZED VIEW, LOCK TABLE) su tutte le tabelle
--    di public. La migration 20261020130000 aveva tolto TRUNCATE/TRIGGER/REFERENCES
--    ma non MAINTAIN, che e' nato con PG17.
--  * anon ha ancora INSERT/UPDATE/DELETE su categories, companies, products,
--    profiles, fiscal_audit_log, fiscal_retry_queue, order_daily_counters,
--    order_no_shows. Oggi le policy RLS li fermano (is_admin() / auth.uid() sono
--    NULL per anon), ma e' una difesa in meno: bastera' una policy scritta male.
--  * anon ha SELECT su orders, order_items, profiles, tabelle fiscali: le policy
--    non restituiscono mai righe ad anon (il tracking ospite passa da
--    get_order_tracking, SECURITY DEFINER).
--  * i privilegi di default (pg_default_acl) per gli oggetti creati da postgres in
--    public continuano a dare a anon/authenticated "arwdm" sulle nuove tabelle e
--    "rwU" sulle nuove sequence.
--
-- Cosa fa:
--  1. per ogni tabella nota imposta ESATTAMENTE i privilegi che servono, ricavati
--     dalle policy RLS (nessuna policy per un comando = privilegio inutile):
--     la tabella qui sotto e' la fonte. REVOKE ALL e poi GRANT, nella stessa
--     transazione della migration: nessuna finestra senza permessi.
--  2. per le tabelle non elencate (future o locali) toglie solo MAINTAIN.
--  3. sequence esistenti: anon non ha nulla; authenticated solo USAGE.
--  4. default privileges: le nuove tabelle/sequence di public non danno piu' nulla
--     a anon; ad authenticated solo USAGE sulle sequence. Ogni migration futura che
--     crea una tabella usata dal client deve fare il suo GRANT esplicito.
--     (Chi crea oggetti come supabase_admin: vedi punto 5.)
--  5. se il ruolo che esegue e' membro di supabase_admin, tocca anche i suoi
--     default in public; altrimenti li lascia (postgres, su Supabase hosted, non puo'
--     cambiarli: resta da fare col supporto Supabase se serve).
--
-- Non tocca: service_role, policy RLS, funzioni (EXECUTE: gia' sistemato da
-- 20261020120000 e 20261020130000), schema storage/auth/realtime.
--
-- Idempotente: si puo' rieseguire. Tabelle assenti (DB locale/PGlite) sono saltate.

DO $$
DECLARE
  r record;
  t regclass;
  known text[] := ARRAY[]::text[];
BEGIN
  -- tabella, privilegi anon, privilegi authenticated
  FOR r IN SELECT * FROM (VALUES
    ('categories',            'SELECT', 'SELECT, INSERT, UPDATE, DELETE'),  -- menu pubblico; staff gestisce
    ('companies',             'SELECT', 'SELECT, UPDATE'),                  -- branding pubblico; staff aggiorna
    ('products',              'SELECT', 'SELECT, INSERT, UPDATE, DELETE'),  -- menu pubblico; staff gestisce
    ('menu_pricing',          'SELECT', 'SELECT'),                          -- policy menu_pricing_read
    ('orders',                '',       'SELECT, INSERT, UPDATE, DELETE'),  -- ospiti: solo RPC get_order_tracking
    ('order_items',           '',       'SELECT, INSERT'),                  -- niente update/delete: nessuna policy
    ('profiles',              '',       'SELECT, INSERT, UPDATE, DELETE'),
    ('customer_restrictions', '',       'SELECT'),
    ('order_no_shows',        '',       'SELECT'),
    ('fiscal_audit_log',      '',       'SELECT, INSERT, UPDATE'),          -- niente delete: nessuna policy
    ('fiscal_retry_queue',    '',       'SELECT, INSERT, UPDATE, DELETE'),
    ('order_daily_counters',  '',       ''),                                -- solo funzioni SECURITY DEFINER
    ('order_captcha_passes',  '',       ''),                                -- solo service_role
    ('order_receipt_claims',  '',       '')                                 -- solo service_role
  ) AS m(tbl, anon_privs, auth_privs) ORDER BY tbl LOOP
    known := known || r.tbl;
    t := to_regclass('public.' || quote_ident(r.tbl));
    CONTINUE WHEN t IS NULL;
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', t);
    IF r.anon_privs <> '' THEN
      EXECUTE format('GRANT %s ON TABLE %s TO anon', r.anon_privs, t);
    END IF;
    IF r.auth_privs <> '' THEN
      EXECUTE format('GRANT %s ON TABLE %s TO authenticated', r.auth_privs, t);
    END IF;
  END LOOP;

  -- Tabelle non elencate: almeno MAINTAIN fuori (esiste solo da PG17).
  IF current_setting('server_version_num')::int >= 170000 THEN
    FOR t IN SELECT c.oid::regclass FROM pg_class c
             WHERE c.relnamespace = 'public'::regnamespace
               AND c.relkind IN ('r', 'p')
               AND c.relname <> ALL (known)
    LOOP
      EXECUTE format('REVOKE MAINTAIN ON TABLE %s FROM PUBLIC, anon, authenticated', t);
    END LOOP;
  END IF;

  -- Sequence esistenti.
  FOR t IN SELECT c.oid::regclass FROM pg_class c
           WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'S'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO authenticated', t);
  END LOOP;
END $$;

-- Default privileges per gli oggetti creati da postgres (il proprietario delle migration).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Default di supabase_admin in public: solo se il ruolo corrente puo' cambiarli.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin')
     AND pg_has_role(current_user, 'supabase_admin', 'MEMBER') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
  ELSE
    RAISE NOTICE 'default privileges di supabase_admin in public non modificati (ruolo % non e'' membro)', current_user;
  END IF;
END $$;

-- order_daily_counters: solo le funzioni SECURITY DEFINER (reserve_order_display_code,
-- owner postgres) la toccano. RLS accesa, nessuna policy (qualunque policy rimasta viene
-- tolta), nessun grant ad anon/authenticated (sopra). FORCE RLS non serve: l'owner
-- postgres ha BYPASSRLS e forzarla non cambierebbe nulla per i client.
ALTER TABLE public.order_daily_counters ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'order_daily_counters' LOOP
    EXECUTE format('DROP POLICY %I ON public.order_daily_counters', p.policyname);
  END LOOP;
END $$;

-- products_select (punto 10 del QA): un utente loggato leggeva anche i prodotti spenti
-- (active = false) delle aziende attive. Ora tutti (anon e clienti) vedono solo i prodotti
-- attivi di aziende attive; i prodotti spenti li vede solo l'admin della propria azienda
-- (dashboard e modifica prodotti). Le RPC di ordine/prezzo sono SECURITY DEFINER e non
-- dipendono da questa policy.
DROP POLICY IF EXISTS products_select ON public.products;
CREATE POLICY products_select ON public.products
  FOR SELECT
  USING (
    (active AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = products.company_id AND c.active))
    OR (company_id = (SELECT public.get_my_company_id()) AND (SELECT public.is_admin()))
  );
