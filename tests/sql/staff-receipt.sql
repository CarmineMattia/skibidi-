-- AFTER 20261023140000_staff_receipt_issue.sql. Disposable local DB only.
-- "Emetti scontrino": only an admin of the order's company (or service_role)
-- can claim and record a receipt; the lease stops a double receipt; the
-- outcome never touches anything but the receipt columns.
CREATE OR REPLACE FUNCTION pg_temp.expect_err(q text, want text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d text; s text;
BEGIN
  BEGIN
    EXECUTE q;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS d = PG_EXCEPTION_DETAIL, s = RETURNED_SQLSTATE;
    IF coalesce(d, '') = want OR s = want THEN RETURN; END IF;
    RAISE EXCEPTION '%: expected %, got % / % (%)', label, want, s, d, SQLERRM;
  END;
  RAISE EXCEPTION '%: expected %, but it succeeded', label, want;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.expect_err(text, text, text) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION pg_temp.receipt(p uuid) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', fiscal_status::text, fiscal_external_id, pdf_url, notes) FROM public.orders WHERE id = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.receipt(uuid) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION pg_temp.check(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'check failed: %', label; END IF; END $$;
GRANT EXECUTE ON FUNCTION pg_temp.check(boolean, text) TO anon, authenticated, service_role;

SELECT pg_temp.seed();
-- 101: c1's order, delivered (billable). 102: guest order still awaiting approval.
-- 103: company 2, delivered. 104: accepted. 105: ready. 106: accepted but empty.
-- (through the real transitions: the manual-approval guard checks them)
DO $$ DECLARE s text; BEGIN
  FOREACH s IN ARRAY ARRAY['accepted', 'preparing', 'ready', 'delivered'] LOOP
    UPDATE orders SET status = s WHERE id IN ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000103');
  END LOOP;
END $$;
INSERT INTO orders (id, company_id, customer_id, display_code, status, fiscal_status, total_amount, order_type, notes) VALUES
 ('00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000001',NULL,'Ordine #4','pending','pending',10,'take_away','Pagamento alla cassa'),
 ('00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000001',NULL,'Ordine #5','pending','pending',5,'take_away',NULL),
 ('00000000-0000-0000-0000-000000000106','00000000-0000-0000-0000-000000000001',NULL,'Ordine #6','pending','pending',5,'take_away',NULL);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, notes) VALUES
 ('00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000011',2,5,10,NULL),
 ('00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000011',1,5,5,NULL),
 ('00000000-0000-0000-0000-000000000106','00000000-0000-0000-0000-000000000011',1,5,5,NULL);
DO $$ DECLARE s text; BEGIN
  UPDATE orders SET status = 'accepted' WHERE id IN ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000106');
  FOREACH s IN ARRAY ARRAY['preparing', 'ready'] LOOP
    UPDATE orders SET status = s WHERE id = '00000000-0000-0000-0000-000000000105';
  END LOOP;
END $$;
-- 106: an accepted order whose lines were lost (like the legacy empty orders on prod)
DELETE FROM order_items WHERE order_id = '00000000-0000-0000-0000-000000000106';
UPDATE products SET name = 'Margherita' WHERE id = '00000000-0000-0000-0000-000000000011';

-- 0) grants: no client role touches the lease table or the caller check; anon has no RPC.
SELECT pg_temp.check(NOT has_table_privilege('anon', 'public.order_receipt_claims', 'SELECT,INSERT,UPDATE,DELETE'), 'anon lease table');
SELECT pg_temp.check(NOT has_table_privilege('authenticated', 'public.order_receipt_claims', 'SELECT,INSERT,UPDATE,DELETE'), 'auth lease table');
SELECT pg_temp.check(NOT has_function_privilege('anon', 'public.claim_order_receipt(uuid)', 'EXECUTE'), 'anon claim');
SELECT pg_temp.check(NOT has_function_privilege('anon', 'public.record_order_receipt(uuid,uuid,boolean,text,text,text,text,text)', 'EXECUTE'), 'anon record');
SELECT pg_temp.check(NOT has_function_privilege('authenticated', 'public.receipt_caller_can_issue(uuid)', 'EXECUTE'), 'auth caller check');
SELECT pg_temp.check(has_function_privilege('authenticated', 'public.claim_order_receipt(uuid)', 'EXECUTE'), 'auth claim grant');
SELECT pg_temp.check((SELECT prosecdef AND proconfig @> ARRAY['search_path=public'] FROM pg_proc WHERE proname = 'claim_order_receipt'), 'claim secdef/search_path');
SELECT pg_temp.check((SELECT prosecdef AND proconfig @> ARRAY['search_path=public'] FROM pg_proc WHERE proname = 'record_order_receipt'), 'record secdef/search_path');
SELECT pg_temp.check((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.order_receipt_claims'::regclass), 'lease RLS on');

-- 1) anon: no access.
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SET test.staff = 'false';
SELECT pg_temp.expect_err($q$SELECT claim_order_receipt('00000000-0000-0000-0000-000000000101')$q$, '42501', 'anon claim');
SELECT pg_temp.expect_err($q$SELECT record_order_receipt('00000000-0000-0000-0000-000000000101', gen_random_uuid(), true, 'X')$q$, '42501', 'anon record');
RESET ROLE;

-- 2) customer c1 (and any non-admin, e.g. kiosk), own order: forbidden.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
SET test.staff = 'false';
SET test.company_id = '00000000-0000-0000-0000-000000000001';
SELECT pg_temp.expect_err($q$SELECT claim_order_receipt('00000000-0000-0000-0000-000000000101')$q$, 'RECEIPT_FORBIDDEN', 'customer claim');
SELECT pg_temp.expect_err($q$SELECT record_order_receipt('00000000-0000-0000-0000-000000000101', gen_random_uuid(), true, 'RT-FAKE')$q$, 'RECEIPT_FORBIDDEN', 'customer record');
SELECT pg_temp.expect_err($q$SELECT * FROM order_receipt_claims$q$, '42501', 'customer lease read');
SELECT pg_temp.expect_err($q$INSERT INTO order_receipt_claims (order_id, claim_id) VALUES ('00000000-0000-0000-0000-000000000101', gen_random_uuid())$q$, '42501', 'customer lease write');
SELECT pg_temp.expect_err($q$SELECT receipt_caller_can_issue('00000000-0000-0000-0000-000000000001')$q$, '42501', 'customer caller check');
RESET ROLE;

-- 3) admin of company 2 on a company 1 order: forbidden (same error as not found).
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
SET test.staff = 'true';
SET test.company_id = '00000000-0000-0000-0000-000000000002';
SELECT pg_temp.expect_err($q$SELECT claim_order_receipt('00000000-0000-0000-0000-000000000101')$q$, 'RECEIPT_FORBIDDEN', 'other company claim');
RESET ROLE;

-- 4) admin of company 1.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SET test.staff = 'true';
SET test.company_id = '00000000-0000-0000-0000-000000000001';
SELECT pg_temp.expect_err($q$SELECT claim_order_receipt('00000000-0000-0000-0000-0000000009ff')$q$, 'RECEIPT_FORBIDDEN', 'unknown order');
SELECT pg_temp.expect_err($q$SELECT claim_order_receipt('00000000-0000-0000-0000-000000000102')$q$, 'RECEIPT_ORDER_NOT_BILLABLE', 'awaiting approval');
SELECT pg_temp.expect_err($q$SELECT claim_order_receipt('00000000-0000-0000-0000-000000000103')$q$, 'RECEIPT_FORBIDDEN', 'company 2 order');
SELECT pg_temp.expect_err($q$SELECT claim_order_receipt('00000000-0000-0000-0000-000000000106')$q$, 'RECEIPT_ORDER_EMPTY', 'empty order');
DO $$
DECLARE c jsonb; c2 jsonb; r jsonb; n integer;
BEGIN
  c := claim_order_receipt('00000000-0000-0000-0000-000000000101');
  PERFORM pg_temp.check((c->>'already_issued')::boolean = false AND c->>'claim_id' IS NOT NULL, 'claim granted');
  PERFORM pg_temp.check((c->>'total_amount')::numeric = 5, 'claim total from DB');
  PERFORM pg_temp.check(jsonb_array_length(c->'items') = 1 AND c->'items'->0->>'name' = 'Margherita'
    AND (c->'items'->0->>'unit_price')::numeric = 5, 'claim lines from DB');
  -- second till while the first is issuing
  PERFORM pg_temp.expect_err($q$SELECT claim_order_receipt('00000000-0000-0000-0000-000000000101')$q$, 'RECEIPT_IN_PROGRESS', 'double claim');
  -- wrong / missing claim
  PERFORM pg_temp.expect_err(format($q$SELECT record_order_receipt(%L, gen_random_uuid(), true, 'MOCK-1')$q$, c->>'order_id'), 'RECEIPT_CLAIM_INVALID', 'wrong claim');
  PERFORM pg_temp.expect_err(format($q$SELECT record_order_receipt(%L, NULL, true, 'MOCK-1')$q$, c->>'order_id'), 'RECEIPT_CLAIM_INVALID', 'null claim');
  -- invalid results
  PERFORM pg_temp.expect_err(format($q$SELECT record_order_receipt(%L, %L, true, '  ')$q$, c->>'order_id', c->>'claim_id'), 'RECEIPT_INVALID_RESULT', 'blank id');
  PERFORM pg_temp.expect_err(format($q$SELECT record_order_receipt(%L, %L, true, repeat('x', 201))$q$, c->>'order_id', c->>'claim_id'), 'RECEIPT_INVALID_RESULT', 'long id');
  PERFORM pg_temp.expect_err(format($q$SELECT record_order_receipt(%L, %L, true, 'MOCK-1', 'javascript:alert(1)')$q$, c->>'order_id', c->>'claim_id'), 'RECEIPT_INVALID_RESULT', 'js link');
  PERFORM pg_temp.expect_err(format($q$SELECT record_order_receipt(%L, %L, true, 'MOCK-1', 'http://example.com/r.pdf')$q$, c->>'order_id', c->>'claim_id'), 'RECEIPT_INVALID_RESULT', 'http link');
  PERFORM pg_temp.check(pg_temp.receipt('00000000-0000-0000-0000-000000000101') = 'pending|Pagamento alla cassa', 'untouched after refusals');
  -- success
  r := record_order_receipt((c->>'order_id')::uuid, (c->>'claim_id')::uuid, true, ' MOCK-1 ', 'https://example.com/r.pdf', 'mock');
  PERFORM pg_temp.check(r->>'fiscal_status' = 'success' AND r->>'external_id' = 'MOCK-1', 'record success');
  PERFORM pg_temp.check(pg_temp.receipt('00000000-0000-0000-0000-000000000101') = 'success|MOCK-1|https://example.com/r.pdf|Pagamento alla cassa', 'receipt saved, notes kept');
  SELECT count(*) INTO n FROM fiscal_audit_log WHERE order_id = '00000000-0000-0000-0000-000000000101' AND status = 'success' AND action = 'emit';
  PERFORM pg_temp.check(n = 1, 'audit row');
  -- the same claim cannot be reused; a new claim says already issued; nothing is overwritten
  PERFORM pg_temp.expect_err(format($q$SELECT record_order_receipt(%L, %L, true, 'MOCK-2')$q$, c->>'order_id', c->>'claim_id'), 'RECEIPT_CLAIM_INVALID', 'claim reuse');
  c2 := claim_order_receipt('00000000-0000-0000-0000-000000000101');
  PERFORM pg_temp.check((c2->>'already_issued')::boolean AND c2->>'external_id' = 'MOCK-1' AND c2->>'claim_id' IS NULL, 'already issued');
  PERFORM pg_temp.check(pg_temp.receipt('00000000-0000-0000-0000-000000000101') = 'success|MOCK-1|https://example.com/r.pdf|Pagamento alla cassa', 'not overwritten');

  -- provider failure -> 'error', notes untouched, retry allowed
  c := claim_order_receipt('00000000-0000-0000-0000-000000000104');
  r := record_order_receipt((c->>'order_id')::uuid, (c->>'claim_id')::uuid, false, NULL, NULL, 'mock', repeat('e', 900), 'SERVICE_UNAVAILABLE');
  PERFORM pg_temp.check(r->>'fiscal_status' = 'error', 'record error');
  PERFORM pg_temp.check(pg_temp.receipt('00000000-0000-0000-0000-000000000104') = 'error|Pagamento alla cassa', 'error saved, notes kept');
  SELECT count(*) INTO n FROM fiscal_audit_log WHERE order_id = '00000000-0000-0000-0000-000000000104' AND status = 'error' AND char_length(error_message) = 500;
  PERFORM pg_temp.check(n = 1, 'error audit row (message capped)');
  c := claim_order_receipt('00000000-0000-0000-0000-000000000104');
  PERFORM pg_temp.check(c->>'fiscal_status' = 'error' AND c->>'claim_id' IS NOT NULL, 'retry claim');
  r := record_order_receipt((c->>'order_id')::uuid, (c->>'claim_id')::uuid, true, 'MOCK-4');
  PERFORM pg_temp.check(pg_temp.receipt('00000000-0000-0000-0000-000000000104') = 'success|MOCK-4|Pagamento alla cassa', 'retry success');
END $$;
RESET ROLE;

-- 5) stale lease (till crashed): replaced after 2 minutes; the old claim is dead.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SET test.staff = 'true';
SET test.company_id = '00000000-0000-0000-0000-000000000001';
CREATE TEMP TABLE IF NOT EXISTS stale_claim(c jsonb);
GRANT ALL ON stale_claim TO authenticated;
INSERT INTO stale_claim SELECT claim_order_receipt('00000000-0000-0000-0000-000000000105');
SELECT pg_temp.expect_err($q$SELECT claim_order_receipt('00000000-0000-0000-0000-000000000105')$q$, 'RECEIPT_IN_PROGRESS', 'fresh lease');
RESET ROLE;
UPDATE order_receipt_claims SET claimed_at = now() - interval '3 minutes' WHERE order_id = '00000000-0000-0000-0000-000000000105';
SET ROLE authenticated;
DO $$
DECLARE old jsonb := (SELECT c FROM stale_claim); fresh jsonb;
BEGIN
  fresh := claim_order_receipt('00000000-0000-0000-0000-000000000105');
  PERFORM pg_temp.check(fresh->>'claim_id' IS DISTINCT FROM old->>'claim_id', 'stale lease replaced');
  PERFORM pg_temp.expect_err(format($q$SELECT record_order_receipt(%L, %L, true, 'MOCK-OLD')$q$, old->>'order_id', old->>'claim_id'), 'RECEIPT_CLAIM_INVALID', 'old claim dead');
  PERFORM record_order_receipt((fresh->>'order_id')::uuid, (fresh->>'claim_id')::uuid, true, 'MOCK-5');
  PERFORM pg_temp.check(pg_temp.receipt('00000000-0000-0000-0000-000000000105') = 'success|MOCK-5', 'fresh claim recorded');
END $$;
RESET ROLE;

-- 6) server (service_role): any company.
SET ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', false);
SET test.staff = 'false';
SET test.company_id = '';
DO $$
DECLARE c jsonb;
BEGIN
  c := claim_order_receipt('00000000-0000-0000-0000-000000000103');
  PERFORM record_order_receipt((c->>'order_id')::uuid, (c->>'claim_id')::uuid, true, 'SRV-3');
  PERFORM pg_temp.check(pg_temp.receipt('00000000-0000-0000-0000-000000000103') = 'success|SRV-3', 'service_role receipt');
END $$;
RESET ROLE;

-- 7) nothing else changed: statuses, totals, customer, items, leases released.
SELECT pg_temp.check((SELECT string_agg(id::text || ':' || status || ':' || total_amount, ',' ORDER BY id) FROM orders) =
  '00000000-0000-0000-0000-000000000101:delivered:5,00000000-0000-0000-0000-000000000102:pending:5,00000000-0000-0000-0000-000000000103:delivered:7,00000000-0000-0000-0000-000000000104:accepted:10,00000000-0000-0000-0000-000000000105:ready:5,00000000-0000-0000-0000-000000000106:accepted:5', 'orders unchanged');
SELECT pg_temp.check(pg_temp.receipt('00000000-0000-0000-0000-000000000102') = 'pending', 'guest order untouched');
SELECT pg_temp.check((SELECT count(*) FROM order_receipt_claims) = 0, 'leases released');
SELECT 'staff receipt tests passed' AS status;
