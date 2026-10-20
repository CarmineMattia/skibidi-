-- Runs after the order migration chain + 20261020140000_order_items_insert_guard.sql.
-- Disposable local DB only. Cases from Skibidi Tester's #30 harness (round16).
CREATE OR REPLACE FUNCTION pg_temp.denied(q text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE q; EXCEPTION
    WHEN insufficient_privilege THEN RETURN;          -- RLS / missing grant
    WHEN raise_exception THEN RETURN;                 -- RPC / trigger refusal
  END;
  RAISE EXCEPTION 'Expected refusal: %', label;
END $$;
CREATE OR REPLACE FUNCTION pg_temp.err(q text, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE q; EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> msg THEN RAISE EXCEPTION 'Expected "%" got "%"', msg, SQLERRM; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Expected error "%" but statement succeeded', msg;
END $$;
CREATE OR REPLACE FUNCTION pg_temp.rpc(p_id text, p_customer text, p_company text, p_product text, p_price numeric) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.create_order_with_items(%L::jsonb, %L::jsonb)',
    jsonb_build_object('id', p_id, 'company_id', p_company, 'customer_id', p_customer,
      'display_code', 'T', 'total_amount', p_price, 'order_type', 'take_away'),
    jsonb_build_array(jsonb_build_object('product_id', p_product, 'quantity', 1, 'unit_price', p_price, 'total_price', p_price)));
$$;
GRANT EXECUTE ON FUNCTION pg_temp.denied(text, text), pg_temp.err(text, text), pg_temp.rpc(text, text, text, text, numeric) TO anon, authenticated;

-- RPC shape: SECURITY DEFINER, fixed search_path, no anon/PUBLIC EXECUTE.
DO $$ BEGIN
  IF NOT (SELECT prosecdef AND 'search_path=public' = ANY(proconfig) FROM pg_proc
          WHERE oid = 'public.create_order_with_items(jsonb, jsonb)'::regprocedure) THEN
    RAISE EXCEPTION 'create_order_with_items must be SECURITY DEFINER with search_path=public';
  END IF;
  IF has_function_privilege('anon', 'public.create_order_with_items(jsonb, jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.create_order_with_items(jsonb, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'create_order_with_items grants';
  END IF;
END $$;

-- Fixture rows (as owner): 2nd company + product, legacy guest orders,
-- another customer's order, a cancelled own order.
INSERT INTO companies VALUES ('00000000-0000-0000-0000-000000000002', true) ON CONFLICT DO NOTHING;
INSERT INTO products VALUES ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002',true,7) ON CONFLICT DO NOTHING;
INSERT INTO orders (id, company_id, customer_id, display_code, status, fiscal_status, total_amount, order_type) VALUES
 ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000001',NULL,'Ordine #90','pending','pending',5,'take_away'),
 ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-000000000001',NULL,'Ordine #92','pending','pending',5,'take_away'),
 ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c2','Ordine #91','pending','pending',5,'take_away'),
 ('00000000-0000-0000-0000-0000000000f4','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','Ordine #93','pending','pending',5,'take_away'),
 ('00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c3','Altro #1','pending','pending',7,'take_away');
UPDATE orders SET status = 'cancelled' WHERE id IN ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000f4');

-- 1) Customer c1 (logged in with Google).
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
SELECT set_config('request.jwt.claims', '{"is_anonymous":false}', false);
SET test.staff = 'false';
SET test.company_id = '';
-- checkout still works through the RPC
DO $$ DECLARE r jsonb; BEGIN
  EXECUTE pg_temp.rpc('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c1',
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011', 5) INTO r;
  IF r->>'id' <> '00000000-0000-0000-0000-0000000000e1' THEN RAISE EXCEPTION 'checkout failed: %', r; END IF;
END $$;
-- direct inserts: all refused
SELECT pg_temp.denied($q$INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000011',1,5,5)$q$, 'item on legacy guest order (customer NULL, pending)');
SELECT pg_temp.denied($q$INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-000000000011',1,5,5)$q$, 'item on legacy guest order (cancelled)');
SELECT pg_temp.denied($q$INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000011',1,0.01,0.01)$q$, '0.01 item on own pending order');
SELECT pg_temp.denied($q$INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-000000000011',1,5,5)$q$, 'item on another customer''s order');
SELECT pg_temp.denied($q$INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES ('00000000-0000-0000-0000-0000000000f4','00000000-0000-0000-0000-000000000011',1,5,5)$q$, 'item on own non-pending (cancelled) order');
SELECT pg_temp.denied($q$INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES ('00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-000000000021',1,7,7)$q$, 'item on other company order');
SELECT pg_temp.denied($q$INSERT INTO orders(id,company_id,customer_id,status,fiscal_status,total_amount,order_type) VALUES ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','pending','pending',5,'take_away')$q$, 'direct own order (bypasses RPC/antiabuse)');
SELECT pg_temp.denied($q$INSERT INTO orders(id,company_id,customer_id,status,fiscal_status,total_amount,order_type) VALUES ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-000000000001',NULL,'pending','pending',5,'take_away')$q$, 'direct guest order');
-- RPC refusals
SELECT pg_temp.err(pg_temp.rpc('00000000-0000-0000-0000-0000000000e4', NULL, '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011', 5), 'Order customer does not match the current session');
SELECT pg_temp.err(pg_temp.rpc('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011', 5), 'Order customer does not match the current session');
SELECT pg_temp.err(pg_temp.rpc('00000000-0000-0000-0000-0000000000e6','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000021', 7), 'Invalid order lines');
-- retry with the id of another customer's order cannot add lines to it
SELECT pg_temp.err(pg_temp.rpc('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011', 5), 'Retry does not match the saved order');
SELECT pg_temp.err(pg_temp.rpc('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011', 5), 'Retry does not match the saved order');
-- anonymous Supabase session refused
SELECT set_config('request.jwt.claims', '{"is_anonymous":true}', false);
SELECT pg_temp.err(pg_temp.rpc('00000000-0000-0000-0000-0000000000e7','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011', 5), 'ANTIABUSE_LOGIN_REQUIRED');
SELECT set_config('request.jwt.claims', '{"is_anonymous":false}', false);
RESET ROLE;

-- 2) anon: no RPC, no direct inserts.
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT pg_temp.denied(pg_temp.rpc('00000000-0000-0000-0000-0000000000e8', NULL, '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011', 5), 'anon RPC');
SELECT pg_temp.denied($q$INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000011',1,5,5)$q$, 'anon item');
SELECT pg_temp.denied($q$INSERT INTO orders(id,company_id,customer_id,status,fiscal_status,total_amount,order_type) VALUES ('00000000-0000-0000-0000-0000000000e9','00000000-0000-0000-0000-000000000001',NULL,'pending','pending',5,'take_away')$q$, 'anon order');
RESET ROLE;

-- 3) Staff of company 1: direct insert only inside their company.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
SET test.staff = 'true';
SET test.company_id = '00000000-0000-0000-0000-000000000001';
INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-000000000011',1,5,5);
SELECT pg_temp.denied($q$INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES ('00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-000000000021',1,7,7)$q$, 'staff item on other company order');
SELECT pg_temp.denied($q$INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-000000000021',1,7,7)$q$, 'staff item with other company product');
INSERT INTO orders(id,company_id,customer_id,status,fiscal_status,total_amount,order_type) VALUES ('00000000-0000-0000-0000-0000000000ea','00000000-0000-0000-0000-000000000001',NULL,'pending','pending',5,'take_away');
SELECT pg_temp.denied($q$INSERT INTO orders(id,company_id,customer_id,status,fiscal_status,total_amount,order_type) VALUES ('00000000-0000-0000-0000-0000000000eb','00000000-0000-0000-0000-000000000002',NULL,'pending','pending',5,'take_away')$q$, 'staff order for other company');
SET test.staff = 'false';
RESET ROLE;

DO $$ BEGIN
  IF (SELECT count(*) FROM order_items WHERE order_id = '00000000-0000-0000-0000-0000000000e1') <> 1
     OR (SELECT status FROM orders WHERE id = '00000000-0000-0000-0000-0000000000e1') <> 'pending'
     OR (SELECT customer_id FROM orders WHERE id = '00000000-0000-0000-0000-0000000000e1') <> '00000000-0000-0000-0000-0000000000c1'
     OR EXISTS (SELECT 1 FROM order_items WHERE order_id IN ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000f4','00000000-0000-0000-0000-0000000000f5'))
     OR (SELECT count(*) FROM order_items WHERE order_id = '00000000-0000-0000-0000-0000000000f2') <> 1 THEN
    RAISE EXCEPTION 'unexpected rows after the guard checks';
  END IF;
END $$;
SELECT 'PASS: order_items insert guard (guest/0.01/other customer/non-pending/other company; staff scoped; RPC ok)' AS result;
