-- Runs after the order chain + 20261020150000_server_side_pricing.sql, with the
-- real Ambrosia catalogue loaded by run-server-pricing-pglite.mjs.
-- Disposable local DB only.
CREATE OR REPLACE FUNCTION pg_temp.err(q text, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE q; EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> msg THEN RAISE EXCEPTION 'Expected "%" got "%"', msg, SQLERRM; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Expected error "%" but statement succeeded', msg;
END $$;
-- order call: p_items as given, total_amount as given (client values).
CREATE OR REPLACE FUNCTION pg_temp.call(p_id text, p_type text, p_total numeric, p_items jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.create_order_with_items(%L::jsonb, %L::jsonb)',
    jsonb_build_object('id', p_id, 'company_id', '00000000-0000-0000-0000-000000000001',
      'customer_id', '00000000-0000-0000-0000-0000000000c1', 'total_amount', p_total, 'order_type', p_type,
      'delivery_address', CASE WHEN p_type = 'delivery' THEN 'Via Roma 1' END),
    p_items);
$$;
CREATE OR REPLACE FUNCTION pg_temp.line(p_product text, p_qty int, p_unit numeric, p_notes text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('product_id', p_product, 'quantity', p_qty, 'unit_price', p_unit,
    'total_price', p_unit * p_qty, 'notes', p_notes);
$$;
GRANT EXECUTE ON FUNCTION pg_temp.err(text, text), pg_temp.call(text, text, numeric, jsonb), pg_temp.line(text, int, numeric, text) TO authenticated;

-- Fixture rows (as owner): Ambrosia delivery fee as on prod (2.5); a free
-- product (0 €) to test the 0.01 floor; an inactive product; another company.
UPDATE companies SET settings = '{"deliveryFeeEur": 2.5}', max_order_total = 150,
  max_open_orders_per_user = 100, order_rate_limit_count = 100 WHERE id = '00000000-0000-0000-0000-000000000001';
INSERT INTO companies (id, active) VALUES ('00000000-0000-0000-0000-000000000002', true) ON CONFLICT DO NOTHING;
INSERT INTO categories (id, name, company_id) VALUES
 ('00000000-0000-0000-0000-0000000ca702', 'Classiche', '00000000-0000-0000-0000-000000000002');
INSERT INTO products (id, company_id, active, price, name, category_id) VALUES
 ('00000000-0000-0000-0000-0000000000f0','00000000-0000-0000-0000-000000000001',true,0,'Omaggio',NULL),
 ('00000000-0000-0000-0000-0000000000a0','00000000-0000-0000-0000-000000000001',false,6,'Margherita vecchia',NULL),
 ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-000000000002',true,6,'Margherita','00000000-0000-0000-0000-0000000ca702');
INSERT INTO profiles(id) VALUES ('00000000-0000-0000-0000-0000000000c1') ON CONFLICT DO NOTHING;

-- Shape: still SECURITY DEFINER + search_path=public, same grants; helpers not callable by clients.
DO $$ BEGIN
  IF NOT (SELECT prosecdef AND 'search_path=public' = ANY(proconfig) FROM pg_proc
          WHERE oid = 'public.create_order_with_items(jsonb, jsonb)'::regprocedure) THEN
    RAISE EXCEPTION 'create_order_with_items must be SECURITY DEFINER with search_path=public';
  END IF;
  IF has_function_privilege('anon', 'public.create_order_with_items(jsonb, jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.create_order_with_items(jsonb, jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.create_order_with_items(jsonb, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'create_order_with_items grants changed';
  END IF;
  IF has_function_privilege('authenticated', 'public.order_line_unit_price(uuid, uuid, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.order_line_unit_price(uuid, uuid, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.order_delivery_fee(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.menu_pricing_default()', 'EXECUTE') THEN
    RAISE EXCEPTION 'pricing helpers must not be executable by clients';
  END IF;
  -- listino: readable, not writable, by clients
  IF NOT has_table_privilege('anon', 'public.menu_pricing', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.menu_pricing', 'SELECT')
     OR has_table_privilege('authenticated', 'public.menu_pricing', 'INSERT')
     OR has_table_privilege('authenticated', 'public.menu_pricing', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.menu_pricing', 'DELETE')
     OR has_table_privilege('anon', 'public.menu_pricing', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.menu_pricing', 'TRUNCATE') THEN
    RAISE EXCEPTION 'menu_pricing grants';
  END IF;
  IF (SELECT count(*) FROM menu_pricing WHERE company_id = '00000000-0000-0000-0000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'menu_pricing not seeded for the company';
  END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
SELECT set_config('request.jwt.claims', '{"is_anonymous":false}', false);
-- client can read the listino, cannot change it
DO $$ BEGIN
  IF (SELECT config->>'builderProductName' FROM menu_pricing WHERE company_id = '00000000-0000-0000-0000-000000000001') IS NULL THEN
    RAISE EXCEPTION 'listino not readable';
  END IF;
END $$;
SELECT pg_temp.err($q$UPDATE menu_pricing SET config = '{}'$q$, 'permission denied for table menu_pricing');

-- Prices to compare with (real catalogue): Margherita and Diavola list prices.
SELECT set_config('test.marg', (SELECT p.id::text FROM products p JOIN categories c ON c.id = p.category_id WHERE p.name = 'Margherita' AND c.name = 'Classiche' AND p.company_id = '00000000-0000-0000-0000-000000000001' AND p.active), false);
SELECT set_config('test.marg_price', (SELECT price::text FROM products WHERE id = current_setting('test.marg')::uuid), false);
SELECT set_config('test.drink', (SELECT p.id::text FROM products p JOIN categories c ON c.id = p.category_id WHERE c.name = 'Bevande' AND p.active ORDER BY p.price DESC, p.id LIMIT 1), false);
SELECT set_config('test.drink_price', (SELECT price::text FROM products WHERE id = current_setting('test.drink')::uuid), false);

-- 1) unit_price 0 and 0.01 (and total 0.01) ignored: the real price is charged.
DO $$ DECLARE r jsonb; m numeric := current_setting('test.marg_price')::numeric; BEGIN
  EXECUTE pg_temp.call('00000000-0000-0000-0000-00000000e001', 'take_away', 0.01,
    jsonb_build_array(pg_temp.line(current_setting('test.marg'), 2, 0, '[P] Margherita'))) INTO r;
  IF (r->>'total_amount')::numeric <> m * 2 OR (r->'items'->0->>'unit_price')::numeric <> m
     OR (r->'items'->0->>'total_price')::numeric <> m * 2 THEN
    RAISE EXCEPTION 'unit_price 0 not ignored: %', r;
  END IF;
  EXECUTE pg_temp.call('00000000-0000-0000-0000-00000000e002', 'take_away', 0.01,
    jsonb_build_array(pg_temp.line(current_setting('test.marg'), 1, 0.01, E'[P] Margherita\nTaglia: Mezzo metro\n+ Tonno'))) INTO r;
  -- mezzo metro of a Margherita + tonno (pesce 2 € × 2)
  IF (r->>'total_amount')::numeric <> m * 2 + 4 THEN RAISE EXCEPTION 'unit_price 0.01 not ignored: %', r; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE m numeric := current_setting('test.marg_price')::numeric; BEGIN
  IF (SELECT total_amount FROM orders WHERE id = '00000000-0000-0000-0000-00000000e001') <> m * 2
     OR (SELECT unit_price FROM order_items WHERE order_id = '00000000-0000-0000-0000-00000000e001') <> m
     OR (SELECT total_amount FROM orders WHERE id = '00000000-0000-0000-0000-00000000e002') <> m * 2 + 4 THEN
    RAISE EXCEPTION 'stored prices are not the server prices';
  END IF;
END $$;
SET ROLE authenticated;

-- 2) total tampering ignored (too low and too high): total = Σ server lines.
DO $$ DECLARE r jsonb; d numeric := current_setting('test.drink_price')::numeric; m numeric := current_setting('test.marg_price')::numeric; BEGIN
  EXECUTE pg_temp.call('00000000-0000-0000-0000-00000000e003', 'take_away', 1,
    jsonb_build_array(pg_temp.line(current_setting('test.marg'), 1, m, '[P] Margherita'),
                      pg_temp.line(current_setting('test.drink'), 3, d, NULL))) INTO r;
  IF (r->>'total_amount')::numeric <> m + 3 * d THEN RAISE EXCEPTION 'low total not ignored: %', r; END IF;
  EXECUTE pg_temp.call('00000000-0000-0000-0000-00000000e004', 'take_away', 149,
    jsonb_build_array(pg_temp.line(current_setting('test.drink'), 1, 140, NULL))) INTO r;
  IF (r->>'total_amount')::numeric <> d OR (r->'items'->0->>'unit_price')::numeric <> d THEN
    RAISE EXCEPTION 'high total/price not ignored: %', r;
  END IF;
  -- no prices at all (future client): still priced
  EXECUTE pg_temp.call('00000000-0000-0000-0000-00000000e005', 'take_away', NULL,
    jsonb_build_array(jsonb_build_object('product_id', current_setting('test.marg'), 'quantity', 1, 'notes', '[P] Margherita'))) INTO r;
  IF (r->>'total_amount')::numeric <> m THEN RAISE EXCEPTION 'order without client prices: %', r; END IF;
END $$;

-- 3) delivery fee: always added for delivery (client cannot drop it), never for take_away.
DO $$ DECLARE r jsonb; m numeric := current_setting('test.marg_price')::numeric; BEGIN
  EXECUTE pg_temp.call('00000000-0000-0000-0000-00000000e006', 'delivery', m,
    jsonb_build_array(pg_temp.line(current_setting('test.marg'), 1, m, '[P] Margherita'))) INTO r;
  IF (r->>'total_amount')::numeric <> m + 2.5 OR (r->>'delivery_fee')::numeric <> 2.5 THEN
    RAISE EXCEPTION 'delivery fee dropped: %', r;
  END IF;
  -- fee smuggled as a fake line / negative-priced line: still fee from settings
  EXECUTE pg_temp.call('00000000-0000-0000-0000-00000000e007', 'delivery', 0,
    jsonb_build_array(pg_temp.line(current_setting('test.marg'), 1, -2.5, '[P] Margherita'))) INTO r;
  IF (r->>'total_amount')::numeric <> m + 2.5 THEN RAISE EXCEPTION 'negative line: %', r; END IF;
END $$;
RESET ROLE;
UPDATE companies SET settings = '{"deliveryFeeEur": "free"}' WHERE id = '00000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
DO $$ DECLARE r jsonb; m numeric := current_setting('test.marg_price')::numeric; BEGIN
  -- invalid setting: client default (2 €), as AppSettingsContext
  EXECUTE pg_temp.call('00000000-0000-0000-0000-00000000e008', 'delivery', m,
    jsonb_build_array(pg_temp.line(current_setting('test.marg'), 1, m, '[P] Margherita'))) INTO r;
  IF (r->>'total_amount')::numeric <> m + 2 THEN RAISE EXCEPTION 'default fee: %', r; END IF;
END $$;
RESET ROLE;
UPDATE companies SET settings = '{"deliveryFeeEur": 2.5}' WHERE id = '00000000-0000-0000-0000-000000000001';
SET ROLE authenticated;

-- 4) refusals: inactive product, other company product, total below 0.01,
-- unknown size / ingredient / gusto, size on a drink, too many gusti.
SELECT pg_temp.err(pg_temp.call('00000000-0000-0000-0000-00000000e010', 'take_away', 6,
  jsonb_build_array(pg_temp.line('00000000-0000-0000-0000-0000000000a0', 1, 6, NULL))), 'Invalid order lines');
SELECT pg_temp.err(pg_temp.call('00000000-0000-0000-0000-00000000e011', 'take_away', 6,
  jsonb_build_array(pg_temp.line('00000000-0000-0000-0000-0000000000b2', 1, 6, '[P] Margherita'))), 'Invalid order lines');
SELECT pg_temp.err(pg_temp.call('00000000-0000-0000-0000-00000000e012', 'take_away', 5,
  jsonb_build_array(pg_temp.line('00000000-0000-0000-0000-0000000000f0', 3, 5, NULL))), 'Invalid order total');
SELECT pg_temp.err(pg_temp.call('00000000-0000-0000-0000-00000000e013', 'take_away', 5,
  jsonb_build_array(pg_temp.line(current_setting('test.marg'), 1, 5, E'[P] Margherita\nTaglia: Gigante'))), 'Invalid order lines');
SELECT pg_temp.err(pg_temp.call('00000000-0000-0000-0000-00000000e014', 'take_away', 5,
  jsonb_build_array(pg_temp.line(current_setting('test.marg'), 1, 5, E'[P] Margherita\n+ Caviale'))), 'Invalid order lines');
SELECT pg_temp.err(pg_temp.call('00000000-0000-0000-0000-00000000e015', 'take_away', 5,
  jsonb_build_array(pg_temp.line(current_setting('test.marg'), 1, 5, E'[P] Margherita\nTaglia: Mezzo metro\nGusto 1: Pizza inesistente'))), 'Invalid order lines');
SELECT pg_temp.err(pg_temp.call('00000000-0000-0000-0000-00000000e016', 'take_away', 5,
  jsonb_build_array(pg_temp.line(current_setting('test.drink'), 1, 5, E'[P] x\nTaglia: Mezzo metro'))), 'Invalid order lines');
SELECT pg_temp.err(pg_temp.call('00000000-0000-0000-0000-00000000e017', 'take_away', 5,
  jsonb_build_array(pg_temp.line(current_setting('test.marg'), 1, 5,
    E'[P] Margherita\nTaglia: Mezzo metro\nGusto 1: Margherita\nGusto 2: Margherita\nGusto 3: Margherita\nGusto 4: Margherita'))), 'Invalid order lines');
-- two sizes on one line
SELECT pg_temp.err(pg_temp.call('00000000-0000-0000-0000-00000000e018', 'take_away', 5,
  jsonb_build_array(pg_temp.line(current_setting('test.marg'), 1, 5, E'[P] Margherita\nTaglia: Normale\nTaglia: Mezzo metro'))), 'Invalid order lines');
-- €150 limit applies to the server total, not to the (tampered) client total
SELECT pg_temp.err(pg_temp.call('00000000-0000-0000-0000-00000000e019', 'take_away', 1,
  jsonb_build_array(pg_temp.line(current_setting('test.marg'), 40, 0.01, '[P] Margherita'))), 'ANTIABUSE_ORDER_TOO_LARGE');
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM orders WHERE id::text LIKE '00000000-0000-0000-0000-00000000e01%') THEN
    RAISE EXCEPTION 'refused order was saved';
  END IF;
END $$;
SET ROLE authenticated;

-- 5) idempotent retry: same lines (any client prices / total) → same order,
-- same server prices, no new code; different lines → refused.
DO $$ DECLARE r1 jsonb; r2 jsonb; m numeric := current_setting('test.marg_price')::numeric; BEGIN
  EXECUTE pg_temp.call('00000000-0000-0000-0000-00000000e020', 'delivery', 3,
    jsonb_build_array(pg_temp.line(current_setting('test.marg'), 2, 1, E'[P] Margherita\n+ Salame piccante'))) INTO r1;
  EXECUTE pg_temp.call('00000000-0000-0000-0000-00000000e020', 'delivery', 999,
    jsonb_build_array(pg_temp.line(current_setting('test.marg'), 2, 50, E'[P] Margherita\n+ Salame piccante'))) INTO r2;
  IF r1->>'display_code' IS DISTINCT FROM r2->>'display_code'
     OR (r1->>'total_amount')::numeric <> (r2->>'total_amount')::numeric
     OR (r2->'items'->0->>'unit_price')::numeric <> (r1->'items'->0->>'unit_price')::numeric
     OR (r2->>'delivery_fee')::numeric <> 2.5 OR (r1->>'delivery_fee')::numeric <> 2.5 THEN
    RAISE EXCEPTION 'retry not idempotent: % vs %', r1, r2;
  END IF;
  IF (r1->>'total_amount')::numeric <> (m + 1.5) * 2 + 2.5 THEN RAISE EXCEPTION 'retry order price: %', r1; END IF;
END $$;
SELECT pg_temp.err(pg_temp.call('00000000-0000-0000-0000-00000000e020', 'delivery', 3,
  jsonb_build_array(pg_temp.line(current_setting('test.marg'), 3, 1, E'[P] Margherita\n+ Salame piccante'))), 'Retry does not match the saved order lines');
SELECT pg_temp.err(pg_temp.call('00000000-0000-0000-0000-00000000e020', 'delivery', 3,
  jsonb_build_array(pg_temp.line(current_setting('test.marg'), 2, 1, E'[P] Margherita'))), 'Retry does not match the saved order lines');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM orders WHERE id = '00000000-0000-0000-0000-00000000e020') <> 1
     OR (SELECT count(*) FROM order_items WHERE order_id = '00000000-0000-0000-0000-00000000e020') <> 1 THEN
    RAISE EXCEPTION 'retry duplicated rows';
  END IF;
END $$;
SELECT 'PASS: server pricing (tamper 0/0.01/total ignored, delivery fee, refusals, 150 on server total, retry)' AS result;
