-- Runs after atomic-order-schema + 20261008 + 20261013_order_manual_approval_guard (fixture uses text status).
CREATE OR REPLACE FUNCTION pg_temp.expect_fail(sql text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE sql; EXCEPTION WHEN raise_exception THEN RETURN; END;
  RAISE EXCEPTION 'Expected failure: %', label;
END $$;
INSERT INTO orders (id, company_id, display_code, status, fiscal_status, total_amount, order_type)
VALUES ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','A #1','pending','pending',5,'take_away'),
       ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000001','A #2','pending','pending',5,'take_away'),
       ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000001','A #3','pending','pending',5,'take_away');
INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
SELECT id, '00000000-0000-0000-0000-000000000011', 1, 5, 5 FROM orders WHERE id::text LIKE '%a1' OR id::text LIKE '%a2';
SELECT pg_temp.expect_fail($$INSERT INTO orders (id, company_id, status, fiscal_status, total_amount, order_type) VALUES ('00000000-0000-0000-0000-0000000000a9','00000000-0000-0000-0000-000000000001','preparing','pending',5,'take_away')$$, 'insert not pending');
SET test.staff = 'false';
SELECT pg_temp.expect_fail($$UPDATE orders SET status='preparing' WHERE id='00000000-0000-0000-0000-0000000000a1'$$, 'pending->preparing skip');
SELECT pg_temp.expect_fail($$UPDATE orders SET status='accepted' WHERE id='00000000-0000-0000-0000-0000000000a1'$$, 'non-admin accept');
SELECT pg_temp.expect_fail($$UPDATE orders SET status='rejected' WHERE id='00000000-0000-0000-0000-0000000000a1'$$, 'non-admin reject');
SET test.staff = 'true';
SELECT pg_temp.expect_fail($$UPDATE orders SET status='accepted' WHERE id='00000000-0000-0000-0000-0000000000a3'$$, 'accept empty order');
UPDATE orders SET status='accepted' WHERE id='00000000-0000-0000-0000-0000000000a1';
DO $$ BEGIN IF (SELECT accepted_at FROM orders WHERE id='00000000-0000-0000-0000-0000000000a1') IS NULL THEN RAISE EXCEPTION 'accepted_at not stamped'; END IF; END $$;
SELECT pg_temp.expect_fail($$UPDATE orders SET status='ready' WHERE id='00000000-0000-0000-0000-0000000000a1'$$, 'accepted->ready skip');
UPDATE orders SET status='preparing' WHERE id='00000000-0000-0000-0000-0000000000a1';
UPDATE orders SET status='ready' WHERE id='00000000-0000-0000-0000-0000000000a1';
UPDATE orders SET status='delivered' WHERE id='00000000-0000-0000-0000-0000000000a1';
SELECT pg_temp.expect_fail($$UPDATE orders SET status='pending' WHERE id='00000000-0000-0000-0000-0000000000a1'$$, 'terminal delivered');
SELECT pg_temp.expect_fail($$UPDATE orders SET accepted_at=NULL, status='cancelled' WHERE id='00000000-0000-0000-0000-0000000000a1'$$, 'delivered->cancelled');
UPDATE orders SET status='rejected' WHERE id='00000000-0000-0000-0000-0000000000a2';
SELECT pg_temp.expect_fail($$UPDATE orders SET status='accepted' WHERE id='00000000-0000-0000-0000-0000000000a2'$$, 'terminal rejected');
UPDATE orders SET status='cancelled' WHERE id='00000000-0000-0000-0000-0000000000a3';
SELECT 'PASS: manual approval transitions';
