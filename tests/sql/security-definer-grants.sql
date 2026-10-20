-- Runs after security-definer-grants-schema.sql + 20261020120000_security_definer_grants.sql.
-- Disposable local DB only.
CREATE OR REPLACE FUNCTION pg_temp.check_exec(p_sig text, p_role text, p_expected boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF has_function_privilege(p_role, p_sig::regprocedure, 'EXECUTE') IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'EXECUTE on % for %: expected %', p_sig, p_role, p_expected;
  END IF;
END $$;

-- 1) Grant matrix (has_function_privilege includes what PUBLIC grants).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public.add_to_fiscal_retry_queue(uuid, character varying, text, character varying)', false, false),
    ('public.log_fiscal_event(uuid, character varying, character varying, text, jsonb, jsonb, character varying, text, character varying, integer)', false, false),
    ('public.process_fiscal_retry_queue(integer)', false, false),
    ('public.handle_new_user()', false, false),
    ('public.orders_set_display_code()', false, false),
    ('public.update_fiscal_tables_updated_at()', false, false),
    ('public.reserve_order_display_code(uuid)', false, true),
    ('public.get_capacity_snapshot(uuid, timestamp with time zone, timestamp with time zone)', false, true),
    ('public.get_shift_dough_usage(uuid, timestamp with time zone)', false, true),
    ('public.assert_order_antiabuse(uuid, numeric)', false, true),
    ('public.create_order_with_items(jsonb, jsonb)', false, true),
    ('public.mark_order_no_show(uuid, text)', false, true),
    ('public.set_customer_blocked(uuid, boolean, text)', false, true),
    ('public.is_admin()', true, true),
    ('public.get_my_company_id()', true, true),
    ('public.can_insert_order_item(uuid)', true, true),
    ('public.get_order_tracking(uuid)', true, true)
  ) AS t(sig, anon_ok, auth_ok)
  LOOP
    PERFORM pg_temp.check_exec(r.sig, 'anon', r.anon_ok);
    PERFORM pg_temp.check_exec(r.sig, 'authenticated', r.auth_ok);
    PERFORM pg_temp.check_exec(r.sig, 'service_role', true);
    IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
               WHERE p.oid = r.sig::regprocedure AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
      RAISE EXCEPTION 'PUBLIC still has EXECUTE on %', r.sig;
    END IF;
  END LOOP;
END $$;

-- 2) Every SECURITY DEFINER function in public that anon can execute is on the allow-list.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO bad
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname NOT IN ('is_admin','get_my_company_id','can_insert_order_item','get_order_tracking');
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'anon can still execute SECURITY DEFINER: %', bad; END IF;
END $$;

-- 3) Real calls as anon fail with insufficient_privilege.
SET ROLE anon;
DO $$
DECLARE q text;
BEGIN
  FOREACH q IN ARRAY ARRAY[
    'SELECT public.process_fiscal_retry_queue(1)',
    'SELECT public.log_fiscal_event(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)',
    'SELECT public.add_to_fiscal_retry_queue(NULL,NULL,NULL,NULL)',
    'SELECT public.reserve_order_display_code(NULL)',
    'SELECT * FROM public.get_capacity_snapshot(NULL,NULL,NULL)',
    'SELECT public.get_shift_dough_usage(NULL,NULL)',
    'SELECT public.create_order_with_items(''{}''::jsonb, ''[]''::jsonb)'
  ] LOOP
    BEGIN
      EXECUTE q;
      RAISE EXCEPTION 'anon could run: %', q;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  -- kept for anon (RLS policies / tracking link)
  PERFORM public.is_admin();
  PERFORM public.get_my_company_id();
  PERFORM public.get_order_tracking('00000000-0000-0000-0000-000000000000');
END $$;
RESET ROLE;

-- 4) authenticated: fiscal functions locked, client RPCs still callable.
SET ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.process_fiscal_retry_queue(1);
    RAISE EXCEPTION 'authenticated could run process_fiscal_retry_queue';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM public.reserve_order_display_code('00000000-0000-0000-0000-000000000001');
  PERFORM public.get_shift_dough_usage('00000000-0000-0000-0000-000000000001', now());
  PERFORM * FROM public.get_capacity_snapshot('00000000-0000-0000-0000-000000000001', now(), now());
  PERFORM public.is_admin();
END $$;
-- Trigger functions still fire for a role without EXECUTE on them.
INSERT INTO public.secdef_trigger_probe(id) VALUES (1);
UPDATE public.secdef_trigger_probe SET id = 1 WHERE id = 1;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT handled FROM public.secdef_trigger_probe WHERE id = 1) IS DISTINCT FROM 'handle_new_user'
     OR (SELECT updated_at FROM public.secdef_trigger_probe WHERE id = 1) IS NULL THEN
    RAISE EXCEPTION 'trigger functions did not fire';
  END IF;
END $$;

-- 5) search_path pinned on is_valid_order_transition (and no mutable search_path left in public).
DO $$
DECLARE bad text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.is_valid_order_transition(text, text)'::regprocedure
                 AND 'search_path=public' = ANY(proconfig)) THEN
    RAISE EXCEPTION 'is_valid_order_transition search_path not set';
  END IF;
  IF NOT public.is_valid_order_transition('pending', 'accepted') OR public.is_valid_order_transition('pending', 'ready') THEN
    RAISE EXCEPTION 'is_valid_order_transition behaviour changed';
  END IF;
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO bad FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
    AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
    AND p.proname IN ('is_valid_order_transition','enforce_order_manual_approval','prevent_empty_order_acceptance',
      'create_order_with_items','assert_order_antiabuse','mark_order_no_show','set_customer_blocked','can_insert_order_item','get_order_tracking');
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'mutable search_path: %', bad; END IF;
END $$;
SELECT 'PASS: security definer grants + search_path' AS result;
