-- order_items insert guard (migration only in the PR; apply to prod only with Carmine's OK).
--
-- Gap found by Skibidi Tester on #30 (pre-existing on the live DB):
-- can_insert_order_item (policy order_items_insert) accepted orders with
-- customer_id NULL, validated only the lines already saved (not the new row:
-- a customer could add a 0.01 line to their own order) and its admin branch
-- did not check the company.
--
-- Also (round16 finding): the order display code is assigned server-side by
-- create_order_with_items via reserve_order_display_code; a client
-- display_code is ignored.
--
-- Fix: customers no longer write orders / order_items directly. The only
-- customer path is create_order_with_items, now SECURITY DEFINER (fixed
-- search_path, checks auth.uid(), non-anonymous session, active company,
-- products of that company, quantities, totals, antiabuse; status forced to
-- pending). Direct INSERT stays only for staff (is_admin) of the same company.
-- No app code inserts into orders / order_items directly (only the RPC).
--
-- Compatible with #28 (grants) and #30 (hardening) applied in any order:
-- the insert policies are defined only here (#30 changes table grants only).

-- 1) The RPC is the only customer write path -------------------------------
CREATE OR REPLACE FUNCTION public.create_order_with_items(p_order jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := (p_order->>'id')::uuid;
  v_company uuid := (p_order->>'company_id')::uuid;
  v_customer uuid := nullif(p_order->>'customer_id', '')::uuid;
  v_existing jsonb;
  v_expected jsonb;
  v_actual jsonb;
  v_subtotal numeric;
  v_display_code text;
BEGIN
  IF v_id IS NULL OR v_company IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid order';
  END IF;
  IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Order must contain between 1 and 100 lines';
  END IF;
  -- Antiabuso: niente ordini da ospite / sessione anonima.
  IF auth.uid() IS NULL OR coalesce((auth.jwt()->>'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'ANTIABUSE_LOGIN_REQUIRED';
  END IF;
  -- SECURITY DEFINER: RLS does not apply inside, so every ownership rule is
  -- checked here. The order always belongs to the caller.
  IF v_customer IS NULL OR v_customer IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Order customer does not match the current session';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = v_company AND active) THEN
    RAISE EXCEPTION 'Restaurant not available';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_items) AS i(product_id uuid, quantity integer, unit_price numeric, total_price numeric)
    LEFT JOIN public.products p ON p.id = i.product_id AND p.company_id = v_company AND p.active
    WHERE p.id IS NULL OR i.quantity IS NULL OR i.quantity NOT BETWEEN 1 AND 1000
      OR i.unit_price IS NULL OR i.unit_price < 0 OR i.total_price IS NULL
      OR round(i.total_price, 2) <> round(i.unit_price * i.quantity, 2)
  ) THEN
    RAISE EXCEPTION 'Invalid order lines';
  END IF;
  SELECT sum(i.total_price) INTO v_subtotal
  FROM jsonb_to_recordset(p_items) AS i(total_price numeric);
  IF (p_order->>'total_amount') IS NULL OR (p_order->>'total_amount')::numeric < v_subtotal THEN
    RAISE EXCEPTION 'Invalid order total';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  v_existing := public.get_order_tracking(v_id);
  IF v_existing IS NOT NULL THEN
    IF (v_existing->>'company_id')::uuid IS DISTINCT FROM v_company
       OR nullif(v_existing->>'customer_id', '')::uuid IS DISTINCT FROM v_customer
       OR (v_existing->>'total_amount')::numeric IS DISTINCT FROM (p_order->>'total_amount')::numeric
       OR v_existing->>'order_type' IS DISTINCT FROM p_order->>'order_type'
       OR v_existing->>'notes' IS DISTINCT FROM p_order->>'notes'
       OR v_existing->>'delivery_address' IS DISTINCT FROM p_order->>'delivery_address'
       OR v_existing->>'table_number' IS DISTINCT FROM p_order->>'table_number'
       OR v_existing->>'customer_name' IS DISTINCT FROM p_order->>'customer_name'
       OR v_existing->>'customer_phone' IS DISTINCT FROM p_order->>'customer_phone' THEN
      RAISE EXCEPTION 'Retry does not match the saved order';
    END IF;
    SELECT jsonb_agg(jsonb_build_array(i.product_id, i.quantity, i.unit_price, i.total_price, i.notes) ORDER BY i.product_id, i.quantity, i.unit_price, i.notes)
      INTO v_expected FROM jsonb_to_recordset(p_items) AS i(product_id uuid, quantity integer, unit_price numeric, total_price numeric, notes text);
    SELECT jsonb_agg(jsonb_build_array(i.product_id, i.quantity, i.unit_price, i.total_price, i.notes) ORDER BY i.product_id, i.quantity, i.unit_price, i.notes)
      INTO v_actual FROM jsonb_to_recordset(v_existing->'order_items') AS i(product_id uuid, quantity integer, unit_price numeric, total_price numeric, notes text);
    IF v_expected IS DISTINCT FROM v_actual THEN
      RAISE EXCEPTION 'Retry does not match the saved order lines';
    END IF;
    RETURN jsonb_build_object('id', v_id, 'display_code', v_existing->>'display_code', 'total_amount', v_existing->'total_amount');
  END IF;

  -- Antiabuso lato server (solo per ordini nuovi: i retry idempotenti passano sopra).
  PERFORM public.assert_order_antiabuse(v_company, (p_order->>'total_amount')::numeric);

  -- The display code is always assigned here: any client display_code is
  -- ignored (it could duplicate another order's code). Retries return the
  -- code already saved (above), so a retry never reserves a new number.
  v_display_code := public.reserve_order_display_code(v_company);

  INSERT INTO public.orders (id, company_id, customer_id, display_code, status, fiscal_status,
    total_amount, notes, order_type, customer_name, customer_phone, delivery_address, table_number)
  VALUES (v_id, v_company, v_customer, v_display_code, 'pending', 'pending',
    (p_order->>'total_amount')::numeric, p_order->>'notes', p_order->>'order_type',
    p_order->>'customer_name', p_order->>'customer_phone', p_order->>'delivery_address', p_order->>'table_number');

  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, notes)
  SELECT v_id, i.product_id, i.quantity, i.unit_price, i.total_price, i.notes
  FROM jsonb_to_recordset(p_items) AS i(product_id uuid, quantity integer, unit_price numeric, total_price numeric, notes text);

  v_existing := public.get_order_tracking(v_id);
  RETURN jsonb_build_object('id', v_id, 'display_code', v_existing->>'display_code', 'total_amount', v_existing->'total_amount');
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_with_items(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb, jsonb) TO authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb, jsonb) TO service_role;
  END IF;
END $$;

-- 2) can_insert_order_item: staff of the order's company only ----------------
-- (same signature, so #28's grants and any older policy that still calls it
-- become strict too: no NULL-customer branch, no customer branch, company match)
CREATE OR REPLACE FUNCTION public.can_insert_order_item(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.is_admin(), false) AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = p_order_id
      AND o.company_id = public.get_my_company_id()
  );
$$;

-- 3) Policies: direct INSERT only for staff of the same company --------------
DROP POLICY IF EXISTS order_items_insert ON public.order_items;
CREATE POLICY order_items_insert ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_insert_order_item(order_id)
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.company_id = public.get_my_company_id()
    )
  );

DROP POLICY IF EXISTS orders_insert ON public.orders;
CREATE POLICY orders_insert ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (coalesce(public.is_admin(), false) AND company_id = public.get_my_company_id());

REVOKE INSERT ON TABLE public.orders, public.order_items FROM anon;
