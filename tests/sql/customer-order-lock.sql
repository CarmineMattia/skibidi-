-- AFTER 20261020160000_customer_order_update_lock.sql. Disposable local DB only.
CREATE OR REPLACE FUNCTION pg_temp.denied(q text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  BEGIN
    EXECUTE q;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RETURN; END IF;                       -- RLS: no visible row
  EXCEPTION
    WHEN insufficient_privilege THEN RETURN;            -- grant revoked / RLS check
    WHEN raise_exception THEN
      IF SQLERRM <> 'Only an admin can change order status, ownership, or total' THEN RAISE; END IF;
      RETURN;
  END;
  RAISE EXCEPTION 'Expected refusal: % (% rows)', label, n;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.denied(text, text) TO anon, authenticated;
SELECT pg_temp.seed();

-- 1) Customer c1 on their own pending order: every column except the receipt outcome is frozen.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
SET test.staff = 'false';
SET test.company_id = '';
DO $$ DECLARE q text; BEGIN
  FOREACH q IN ARRAY ARRAY[
    -- tester repro: pickup 5 € → delivery after creation (no fee)
    $q$UPDATE orders SET order_type = 'delivery', delivery_address = 'Via Roma 1' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET order_type = 'delivery' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET delivery_address = 'Via Altrove 9' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET notes = 'Pagato online' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET table_number = '7' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET customer_name = 'Altro', customer_phone = '000' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET display_code = 'Ordine #999' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET total_amount = 0.01 WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET company_id = '00000000-0000-0000-0000-000000000002' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET customer_id = '00000000-0000-0000-0000-0000000000c2' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET status = 'cancelled' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET created_at = now() - interval '1 day' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET decline_reason_note = 'x' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE orders SET fiscal_status = 'success', order_type = 'delivery' WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    -- lines: no update / delete (price, quantity, product, notes)
    $q$UPDATE order_items SET unit_price = 0.01, total_price = 0.01 WHERE order_id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE order_items SET quantity = 10 WHERE order_id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$UPDATE order_items SET notes = E'[P] Margherita\nTaglia: Mezzo metro' WHERE order_id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$DELETE FROM order_items WHERE order_id = '00000000-0000-0000-0000-000000000101'$q$,
    -- no deletes of orders by customers (own, guest, other company)
    $q$DELETE FROM orders WHERE id = '00000000-0000-0000-0000-000000000101'$q$,
    $q$DELETE FROM orders WHERE id = '00000000-0000-0000-0000-000000000102'$q$,
    $q$DELETE FROM orders WHERE id = '00000000-0000-0000-0000-000000000103'$q$,
    $q$DELETE FROM orders$q$,
    $q$DELETE FROM order_items$q$,
    -- other people's orders stay invisible
    $q$UPDATE orders SET order_type = 'delivery' WHERE id = '00000000-0000-0000-0000-000000000102'$q$,
    $q$UPDATE orders SET order_type = 'delivery' WHERE id = '00000000-0000-0000-0000-000000000103'$q$
  ] LOOP
    PERFORM pg_temp.denied(q, q);
  END LOOP;
END $$;
-- allowed: the receipt outcome right after checkout (useCreateOrder), once
UPDATE orders SET fiscal_status = 'success', fiscal_external_id = 'RT-1', pdf_url = 'https://example.invalid/r.pdf', updated_at = now()
 WHERE id = '00000000-0000-0000-0000-000000000101';
SELECT pg_temp.denied($q$UPDATE orders SET fiscal_status = 'error' WHERE id = '00000000-0000-0000-0000-000000000101'$q$, 'second receipt update');
SELECT pg_temp.denied($q$UPDATE orders SET pdf_url = 'https://evil.invalid' WHERE id = '00000000-0000-0000-0000-000000000101'$q$, 'pdf after receipt');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT row(order_type, delivery_address, notes, total_amount, display_code, status::text, fiscal_status::text, customer_id)
      FROM orders WHERE id = '00000000-0000-0000-0000-000000000101')
     IS DISTINCT FROM row('take_away'::text, NULL::text, 'Pagamento alla cassa'::text, 5::numeric, 'Ordine #1'::text,
                          'pending'::text, 'success'::text, '00000000-0000-0000-0000-0000000000c1'::uuid)
     OR (SELECT row(quantity, unit_price, total_price, notes) FROM order_items WHERE order_id = '00000000-0000-0000-0000-000000000101')
        IS DISTINCT FROM row(1, 5::numeric, 5::numeric, '[P] Margherita'::text)
     OR (SELECT count(*) FROM orders WHERE id::text LIKE '00000000-0000-0000-0000-0000000001%') <> 3 THEN
    RAISE EXCEPTION 'customer changed the order';
  END IF;
END $$;
-- receipt error path (the app now sends only fiscal_status)
SELECT pg_temp.seed();
SET ROLE authenticated;
UPDATE orders SET fiscal_status = 'error' WHERE id = '00000000-0000-0000-0000-000000000101';
-- old cached client: error + notes in one update → refused as a whole
RESET ROLE;
SELECT pg_temp.seed();
SET ROLE authenticated;
SELECT pg_temp.denied($q$UPDATE orders SET fiscal_status = 'error', notes = 'x | Fiscal error: y' WHERE id = '00000000-0000-0000-0000-000000000101'$q$, 'old client notes');
RESET ROLE;

-- 2) anon: no update / delete at all (leftover guest delete closed).
SELECT pg_temp.seed();
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT pg_temp.denied($q$DELETE FROM orders WHERE id = '00000000-0000-0000-0000-000000000102'$q$, 'anon delete guest pending');
SELECT pg_temp.denied($q$DELETE FROM orders$q$, 'anon delete without WHERE (only orders_delete applies)');
SELECT pg_temp.denied($q$UPDATE orders SET order_type = 'delivery'$q$, 'anon update without WHERE');
SELECT pg_temp.denied($q$UPDATE orders SET order_type = 'delivery' WHERE id = '00000000-0000-0000-0000-000000000102'$q$, 'anon update guest');
SELECT pg_temp.denied($q$DELETE FROM order_items WHERE order_id = '00000000-0000-0000-0000-000000000102'$q$, 'anon delete items');
SELECT pg_temp.denied($q$UPDATE order_items SET unit_price = 0 WHERE order_id = '00000000-0000-0000-0000-000000000102'$q$, 'anon update items');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM orders WHERE id::text LIKE '00000000-0000-0000-0000-0000000001%') <> 3
     OR (SELECT count(*) FROM order_items WHERE order_id::text LIKE '00000000-0000-0000-0000-0000000001%') <> 3 THEN
    RAISE EXCEPTION 'anon changed rows';
  END IF;
END $$;

-- 3) Admin of company 1: full control of own company orders, nothing elsewhere.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
SET test.staff = 'true';
SET test.company_id = '00000000-0000-0000-0000-000000000001';
UPDATE orders SET order_type = 'delivery', delivery_address = 'Via Roma 1', total_amount = 7.5, notes = 'telefonato'
 WHERE id = '00000000-0000-0000-0000-000000000101';
SELECT pg_temp.denied($q$UPDATE orders SET notes = 'x' WHERE id = '00000000-0000-0000-0000-000000000103'$q$, 'admin other company update');
SELECT pg_temp.denied($q$DELETE FROM orders WHERE id = '00000000-0000-0000-0000-000000000103'$q$, 'admin other company delete');
-- admin of company 2, DELETE without WHERE: only company 2 orders (live: every company)
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false);
SET test.company_id = '00000000-0000-0000-0000-000000000002';
SELECT pg_temp.denied($q$UPDATE orders SET notes = 'x' WHERE company_id = '00000000-0000-0000-0000-000000000001'$q$, 'admin 2 updates company 1');
DELETE FROM orders;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
SET test.company_id = '00000000-0000-0000-0000-000000000001';
SELECT pg_temp.denied($q$UPDATE order_items SET unit_price = 0 WHERE order_id = '00000000-0000-0000-0000-000000000101'$q$, 'admin item update (no policy, no grant)');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT row(order_type, total_amount) FROM orders WHERE id = '00000000-0000-0000-0000-000000000101') IS DISTINCT FROM row('delivery'::text, 7.5::numeric)
     OR EXISTS (SELECT 1 FROM orders WHERE id = '00000000-0000-0000-0000-000000000103')
     OR (SELECT count(*) FROM orders WHERE company_id = '00000000-0000-0000-0000-000000000001'
           AND id::text LIKE '00000000-0000-0000-0000-0000000001%') <> 2 THEN
    RAISE EXCEPTION 'admin scope wrong';
  END IF;
END $$;
SET ROLE authenticated;
-- admin delete: only own company (lines go by ON DELETE CASCADE, as live)
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
SET test.staff = 'true';
SET test.company_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM orders WHERE id = '00000000-0000-0000-0000-000000000102';
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM orders WHERE id = '00000000-0000-0000-0000-000000000102')
     OR EXISTS (SELECT 1 FROM order_items WHERE order_id = '00000000-0000-0000-0000-000000000102') THEN RAISE EXCEPTION 'admin delete failed'; END IF;
END $$;

-- 4) Shape: trigger SECURITY DEFINER + search_path, not callable; grants; policy roles.
DO $$ BEGIN
  IF NOT (SELECT prosecdef AND 'search_path=public' = ANY(proconfig) FROM pg_proc
          WHERE oid = 'public.prevent_customer_order_tampering()'::regprocedure)
     OR has_function_privilege('authenticated', 'public.prevent_customer_order_tampering()', 'EXECUTE') THEN
    RAISE EXCEPTION 'trigger function shape';
  END IF;
  IF has_table_privilege('anon', 'public.orders', 'UPDATE') OR has_table_privilege('anon', 'public.orders', 'DELETE')
     OR has_table_privilege('anon', 'public.order_items', 'UPDATE') OR has_table_privilege('anon', 'public.order_items', 'DELETE')
     OR has_table_privilege('authenticated', 'public.order_items', 'UPDATE') OR has_table_privilege('authenticated', 'public.order_items', 'DELETE')
     OR NOT has_table_privilege('authenticated', 'public.orders', 'UPDATE') THEN
    RAISE EXCEPTION 'grants';
  END IF;
  IF (SELECT roles::text FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_delete') <> '{authenticated}'
     OR (SELECT roles::text FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_update') <> '{authenticated}'
     OR (SELECT qual FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_delete') LIKE '%customer_id%' THEN
    RAISE EXCEPTION 'policies';
  END IF;
END $$;
SELECT 'PASS: customer order lock (P3 repro pickup→delivery refused, all columns frozen except receipt outcome, no customer/anon deletes, no item updates, admin scoped)' AS result;
