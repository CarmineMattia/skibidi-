-- Security advisor: anon/authenticated_security_definer_function_executable
-- + function_search_path_mutable.
--
-- Postgres grants EXECUTE to PUBLIC by default, and Supabase also grants it
-- to anon/authenticated explicitly, so for every SECURITY DEFINER function in
-- public we revoke EXECUTE from PUBLIC, anon and authenticated and grant it
-- back only to the roles the app really needs. service_role (edge functions,
-- backend jobs) and the owner keep EXECUTE.
--
-- Trigger functions (handle_new_user, orders_set_display_code,
-- update_fiscal_tables_updated_at) need no grant: EXECUTE is checked only at
-- CREATE TRIGGER time, not when the trigger fires.
--
-- Functions used inside RLS policies (is_admin, get_my_company_id,
-- can_insert_order_item) or called by SECURITY INVOKER functions/triggers
-- (create_order_with_items -> get_order_tracking + assert_order_antiabuse,
-- enforce_order_manual_approval -> is_admin) stay executable by the roles
-- that evaluate them, otherwise those queries fail with "permission denied".
--
-- Idempotent; a function missing in this database is skipped with a NOTICE.
-- Mapping and evidence: see the PR description.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- service_role only: no client / policy usage
      ('public.add_to_fiscal_retry_queue(uuid, character varying, text, character varying)', NULL),
      ('public.log_fiscal_event(uuid, character varying, character varying, text, jsonb, jsonb, character varying, text, character varying, integer)', NULL),
      ('public.process_fiscal_retry_queue(integer)', NULL),
      -- trigger functions
      ('public.handle_new_user()', NULL),
      ('public.orders_set_display_code()', NULL),
      ('public.update_fiscal_tables_updated_at()', NULL),
      -- logged-in clients only (checkout / admin)
      ('public.reserve_order_display_code(uuid)', 'authenticated'),
      ('public.get_capacity_snapshot(uuid, timestamp with time zone, timestamp with time zone)', 'authenticated'),
      ('public.get_shift_dough_usage(uuid, timestamp with time zone)', 'authenticated'),
      ('public.assert_order_antiabuse(uuid, numeric)', 'authenticated'),
      ('public.create_order_with_items(jsonb, jsonb)', 'authenticated'),
      ('public.mark_order_no_show(uuid, text)', 'authenticated'),
      ('public.set_customer_blocked(uuid, boolean, text)', 'authenticated'),
      -- RLS policy helpers / guest order tracking: anon must keep them
      ('public.is_admin()', 'anon, authenticated'),
      ('public.get_my_company_id()', 'anon, authenticated'),
      ('public.can_insert_order_item(uuid)', 'anon, authenticated'),
      ('public.get_order_tracking(uuid)', 'anon, authenticated')
    ) AS t(sig, grantees)
  LOOP
    IF to_regprocedure(r.sig) IS NULL THEN
      RAISE NOTICE 'security_definer_grants: % not found, skipped', r.sig;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END IF;
    IF r.grantees IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %s', r.sig, r.grantees);
    END IF;
  END LOOP;
END $$;

-- function_search_path_mutable
DO $$
BEGIN
  IF to_regprocedure('public.is_valid_order_transition(text, text)') IS NOT NULL THEN
    ALTER FUNCTION public.is_valid_order_transition(text, text) SET search_path = public;
  END IF;
END $$;
