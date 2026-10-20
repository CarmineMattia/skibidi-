-- Fixture aggiuntiva per i test antiabuso. Solo DB locale usa-e-getta (PGlite/Postgres).
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
-- Come Supabase: il ruolo della richiesta, non l'owner di una funzione SECURITY DEFINER.
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('role', true), 'none') $$;
CREATE TABLE IF NOT EXISTS public.profiles(id uuid PRIMARY KEY, role text DEFAULT 'customer', company_id uuid);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon, authenticated;
