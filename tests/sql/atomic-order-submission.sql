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
   PERFORM public.create_order_with_items(o, jsonb_set(i, '{0,quantity}', '1'));
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
SELECT 'PASS: guest transaction, real acknowledgement, retry deduplication, rollback, privacy, invalid carts and products';
