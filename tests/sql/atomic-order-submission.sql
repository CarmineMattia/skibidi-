\set ON_ERROR_STOP on
SET ROLE anon;
DO $$
DECLARE o jsonb := '{"id":"00000000-0000-0000-0000-000000000021","company_id":"00000000-0000-0000-0000-000000000001","display_code":"Diavola #1","total_amount":10,"order_type":"take_away"}';
 i jsonb := '[{"product_id":"00000000-0000-0000-0000-000000000011","quantity":2,"unit_price":5,"total_price":10}]';
 r jsonb;
BEGIN
 r := public.create_order_with_items(o, i);
 IF r->>'id' <> o->>'id' THEN RAISE EXCEPTION 'Missing acknowledgement'; END IF;
 r := public.create_order_with_items(o, i);
 IF r->>'id' <> o->>'id' THEN RAISE EXCEPTION 'Retry missing acknowledgement'; END IF;
 IF EXISTS (SELECT 1 FROM orders) THEN RAISE EXCEPTION 'Guest SELECT leaked orders'; END IF;
 BEGIN
   PERFORM public.create_order_with_items(o, jsonb_set(jsonb_set(i, '{0,quantity}', '1'), '{0,total_price}', '5'));
   RAISE EXCEPTION 'Expected changed retry to fail';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM = 'Expected changed retry to fail' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.create_order_with_items(jsonb_set(o, '{id}', '"00000000-0000-0000-0000-000000000022"'), jsonb_set(i, '{0,notes}', '"force failure"'));
   RAISE EXCEPTION 'Expected line constraint to fail';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF public.get_order_tracking('00000000-0000-0000-0000-000000000022') IS NOT NULL THEN RAISE EXCEPTION 'Orphan header survived transaction'; END IF;
 BEGIN
   PERFORM public.create_order_with_items(jsonb_set(o, '{id}', '"00000000-0000-0000-0000-000000000023"'), '[]');
   RAISE EXCEPTION 'Expected empty cart to fail';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM = 'Expected empty cart to fail' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.create_order_with_items(jsonb_set(o, '{id}', '"00000000-0000-0000-0000-000000000024"'), jsonb_set(i, '{0,product_id}', '"00000000-0000-0000-0000-000000000099"'));
   RAISE EXCEPTION 'Expected foreign product to fail';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM = 'Expected foreign product to fail' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM orders) <> 1 OR (SELECT count(*) FROM order_items) <> 1 THEN
  RAISE EXCEPTION 'Duplicate order or line created';
 END IF;
END $$;
DO $$ BEGIN
 BEGIN
  INSERT INTO orders(id,company_id,status,fiscal_status,total_amount)
    VALUES ('00000000-0000-0000-0000-000000000025','00000000-0000-0000-0000-000000000001','pending','pending',5);
  UPDATE orders SET status='preparing' WHERE id='00000000-0000-0000-0000-000000000025';
  RAISE EXCEPTION 'Expected empty order acceptance to fail';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'Cannot accept an order without saved items' THEN RAISE; END IF;
 END;
END $$;
-- Separate guest and staff roles share the actual persisted order, not a mock.
SET ROLE anon;
DO $$ DECLARE r jsonb; BEGIN
 r := public.get_order_tracking('00000000-0000-0000-0000-000000000021');
 IF r->>'status' <> 'pending' OR jsonb_array_length(r->'order_items') <> 1 THEN
  RAISE EXCEPTION 'Guest tracking did not reflect the saved pending order';
 END IF;
END $$;
RESET ROLE;
SET ROLE authenticated;
SET test.staff = 'true';
SET test.company_id = '00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM orders) OR EXISTS (SELECT 1 FROM order_items) THEN
  RAISE EXCEPTION 'Other restaurant can read the order';
 END IF;
END $$;
SET test.company_id = '00000000-0000-0000-0000-000000000001';
DO $$ DECLARE saved_id uuid; BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id
  WHERE o.id = '00000000-0000-0000-0000-000000000021'
   AND o.status = 'pending' AND i.quantity = 2 AND i.total_price = 10
 ) THEN RAISE EXCEPTION 'Kitchen cannot read the submitted order and lines'; END IF;
 UPDATE orders SET status = 'preparing'
  WHERE id = '00000000-0000-0000-0000-000000000021' RETURNING id INTO saved_id;
 IF saved_id IS NULL THEN RAISE EXCEPTION 'Kitchen acceptance was not saved'; END IF;
END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
 IF public.get_order_tracking('00000000-0000-0000-0000-000000000021')->>'status' <> 'preparing' THEN
  RAISE EXCEPTION 'Guest cannot see the kitchen acceptance';
 END IF;
END $$;
RESET ROLE;
SELECT 'PASS: guest save, kitchen reads saved lines, staff acceptance, guest tracking, tenant isolation, retry, rollback and invalid input';
