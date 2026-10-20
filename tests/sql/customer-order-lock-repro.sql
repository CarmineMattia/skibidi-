-- BEFORE the fix (live state): documents the round18 P3 repro. Must succeed.
SELECT pg_temp.seed();
-- 1) the customer turns their 5 € take-away into a delivery after creation (no fee)
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
SET test.staff = 'false';
SET test.company_id = '';
UPDATE orders SET order_type = 'delivery', delivery_address = 'Via Roma 1', notes = 'Pagato'
 WHERE id = '00000000-0000-0000-0000-000000000101';
RESET ROLE;
-- 2) anon: a DELETE without WHERE reads no column, so only orders_delete applies
--    (not orders_select): every pending guest order of every company goes.
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
DELETE FROM orders;
RESET ROLE;
-- 3) an admin of company 2: orders_delete has no company check → company 1's orders go too.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false);
SET test.staff = 'true';
SET test.company_id = '00000000-0000-0000-0000-000000000002';
DELETE FROM orders;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM orders WHERE id IN ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102')) THEN
    RAISE EXCEPTION 'repro did not reproduce';
  END IF;
END $$;
SELECT 'REPRO (live, before fix): take_away 5 € → delivery by the customer; anon wiped guest pending orders; admin of company 2 wiped company 1 orders' AS result;
