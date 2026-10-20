-- Fixture for tests/sql/security-definer-grants.sql. Disposable local DB only (PGlite).
-- Runs after the atomic-order + antiabuse chain and adds the SECURITY DEFINER
-- functions that chain does not define, with the same signatures and the same
-- wide-open grants they have on the hosted project (PUBLIC + anon + authenticated).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.secdef_trigger_probe(id int PRIMARY KEY, handled text, updated_at timestamptz);
GRANT SELECT, INSERT, UPDATE ON public.secdef_trigger_probe TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.add_to_fiscal_retry_queue(p_order_id uuid, p_provider varchar, p_error_message text, p_error_code varchar)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT gen_random_uuid() $$;
CREATE OR REPLACE FUNCTION public.log_fiscal_event(p_order_id uuid, p_action varchar, p_provider varchar, p_external_id text,
  p_request_data jsonb, p_response_data jsonb, p_status varchar, p_error_message text, p_error_code varchar, p_processing_time_ms integer)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT gen_random_uuid() $$;
CREATE OR REPLACE FUNCTION public.process_fiscal_retry_queue(p_batch_size integer DEFAULT 10)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT 0 $$;
CREATE OR REPLACE FUNCTION public.reserve_order_display_code(p_company_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT 'A #1' $$;
-- get_capacity_snapshot and get_order_tracking come from 20260610_tighten_orders_rls_tracking_rpc.sql.
CREATE OR REPLACE FUNCTION public.get_shift_dough_usage(p_company uuid, p_since timestamptz)
RETURNS numeric LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT 0::numeric $$;
-- Trigger functions (prod: handle_new_user on auth.users, the others on orders / fiscal tables).
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.handled := 'handle_new_user'; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.orders_set_display_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.update_fiscal_tables_updated_at() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS probe_handle_new_user ON public.secdef_trigger_probe;
CREATE TRIGGER probe_handle_new_user BEFORE INSERT ON public.secdef_trigger_probe FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
DROP TRIGGER IF EXISTS probe_updated_at ON public.secdef_trigger_probe;
CREATE TRIGGER probe_updated_at BEFORE UPDATE ON public.secdef_trigger_probe FOR EACH ROW EXECUTE FUNCTION public.update_fiscal_tables_updated_at();

-- Reproduce the hosted grants (Supabase default privileges: PUBLIC + anon + authenticated).
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname IN ('add_to_fiscal_retry_queue','log_fiscal_event','process_fiscal_retry_queue','reserve_order_display_code',
      'get_capacity_snapshot','get_shift_dough_usage','handle_new_user','orders_set_display_code','update_fiscal_tables_updated_at',
      'is_admin','get_my_company_id','can_insert_order_item','get_order_tracking','is_valid_order_transition')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC, anon, authenticated, service_role', f);
  END LOOP;
END $$;
SELECT 'fixture ready' AS status;
