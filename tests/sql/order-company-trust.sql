-- Company on checkout comes from the caller profile. Client prices stay ignored.
-- Runs after the order chain, 20261022100000 and 20261112010000, with the
-- Ambrosia catalogue loaded. Disposable PGlite only.
UPDATE public.companies
SET max_order_total = 100000,
    max_open_orders_per_user = 100000,
    order_rate_limit_count = 100000
WHERE id = '00000000-0000-0000-0000-000000000001';

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  role text,
  company_id uuid
);
INSERT INTO public.profiles (id, role, company_id)
VALUES ('00000000-0000-0000-0000-0000000000c1', 'customer', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET role = 'customer', company_id = EXCLUDED.company_id;

-- Same source as production: the profile row, not the client payload.
CREATE OR REPLACE FUNCTION public.get_my_company_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000c1","is_anonymous":false}',
  false
);

DO $$
DECLARE
  r jsonb;
  pid uuid := current_setting('test.priced_product')::uuid;
  notes text := current_setting('test.line_notes');
  priced numeric;
  base numeric := current_setting('test.base_price')::numeric;
  items jsonb;
BEGIN
  priced := (public.order_line_priced(
    '00000000-0000-0000-0000-000000000001', pid, notes)->>'unit_price')::numeric;
  IF abs(priced - current_setting('test.priced_unit')::numeric) > 0.001 OR priced = base THEN
    RAISE EXCEPTION 'priced line is not distinct from the base price (% vs %)', priced, base;
  END IF;
  items := jsonb_build_array(jsonb_build_object(
    'product_id', pid, 'quantity', 1, 'unit_price', 0.01, 'total_price', 0.01, 'notes', notes));

  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.create_order_with_items(jsonb_build_object(
      'id', '00000000-0000-0000-0000-00000000c0a1',
      'company_id', '00000000-0000-0000-0000-000000000002',
      'customer_id', '00000000-0000-0000-0000-0000000000c1',
      'order_type', 'take_away'), items);
    RAISE EXCEPTION 'ASSERT FAILED: client company was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASSERT FAILED%' THEN RAISE; END IF;
    IF SQLERRM <> 'Restaurant not available' THEN
      RAISE EXCEPTION 'unexpected company error: %', SQLERRM;
    END IF;
  END;
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = '00000000-0000-0000-0000-00000000c0a1') THEN
    RAISE EXCEPTION 'rejected company still inserted an order';
  END IF;

  SET LOCAL ROLE authenticated;
  r := public.create_order_with_items(jsonb_build_object(
    'id', '00000000-0000-0000-0000-00000000c0a2',
    'company_id', '00000000-0000-0000-0000-000000000001',
    'customer_id', '00000000-0000-0000-0000-0000000000c1',
    'order_type', 'take_away'), items);
  RESET ROLE;
  IF (r->'items'->0->>'unit_price')::numeric <> priced
     OR (SELECT unit_price FROM public.order_items WHERE order_id = '00000000-0000-0000-0000-00000000c0a2') <> priced
     OR (SELECT company_id FROM public.orders WHERE id = '00000000-0000-0000-0000-00000000c0a2')
        <> '00000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'server price was not kept: %', r;
  END IF;

  SET LOCAL ROLE authenticated;
  r := public.create_order_with_items(jsonb_build_object(
    'id', '00000000-0000-0000-0000-00000000c0a3',
    'customer_id', '00000000-0000-0000-0000-0000000000c1',
    'order_type', 'take_away'), items);
  RESET ROLE;
  IF (SELECT company_id FROM public.orders WHERE id = '00000000-0000-0000-0000-00000000c0a3')
       <> '00000000-0000-0000-0000-000000000001'
     OR (r->'items'->0->>'unit_price')::numeric <> priced THEN
    RAISE EXCEPTION 'omitted company_id was not taken from the profile: %', r;
  END IF;
END $$;

RESET ROLE;
UPDATE public.profiles SET company_id = NULL WHERE id = '00000000-0000-0000-0000-0000000000c1';

DO $$
DECLARE
  pid uuid := current_setting('test.priced_product')::uuid;
  notes text := current_setting('test.line_notes');
  items jsonb := jsonb_build_array(jsonb_build_object(
    'product_id', pid, 'quantity', 1, 'unit_price', 0.01, 'total_price', 0.01, 'notes', notes));
  r jsonb;
BEGIN
  SET LOCAL ROLE authenticated;
  r := public.create_order_with_items(jsonb_build_object(
    'id', '00000000-0000-0000-0000-00000000c0a4',
    'company_id', '00000000-0000-0000-0000-000000000001',
    'customer_id', '00000000-0000-0000-0000-0000000000c1',
    'order_type', 'take_away'), items);
  RESET ROLE;
  IF (SELECT company_id FROM public.orders WHERE id = '00000000-0000-0000-0000-00000000c0a4')
       <> '00000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'single-pizzeria fallback did not use the only active company: %', r;
  END IF;
END $$;

RESET ROLE;
INSERT INTO public.companies (id, active)
VALUES ('00000000-0000-0000-0000-000000000002', true)
ON CONFLICT (id) DO UPDATE SET active = true;

DO $$
DECLARE
  pid uuid := current_setting('test.priced_product')::uuid;
  notes text := current_setting('test.line_notes');
  items jsonb := jsonb_build_array(jsonb_build_object(
    'product_id', pid, 'quantity', 1, 'unit_price', 0.01, 'total_price', 0.01, 'notes', notes));
BEGIN
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.create_order_with_items(jsonb_build_object(
      'id', '00000000-0000-0000-0000-00000000c0a5',
      'company_id', '00000000-0000-0000-0000-000000000001',
      'customer_id', '00000000-0000-0000-0000-0000000000c1',
      'order_type', 'take_away'), items);
    RAISE EXCEPTION 'ASSERT FAILED: null profile with two companies was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASSERT FAILED%' THEN RAISE; END IF;
    IF SQLERRM <> 'Restaurant not available' THEN
      RAISE EXCEPTION 'unexpected null-profile error: %', SQLERRM;
    END IF;
  END;
END $$;

RESET ROLE;
UPDATE public.profiles
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE id = '00000000-0000-0000-0000-0000000000c1';

DO $$
DECLARE
  pid uuid := current_setting('test.priced_product')::uuid;
  notes text := current_setting('test.line_notes');
  items jsonb := jsonb_build_array(jsonb_build_object(
    'product_id', pid, 'quantity', 1, 'unit_price', 0.01, 'total_price', 0.01, 'notes', notes));
BEGIN
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.create_order_with_items(jsonb_build_object(
      'id', '00000000-0000-0000-0000-00000000c0a6',
      'company_id', '00000000-0000-0000-0000-000000000002',
      'customer_id', '00000000-0000-0000-0000-0000000000c1',
      'order_type', 'take_away'), items);
    RAISE EXCEPTION 'ASSERT FAILED: profile company was overridden';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'ASSERT FAILED%' THEN RAISE; END IF;
    IF SQLERRM <> 'Restaurant not available' THEN
      RAISE EXCEPTION 'unexpected override error: %', SQLERRM;
    END IF;
  END;
END $$;

RESET ROLE;
DO $$
DECLARE src text;
BEGIN
  src := pg_get_functiondef('public.create_order_with_items(jsonb, jsonb)'::regprocedure);
  IF position('order_caller_company' IN src) = 0 OR position('order_line_priced' IN src) = 0 THEN
    RAISE EXCEPTION 'checkout no longer prices on the server or ignores the client company';
  END IF;
  IF position('v_company uuid := (p_order->>''company_id'')::uuid' IN src) > 0 THEN
    RAISE EXCEPTION 'checkout still assigns company_id from the client';
  END IF;
  IF NOT (SELECT prosecdef AND 'search_path=public' = ANY (proconfig) FROM pg_proc
          WHERE oid = 'public.create_order_with_items(jsonb, jsonb)'::regprocedure) THEN
    RAISE EXCEPTION 'create_order_with_items lost SECURITY DEFINER or search_path';
  END IF;
  IF has_function_privilege('anon', 'public.create_order_with_items(jsonb, jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.create_order_with_items(jsonb, jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.create_order_with_items(jsonb, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.order_caller_company(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.order_line_priced(uuid, uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'checkout grants changed';
  END IF;
END $$;

SELECT 'PASS: checkout company comes from the profile and server prices stay' AS result;
