-- Apply before deploying the checkout changes. Uses existing RLS and grants.
-- Order header and all lines commit together. UUID is the retry key.
BEGIN;
CREATE OR REPLACE FUNCTION public.create_order_with_items(p_order jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
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
BEGIN
  IF v_id IS NULL OR v_company IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid order';
  END IF;
  IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Order must contain between 1 and 100 lines';
  END IF;
  IF v_customer IS DISTINCT FROM auth.uid() THEN
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

  INSERT INTO public.orders (id, company_id, customer_id, display_code, status, fiscal_status,
    total_amount, notes, order_type, customer_name, customer_phone, delivery_address, table_number)
  VALUES (v_id, v_company, v_customer, p_order->>'display_code', 'pending', 'pending',
    (p_order->>'total_amount')::numeric, p_order->>'notes', p_order->>'order_type',
    p_order->>'customer_name', p_order->>'customer_phone', p_order->>'delivery_address', p_order->>'table_number');

  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, notes)
  SELECT v_id, i.product_id, i.quantity, i.unit_price, i.total_price, i.notes
  FROM jsonb_to_recordset(p_items) AS i(product_id uuid, quantity integer, unit_price numeric, total_price numeric, notes text);

  v_existing := public.get_order_tracking(v_id);
  RETURN jsonb_build_object('id', v_id, 'display_code', v_existing->>'display_code', 'total_amount', v_existing->'total_amount');
END;
$$;
REVOKE ALL ON FUNCTION public.create_order_with_items(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb, jsonb) TO anon, authenticated;
-- A kitchen acceptance must always reference at least one saved line.
CREATE OR REPLACE FUNCTION public.prevent_empty_order_acceptance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'preparing' AND OLD.status = 'pending'
     AND NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = NEW.id) THEN
    RAISE EXCEPTION 'Cannot accept an order without saved items';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_empty_order_acceptance ON public.orders;
CREATE TRIGGER trg_prevent_empty_order_acceptance BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.prevent_empty_order_acceptance();
REVOKE EXECUTE ON FUNCTION public.prevent_empty_order_acceptance() FROM anon, authenticated, PUBLIC;
COMMIT;
