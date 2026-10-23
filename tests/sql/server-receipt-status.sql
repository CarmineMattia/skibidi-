-- AFTER 20261023100000_server_side_receipt_status.sql. Disposable local DB only.
-- Receipt / fiscal status: customers (and anon) can never write it; an admin of
-- the company and the server (service_role) can.
CREATE OR REPLACE FUNCTION pg_temp.refused(q text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  BEGIN
    EXECUTE q;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RETURN; END IF;                       -- RLS: no updatable row
  EXCEPTION
    WHEN insufficient_privilege THEN RETURN;            -- no grant / RLS check
    WHEN raise_exception THEN
      IF SQLERRM <> 'Only an admin can change order status, ownership, or total' THEN RAISE; END IF;
      RETURN;
  END;
  RAISE EXCEPTION 'Expected refusal: % (% rows)', label, n;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.refused(text, text) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION pg_temp.fiscal(p uuid) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', fiscal_status::text, fiscal_external_id, pdf_url) FROM public.orders WHERE id = p $$;
CREATE OR REPLACE FUNCTION pg_temp.assert_untouched(label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pg_temp.fiscal('00000000-0000-0000-0000-000000000101') <> 'pending'
     OR pg_temp.fiscal('00000000-0000-0000-0000-000000000102') <> 'pending'
     OR pg_temp.fiscal('00000000-0000-0000-0000-000000000103') <> 'pending' THEN
    RAISE EXCEPTION 'receipt status changed by %: % / % / %', label,
      pg_temp.fiscal('00000000-0000-0000-0000-000000000101'),
      pg_temp.fiscal('00000000-0000-0000-0000-000000000102'),
      pg_temp.fiscal('00000000-0000-0000-0000-000000000103');
  END IF;
END $$;
SELECT pg_temp.seed();

-- 1) Customer c1 on their OWN order, during the pending window: refused.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
SET test.staff = 'false';
SET test.company_id = '00000000-0000-0000-0000-000000000001';
DO $$ DECLARE q text; BEGIN
  FOREACH q IN ARRAY ARRAY[
    -- what the app used to send right after checkout
    $q$UPDATE orders SET fiscal_status = 'success', fiscal_external_id = 'RT-1', pdf_url = 'https://example.invalid/r.pdf' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET fiscal_status = 'success' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET fiscal_status = 'error' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET fiscal_external_id = 'RT-FAKE' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET pdf_url = 'https://evil.invalid/r.pdf' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET fiscal_status = 'success', updated_at = now() WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET fiscal_status = 'success'$q$,
    -- guest order and other company
    $q$UPDATE orders SET fiscal_status = 'success' WHERE id = '00000000-0000-0000-0000-000000000102'$q$,
    $q$UPDATE orders SET fiscal_status = 'success' WHERE id = '00000000-0000-0000-0000-000000000103'$q$,
    -- everything else stays locked as before (20261020160000)
    $q$UPDATE orders SET order_type = 'delivery' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET status = 'cancelled' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET total_amount = 0.01 WHERE id = '00000000-0000-0000-0000-000000000101'$q$
  ] LOOP
    PERFORM pg_temp.refused(q, q);
  END LOOP;
END $$;
RESET ROLE;
SELECT pg_temp.assert_untouched('customer');

-- 1b) Same customer, if the policy were still the old one (customer_id = auth.uid()):
--     the trigger alone refuses the receipt outcome (defence in depth).
DROP POLICY orders_update ON public.orders;
CREATE POLICY orders_update ON public.orders FOR UPDATE TO authenticated
  USING ((public.is_admin() AND company_id = public.get_my_company_id()) OR (auth.uid() = customer_id))
  WITH CHECK ((public.is_admin() AND company_id = public.get_my_company_id()) OR (auth.uid() = customer_id));
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
SET test.staff = 'false';
DO $$ BEGIN
  BEGIN
    UPDATE orders SET fiscal_status = 'success', fiscal_external_id = 'RT-1' WHERE id = '00000000-0000-0000-0000-000000000101';
    RAISE EXCEPTION 'trigger let the customer write the receipt';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Only an admin can change order status, ownership, or total' THEN RAISE; END IF;
  END;
  -- a harmless no-op / updated_at-only write is still accepted by the trigger
  UPDATE orders SET updated_at = now() WHERE id = '00000000-0000-0000-0000-000000000101';
END $$;
RESET ROLE;
SELECT pg_temp.assert_untouched('customer with old policy');
-- restore the migration's policy
DROP POLICY orders_update ON public.orders;
CREATE POLICY orders_update ON public.orders FOR UPDATE TO authenticated
  USING (public.is_admin() AND company_id = public.get_my_company_id())
  WITH CHECK (public.is_admin() AND company_id = public.get_my_company_id());

-- 2) anon (guest without session): refused.
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SET test.staff = 'false';
SELECT pg_temp.refused($q$UPDATE orders SET fiscal_status = 'success' WHERE id = '00000000-0000-0000-0000-000000000102'$q$, 'anon guest receipt');
SELECT pg_temp.refused($q$UPDATE orders SET fiscal_status = 'success'$q$, 'anon receipt without WHERE');
RESET ROLE;
SELECT pg_temp.assert_untouched('anon');

-- 3) Admin of company 1 (staff at the till): can record the receipt on own company orders only.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
SET test.staff = 'true';
SET test.company_id = '00000000-0000-0000-0000-000000000001';
UPDATE orders SET fiscal_status = 'success', fiscal_external_id = 'RT-ADMIN', pdf_url = 'https://example.invalid/admin.pdf'
 WHERE id = '00000000-0000-0000-0000-000000000101';
-- retry panel: error → success
UPDATE orders SET fiscal_status = 'error' WHERE id = '00000000-0000-0000-0000-000000000102';
UPDATE orders SET fiscal_status = 'success', fiscal_external_id = 'RT-RETRY' WHERE id = '00000000-0000-0000-0000-000000000102';
SELECT pg_temp.refused($q$UPDATE orders SET fiscal_status = 'success' WHERE id = '00000000-0000-0000-0000-000000000103'$q$, 'admin other company receipt');
RESET ROLE;
DO $$ BEGIN
  IF pg_temp.fiscal('00000000-0000-0000-0000-000000000101') <> 'success|RT-ADMIN|https://example.invalid/admin.pdf'
     OR pg_temp.fiscal('00000000-0000-0000-0000-000000000102') <> 'success|RT-RETRY'
     OR pg_temp.fiscal('00000000-0000-0000-0000-000000000103') <> 'pending' THEN
    RAISE EXCEPTION 'admin receipt path: % / % / %', pg_temp.fiscal('00000000-0000-0000-0000-000000000101'),
      pg_temp.fiscal('00000000-0000-0000-0000-000000000102'), pg_temp.fiscal('00000000-0000-0000-0000-000000000103');
  END IF;
END $$;

-- 4) Server path: service_role (edge function / POS integration, bypasses RLS as on Supabase).
SELECT pg_temp.seed();
SET ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', false);
SET test.staff = 'false';
UPDATE orders SET fiscal_status = 'success', fiscal_external_id = 'RT-SRV' WHERE id = '00000000-0000-0000-0000-000000000103';
RESET ROLE;
-- and a SECURITY DEFINER function owned by the owner, called without a JWT role (cron / trigger)
CREATE FUNCTION public.test_server_record_receipt(p uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE orders SET fiscal_status = 'error' WHERE id = p; END $$;
SELECT public.test_server_record_receipt('00000000-0000-0000-0000-000000000102');
DROP FUNCTION public.test_server_record_receipt(uuid);
DO $$ BEGIN
  IF pg_temp.fiscal('00000000-0000-0000-0000-000000000103') <> 'success|RT-SRV'
     OR pg_temp.fiscal('00000000-0000-0000-0000-000000000102') <> 'error'
     OR pg_temp.fiscal('00000000-0000-0000-0000-000000000101') <> 'pending' THEN
    RAISE EXCEPTION 'server receipt path';
  END IF;
END $$;

-- 5) Shape: trigger SECURITY DEFINER + search_path, not callable; policy admin-only.
DO $$ BEGIN
  IF NOT (SELECT prosecdef AND 'search_path=public' = ANY(proconfig) FROM pg_proc
          WHERE oid = 'public.prevent_customer_order_tampering()'::regprocedure)
     OR has_function_privilege('authenticated', 'public.prevent_customer_order_tampering()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.prevent_customer_order_tampering()', 'EXECUTE') THEN
    RAISE EXCEPTION 'trigger function shape';
  END IF;
  IF (SELECT roles::text FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_update') <> '{authenticated}'
     OR (SELECT qual || coalesce(with_check, '') FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_update') LIKE '%customer_id%'
     OR has_table_privilege('anon', 'public.orders', 'UPDATE') THEN
    RAISE EXCEPTION 'orders_update policy / grants';
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.orders'::regclass AND tgname = 'trg_prevent_customer_order_tampering') <> 1 THEN
    RAISE EXCEPTION 'trigger missing';
  END IF;
END $$;
SELECT 'PASS: server-side receipt status (customer/anon cannot set success/error/id/pdf, admin of company + service_role/server can)' AS result;
