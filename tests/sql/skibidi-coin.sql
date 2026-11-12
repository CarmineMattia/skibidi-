-- Skibidi Coin su PGlite. Database usa e getta, nessun progetto ospitato.
-- Un'unica transazione: i ROLLBACK dei singoli casi sono savepoint, così non
-- cancellano gli ordini e gli accrediti già scritti.
BEGIN;

CREATE FUNCTION public.t_status(p_order uuid, p_admin uuid, p_to text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_status text;
  v_guard integer := 0;
BEGIN
  PERFORM public.t_as('authenticated', p_admin);
  LOOP
    SELECT status INTO v_status FROM public.orders WHERE id = p_order;
    EXIT WHEN v_status = p_to;
    v_guard := v_guard + 1;
    IF v_guard > 6 THEN
      RAISE EXCEPTION 'status walk stuck at %', v_status;
    END IF;
    UPDATE public.orders
    SET status = CASE v_status
      WHEN 'pending' THEN CASE WHEN p_to IN ('cancelled', 'rejected') THEN p_to ELSE 'accepted' END
      WHEN 'accepted' THEN 'preparing'
      WHEN 'preparing' THEN 'ready'
      WHEN 'ready' THEN 'delivered'
      ELSE v_status
    END
    WHERE id = p_order;
  END LOOP;
  PERFORM public.t_clear();
END $$;

INSERT INTO public.orders (id, company_id, customer_id, total_amount, points_requested) VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 15.90, 0),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 20, 0),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 8, 0),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 3.40, 0),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c2', 20, 0),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 25, 100),
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 25, 100),
  ('00000000-0000-0000-0000-000000000108', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 30, 150),
  ('00000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 30, 0);
INSERT INTO public.order_items (order_id, total_price) VALUES
  ('00000000-0000-0000-0000-000000000101', 12.90),
  ('00000000-0000-0000-0000-000000000102', 20),
  ('00000000-0000-0000-0000-000000000103', 8),
  ('00000000-0000-0000-0000-000000000104', 0.40),
  ('00000000-0000-0000-0000-000000000105', 20),
  ('00000000-0000-0000-0000-000000000106', 20),
  ('00000000-0000-0000-0000-000000000107', 20),
  ('00000000-0000-0000-0000-000000000108', 20),
  ('00000000-0000-0000-0000-000000000109', 30);


-- 1) Forma, RLS, grant, niente ricariche a pagamento.
SELECT public.t_assert(
  (SELECT enabled FROM public.loyalty_settings WHERE company_id = '00000000-0000-0000-0000-000000000001')
  AND NOT (SELECT enabled FROM public.loyalty_settings WHERE company_id = '00000000-0000-0000-0000-000000000002')
  AND (SELECT points_per_euro FROM public.loyalty_settings WHERE company_id = '00000000-0000-0000-0000-000000000001') = 1
  AND (SELECT points_per_redeem_unit FROM public.loyalty_settings WHERE company_id = '00000000-0000-0000-0000-000000000001') = 100
  AND (SELECT redeem_value_eur FROM public.loyalty_settings WHERE company_id = '00000000-0000-0000-0000-000000000001') = 5
  AND (SELECT expiry_months FROM public.loyalty_settings WHERE company_id = '00000000-0000-0000-0000-000000000001') = 12,
  'defaults: Ambrosia on, 1/100/5/12');
SELECT public.t_assert(
  (SELECT relrowsecurity AND NOT relforcerowsecurity FROM pg_class WHERE relname = 'loyalty_ledger')
  AND (SELECT relrowsecurity FROM pg_class WHERE relname = 'loyalty_accounts')
  AND (SELECT relrowsecurity FROM pg_class WHERE relname = 'loyalty_settings')
  AND (SELECT reloptions FROM pg_class WHERE relname = 'loyalty_balances') @> ARRAY['security_invoker=true'],
  'RLS on, view is security invoker');
SELECT public.t_assert(
  NOT has_table_privilege('anon', 'public.loyalty_ledger', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.loyalty_ledger', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.loyalty_ledger', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.loyalty_ledger', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.loyalty_ledger', 'DELETE')
  AND has_table_privilege('authenticated', 'public.loyalty_ledger', 'SELECT')
  AND NOT has_function_privilege('anon', 'public.loyalty_my_summary()', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.loyalty_my_summary()', 'EXECUTE'),
  'anon has nothing and clients cannot write the ledger');
SELECT public.t_assert(
  has_function_privilege('authenticated', 'public.loyalty_confirm_redeem(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.loyalty_gift(uuid, integer, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.loyalty_gift(uuid, integer, text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.loyalty_credit_order(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.loyalty_credit_order(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.loyalty_normalize_request(uuid, uuid, numeric, text)', 'EXECUTE'),
  'clients call confirm and gift only; credit stays on the server');
SELECT public.t_assert(
  (SELECT count(*) FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'loyalty%'
      AND (NOT p.prosecdef OR NOT (coalesce(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=public']))) = 0,
  'every loyalty function is security definer with search_path=public');
SELECT public.t_assert(
  position('FOR UPDATE' in pg_get_functiondef('public.loyalty_confirm_redeem(uuid)'::regprocedure)) > 0
  AND position('FOR UPDATE' in pg_get_functiondef('public.loyalty_ensure_account(uuid, uuid)'::regprocedure)) > 0,
  'redeem locks the account row');
SELECT public.t_assert(
  position('loyalty_normalize_request' in pg_get_functiondef('public.create_order_with_items(jsonb, jsonb)'::regprocedure)) > 0
  AND position('points_requested' in pg_get_functiondef('public.create_order_with_items(jsonb, jsonb)'::regprocedure)) > 0
  AND position('v_total' in pg_get_functiondef('public.create_order_with_items(jsonb, jsonb)'::regprocedure)) > 0,
  'checkout stores the request and still saves the server total');
SELECT public.t_assert(
  to_regprocedure('public.loyalty_topup(uuid, integer)') IS NULL
  AND to_regprocedure('public.loyalty_purchase(uuid, numeric)') IS NULL,
  'no paid top-up function');
SELECT public.t_assert(
  position('ORDER_LOCKED_FOR_CUSTOMER' in pg_get_functiondef('public.prevent_customer_order_tampering()'::regprocedure)) > 0
  AND position('Invalid order status transition' in pg_get_functiondef('public.enforce_order_manual_approval()'::regprocedure)) > 0
  AND (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_enforce_order_manual_approval' AND tgrelid = 'public.orders'::regclass) = 1
  AND (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_prevent_customer_order_tampering' AND tgrelid = 'public.orders'::regclass) = 1
  AND (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_loyalty_credit_on_delivered' AND tgrelid = 'public.orders'::regclass) = 1,
  'approval and tamper triggers still installed');

-- 2) anon, niente auto-accredito, trigger esistenti.
SAVEPOINT skibidi_sp_1;
SELECT public.t_as('anon', NULL);
SELECT public.t_expect_detail($$SELECT count(*) FROM public.loyalty_ledger$$, 'permission denied');
SELECT public.t_expect_detail($$SELECT count(*) FROM public.loyalty_accounts$$, 'permission denied');
SELECT public.t_expect_detail($$SELECT count(*) FROM public.loyalty_settings$$, 'permission denied');
SELECT public.t_expect_detail($$SELECT count(*) FROM public.loyalty_balances$$, 'permission denied');
SELECT public.t_expect_detail($$SELECT public.loyalty_my_summary()$$, 'permission denied');
ROLLBACK TO SAVEPOINT skibidi_sp_1;
SELECT public.t_clear();

SAVEPOINT skibidi_sp_2;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c1');
SELECT public.t_expect_detail(
  $$INSERT INTO public.loyalty_ledger (account_id, company_id, customer_id, type, quantity) VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'earn_order', 999)$$,
  'permission denied');
SELECT public.t_expect_detail(
  $$SELECT public.loyalty_credit_order('00000000-0000-0000-0000-000000000101')$$,
  'permission denied');
SELECT public.t_expect_detail(
  $$SELECT public.loyalty_gift('00000000-0000-0000-0000-0000000000c1', 10, 'da solo')$$,
  'LOYALTY_NOT_STAFF');
ROLLBACK TO SAVEPOINT skibidi_sp_2;
SELECT public.t_clear();

SAVEPOINT skibidi_sp_3;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000c1","is_anonymous":false}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
SELECT public.t_expect_detail(
  $$UPDATE public.orders SET notes = 'hack' WHERE id = '00000000-0000-0000-0000-000000000101'$$,
  'ORDER_LOCKED_FOR_CUSTOMER');
ROLLBACK TO SAVEPOINT skibidi_sp_3;
SELECT public.t_clear();

SAVEPOINT skibidi_sp_4;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
SELECT public.t_expect_detail(
  $$UPDATE public.orders SET status = 'delivered' WHERE id = '00000000-0000-0000-0000-000000000101'$$,
  'Invalid order status transition');
SELECT public.t_expect_detail(
  $$UPDATE public.orders SET points_redeemed = 100 WHERE id = '00000000-0000-0000-0000-000000000101'$$,
  'LOYALTY_POINTS_LOCKED');
ROLLBACK TO SAVEPOINT skibidi_sp_4;
SELECT public.t_clear();

SAVEPOINT skibidi_sp_5;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c1');
UPDATE public.orders SET status = 'delivered' WHERE id = '00000000-0000-0000-0000-000000000101';
SELECT public.t_assert(
  (SELECT status FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000101') = 'pending',
  'customer status update does not apply');
ROLLBACK TO SAVEPOINT skibidi_sp_5;
SELECT public.t_clear();

-- 3) Annullato, non ritirato, vuoto, altra company: nessun accredito.
SELECT public.t_status('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-0000000000a1', 'cancelled');
SELECT public.t_status('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-0000000000a1', 'ready');
SELECT public.t_status('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-0000000000a1', 'delivered');
SELECT public.t_status('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-0000000000a2', 'delivered');
SELECT public.t_assert(
  (SELECT count(*) FROM public.loyalty_ledger) = 0,
  'cancelled, not collected, empty and disabled company earn nothing');

-- 4) Accredito sul consegnato, idempotente, senza la consegna.
SELECT public.t_status('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000000a1', 'delivered');
SELECT public.t_assert(
  (SELECT quantity FROM public.loyalty_ledger WHERE order_id = '00000000-0000-0000-0000-000000000101' AND type = 'earn_order') = 12
  AND (SELECT count(*) FROM public.loyalty_ledger WHERE type = 'earn_order') = 1,
  'floor of merchandise, delivery fee excluded');
SELECT public.loyalty_credit_order('00000000-0000-0000-0000-000000000101');
SELECT public.t_assert(
  (SELECT count(*) FROM public.loyalty_ledger WHERE order_id = '00000000-0000-0000-0000-000000000101' AND type = 'earn_order') = 1
  AND (SELECT quantity FROM public.loyalty_ledger WHERE order_id = '00000000-0000-0000-0000-000000000101' AND type = 'earn_order') = 12,
  'second credit does not add a row and does not edit the first');
SAVEPOINT skibidi_sp_6;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
SELECT public.t_expect_detail(
  $$UPDATE public.orders SET status = 'pending' WHERE id = '00000000-0000-0000-0000-000000000101'$$,
  'Invalid order status transition');
ROLLBACK TO SAVEPOINT skibidi_sp_6;
SELECT public.t_clear();

-- Programma acceso dopo la consegna: niente recupero retroattivo.
UPDATE public.loyalty_settings SET enabled = true WHERE company_id = '00000000-0000-0000-0000-000000000002';
SELECT public.t_assert(
  (SELECT count(*) FROM public.loyalty_ledger WHERE order_id = '00000000-0000-0000-0000-000000000105') = 0,
  'enabling later does not backfill');
UPDATE public.loyalty_settings SET enabled = false WHERE company_id = '00000000-0000-0000-0000-000000000002';

-- 5) Regalo dello staff, motivo obbligatorio, niente cross-company.
SAVEPOINT skibidi_sp_7;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
SELECT public.t_expect_detail(
  $$SELECT public.loyalty_gift('00000000-0000-0000-0000-0000000000c1', 10, 'no')$$,
  'LOYALTY_REASON_REQUIRED');
SELECT public.t_expect_detail(
  $$SELECT public.loyalty_gift('00000000-0000-0000-0000-0000000000c2', 10, 'cliente di un''altra pizzeria')$$,
  'LOYALTY_OTHER_COMPANY');
ROLLBACK TO SAVEPOINT skibidi_sp_7;
SELECT public.t_clear();
SAVEPOINT skibidi_sp_8;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000d1');
SELECT public.t_expect_detail(
  $$SELECT public.loyalty_gift('00000000-0000-0000-0000-0000000000c1', 10, 'dalla cassa kiosk')$$,
  'LOYALTY_NOT_STAFF');
ROLLBACK TO SAVEPOINT skibidi_sp_8;
SELECT public.t_clear();

SAVEPOINT skibidi_sp_9;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
SELECT public.loyalty_gift('00000000-0000-0000-0000-0000000000c1', 100, 'Omaggio banco');
RELEASE SAVEPOINT skibidi_sp_9;
SELECT public.t_clear();
SELECT public.t_assert(
  (SELECT quantity FROM public.loyalty_ledger WHERE type = 'gift' AND customer_id = '00000000-0000-0000-0000-0000000000c1') = 100
  AND (SELECT staff_user_id FROM public.loyalty_ledger WHERE type = 'gift') = '00000000-0000-0000-0000-0000000000a1'
  AND public.loyalty_balance(
       (SELECT id FROM public.loyalty_accounts WHERE customer_id = '00000000-0000-0000-0000-0000000000c1'),
       now()) = 112,
  'gift 100 plus earn 12');

SELECT public.t_assert(
  public.loyalty_normalize_request('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 20, '100') = 100
  AND public.loyalty_normalize_request('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 20, '0') = 0
  AND public.loyalty_normalize_request('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 20, NULL) = 0,
  'request of 100 is accepted and does not spend');
SELECT public.t_expect_detail(
  $$SELECT public.loyalty_normalize_request('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 20, '50')$$,
  'LOYALTY_NOT_MULTIPLE');
SELECT public.t_expect_detail(
  $$SELECT public.loyalty_normalize_request('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 4, '100')$$,
  'LOYALTY_DISCOUNT_TOO_HIGH');
SELECT public.t_expect_detail(
  $$SELECT public.loyalty_normalize_request('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c2', 20, '100')$$,
  'LOYALTY_DISABLED');

-- 6) Storno dell'accredito: riga nuova, la vecchia resta.
SAVEPOINT skibidi_sp_10;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
SELECT public.loyalty_reverse(
  (SELECT id FROM public.loyalty_ledger WHERE type = 'earn_order' AND order_id = '00000000-0000-0000-0000-000000000101'),
  'Accredito errato');
RELEASE SAVEPOINT skibidi_sp_10;
SELECT public.t_clear();
SELECT public.t_assert(
  (SELECT quantity FROM public.loyalty_ledger WHERE type = 'earn_order' AND order_id = '00000000-0000-0000-0000-000000000101') = 12
  AND (SELECT quantity FROM public.loyalty_ledger WHERE type = 'reversal' AND order_id = '00000000-0000-0000-0000-000000000101') = -12
  AND public.loyalty_balance(
       (SELECT id FROM public.loyalty_accounts WHERE customer_id = '00000000-0000-0000-0000-0000000000c1'),
       now()) = 100,
  'reversal keeps the original earn row');
SELECT public.t_expect_detail(
  $$UPDATE public.loyalty_ledger SET quantity = 1 WHERE type = 'earn_order'$$,
  'LOYALTY_APPEND_ONLY');
SELECT public.t_expect_detail(
  $$DELETE FROM public.loyalty_ledger WHERE type = 'gift'$$,
  'LOYALTY_APPEND_ONLY');
SAVEPOINT skibidi_sp_11;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
SELECT public.t_expect_detail(
  $$SELECT public.loyalty_reverse((SELECT id FROM public.loyalty_ledger WHERE type = 'earn_order' LIMIT 1), 'di nuovo')$$,
  'LOYALTY_ALREADY_REVERSED');
ROLLBACK TO SAVEPOINT skibidi_sp_11;
SELECT public.t_clear();

-- 7) Conferma in cassa. Il totale non cambia. Il secondo riscatto non va in negativo.
SAVEPOINT skibidi_sp_12;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a2');
SELECT public.t_expect_detail(
  $$SELECT public.loyalty_confirm_redeem('00000000-0000-0000-0000-000000000106')$$,
  'LOYALTY_OTHER_COMPANY');
ROLLBACK TO SAVEPOINT skibidi_sp_12;
SELECT public.t_clear();
SAVEPOINT skibidi_sp_13;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
SELECT public.loyalty_confirm_redeem('00000000-0000-0000-0000-000000000106');
RELEASE SAVEPOINT skibidi_sp_13;
SELECT public.t_clear();
SELECT public.t_assert(
  (SELECT total_amount FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000106') = 25
  AND (SELECT points_redeemed FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000106') = 100
  AND (SELECT points_discount_eur FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000106') = 5
  AND (SELECT points_confirmed_by FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000106') = '00000000-0000-0000-0000-0000000000a1'
  AND (SELECT sum(quantity) FROM public.loyalty_ledger WHERE type = 'redeem' AND order_id = '00000000-0000-0000-0000-000000000106') = -100
  AND public.loyalty_balance(
       (SELECT id FROM public.loyalty_accounts WHERE customer_id = '00000000-0000-0000-0000-0000000000c1'),
       now()) = 0,
  'confirm writes the discount beside the total and spends the points');
SAVEPOINT skibidi_sp_14;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
SELECT public.t_expect_detail(
  $$SELECT public.loyalty_confirm_redeem('00000000-0000-0000-0000-000000000106')$$,
  'LOYALTY_ALREADY_CONFIRMED');
SELECT public.t_expect_detail(
  $$SELECT public.loyalty_confirm_redeem('00000000-0000-0000-0000-000000000107')$$,
  'LOYALTY_INSUFFICIENT');
ROLLBACK TO SAVEPOINT skibidi_sp_14;
SELECT public.t_clear();

-- 8) Storno del riscatto, poi due lotti e un riscatto che li attraversa.
SAVEPOINT skibidi_sp_15;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
SELECT public.loyalty_reverse(
  (SELECT id FROM public.loyalty_ledger WHERE type = 'redeem' AND order_id = '00000000-0000-0000-0000-000000000106' LIMIT 1),
  'Sconto annullato in cassa');
RELEASE SAVEPOINT skibidi_sp_15;
SELECT public.t_clear();
SELECT public.t_assert(
  (SELECT points_redeemed FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000106') IS NULL
  AND public.loyalty_balance(
       (SELECT id FROM public.loyalty_accounts WHERE customer_id = '00000000-0000-0000-0000-0000000000c1'),
       now()) = 100,
  'reversal of a redeem gives the points back');

INSERT INTO public.loyalty_ledger (
  account_id, company_id, customer_id, type, quantity, staff_user_id, reason, expires_at
) VALUES (
  (SELECT id FROM public.loyalty_accounts WHERE customer_id = '00000000-0000-0000-0000-0000000000c1'),
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000c1',
  'gift', 100, '00000000-0000-0000-0000-0000000000a1', 'Lotto che scade prima',
  now() + interval '10 days'
);
UPDATE public.loyalty_settings SET points_per_redeem_unit = 50
WHERE company_id = '00000000-0000-0000-0000-000000000001';
SAVEPOINT skibidi_sp_16;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
SELECT public.loyalty_confirm_redeem('00000000-0000-0000-0000-000000000108');
RELEASE SAVEPOINT skibidi_sp_16;
SELECT public.t_clear();
UPDATE public.loyalty_settings SET points_per_redeem_unit = 100
WHERE company_id = '00000000-0000-0000-0000-000000000001';
SELECT public.t_assert(
  (SELECT count(*) FROM public.loyalty_ledger WHERE type = 'redeem' AND order_id = '00000000-0000-0000-0000-000000000108') = 2
  AND (SELECT r.quantity FROM public.loyalty_ledger r
       JOIN public.loyalty_ledger src ON src.id = r.source_ledger_id
       WHERE r.order_id = '00000000-0000-0000-0000-000000000108' AND r.type = 'redeem'
         AND src.expires_at < now() + interval '11 days') = -100
  AND public.loyalty_balance(
       (SELECT id FROM public.loyalty_accounts WHERE customer_id = '00000000-0000-0000-0000-0000000000c1'),
       now()) = 50
  AND public.loyalty_balance(
       (SELECT id FROM public.loyalty_accounts WHERE customer_id = '00000000-0000-0000-0000-0000000000c1'),
       now() + interval '20 days') = 50
  AND public.loyalty_balance(
       (SELECT id FROM public.loyalty_accounts WHERE customer_id = '00000000-0000-0000-0000-0000000000c1'),
       now() + interval '13 months') = 0,
  'fifo slices expire with their lot and the balance does not go negative');

-- 9) Scadenza: il saldo ignora il lotto, expire_due lascia la traccia.
INSERT INTO public.loyalty_ledger (
  account_id, company_id, customer_id, type, quantity, order_id, expires_at
) VALUES (
  (SELECT id FROM public.loyalty_accounts WHERE customer_id = '00000000-0000-0000-0000-0000000000c1'),
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000c1',
  'earn_order', 30, '00000000-0000-0000-0000-000000000109', now() - interval '1 day'
);
SELECT public.t_assert(
  public.loyalty_balance(
    (SELECT id FROM public.loyalty_accounts WHERE customer_id = '00000000-0000-0000-0000-0000000000c1'),
    now()) = 50,
  'already expired earn is outside the balance');
SELECT public.t_assert(public.loyalty_expire_due('00000000-0000-0000-0000-000000000001') = 1, 'expire row written once');
SELECT public.t_assert(public.loyalty_expire_due('00000000-0000-0000-0000-000000000001') = 0, 'expire is idempotent');
SELECT public.t_assert(
  (SELECT quantity FROM public.loyalty_ledger WHERE type = 'expire') = -30
  AND public.loyalty_balance(
       (SELECT id FROM public.loyalty_accounts WHERE customer_id = '00000000-0000-0000-0000-0000000000c1'),
       now()) = 50,
  'expire audit does not double-subtract');

-- 10) Isolamento tra company e lettura del cliente.
INSERT INTO public.loyalty_accounts (customer_id, company_id)
VALUES ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000002');
INSERT INTO public.loyalty_ledger (
  account_id, company_id, customer_id, type, quantity, staff_user_id, reason, expires_at
) VALUES (
  (SELECT id FROM public.loyalty_accounts WHERE customer_id = '00000000-0000-0000-0000-0000000000c2'),
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-0000000000c2',
  'gift', 7, '00000000-0000-0000-0000-0000000000a2', 'Omaggio altra pizzeria',
  now() + interval '1 month'
);
SAVEPOINT skibidi_sp_17;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c1');
SELECT public.t_assert(
  (SELECT count(*) FROM public.loyalty_ledger WHERE customer_id <> '00000000-0000-0000-0000-0000000000c1') = 0
  AND (SELECT count(*) FROM public.loyalty_accounts WHERE customer_id <> '00000000-0000-0000-0000-0000000000c1') = 0
  AND (SELECT count(*) FROM public.loyalty_settings) = 1
  AND (SELECT (public.loyalty_my_summary()->>'balance')::integer) = 50
  AND (SELECT count(*) FROM public.loyalty_my_ledger(20)) = (SELECT count(*) FROM public.loyalty_ledger),
  'customer reads only their Ambrosia rows');
ROLLBACK TO SAVEPOINT skibidi_sp_17;
SELECT public.t_clear();
SAVEPOINT skibidi_sp_18;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
SELECT public.t_assert(
  (SELECT count(*) FROM public.loyalty_ledger WHERE company_id = '00000000-0000-0000-0000-000000000002') = 0
  AND (SELECT count(*) FROM public.loyalty_staff_ledger(20)) = (SELECT count(*) FROM public.loyalty_ledger),
  'Ambrosia staff cannot read the other company ledger');
ROLLBACK TO SAVEPOINT skibidi_sp_18;
SELECT public.t_clear();
SAVEPOINT skibidi_sp_19;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c2');
SELECT public.t_assert(
  (public.loyalty_my_summary()->>'enabled')::boolean = false
  AND (public.loyalty_my_summary()->>'balance')::integer = 7,
  'other company program stays off and its balance is separate');
ROLLBACK TO SAVEPOINT skibidi_sp_19;
SELECT public.t_clear();

-- PGlite ha una sola sessione: il secondo riscatto qui sopra è il controllo
-- di non andare sotto zero dopo che il primo ha preso il lock e scritto.
-- Il FOR UPDATE è affermato sul sorgente della funzione.

-- 11) Tracking: punti sì, dati del cliente no. Proprietario o staff della company.
SELECT public.t_assert(
  NOT has_function_privilege('anon', 'public.get_order_tracking(uuid)', 'EXECUTE')
  AND position('points_requested' in pg_get_functiondef('public.get_order_tracking(uuid)'::regprocedure)) > 0
  AND position('customer_name' in pg_get_functiondef('public.get_order_tracking(uuid)'::regprocedure)) = 0,
  'tracking exposes points and not the customer name');
SAVEPOINT skibidi_sp_20;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c1');
SELECT public.t_assert(
  (public.get_order_tracking('00000000-0000-0000-0000-000000000108')->>'points_redeemed')::integer = 150
  AND (public.get_order_tracking('00000000-0000-0000-0000-000000000108')->>'points_discount_eur')::numeric = 15
  AND (public.get_order_tracking('00000000-0000-0000-0000-000000000106')->>'points_requested')::integer = 100
  AND (public.get_order_tracking('00000000-0000-0000-0000-000000000106')->>'points_redeemed') IS NULL
  AND NOT (public.get_order_tracking('00000000-0000-0000-0000-000000000108') ? 'customer_name')
  AND NOT (public.get_order_tracking('00000000-0000-0000-0000-000000000108') ? 'customer_phone')
  AND NOT (public.get_order_tracking('00000000-0000-0000-0000-000000000108') ? 'delivery_address')
  AND NOT (public.get_order_tracking('00000000-0000-0000-0000-000000000108') ? 'notes')
  AND NOT (public.get_order_tracking('00000000-0000-0000-0000-000000000108') ? 'points_confirmed_by'),
  'owner sees the points status without personal data');
ROLLBACK TO SAVEPOINT skibidi_sp_20;
SELECT public.t_clear();
SAVEPOINT skibidi_sp_21;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000a2');
SELECT public.t_assert(
  public.get_order_tracking('00000000-0000-0000-0000-000000000108') IS NULL,
  'other company staff cannot track the order');
ROLLBACK TO SAVEPOINT skibidi_sp_21;
SELECT public.t_clear();
SAVEPOINT skibidi_sp_22;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c2');
SELECT public.t_assert(
  public.get_order_tracking('00000000-0000-0000-0000-000000000108') IS NULL,
  'another customer cannot track the order');
ROLLBACK TO SAVEPOINT skibidi_sp_22;
SELECT public.t_clear();
SAVEPOINT skibidi_sp_23;
SELECT public.t_as('anon', NULL);
SELECT public.t_expect_detail(
  $$SELECT public.get_order_tracking('00000000-0000-0000-0000-000000000108')$$,
  'permission denied');
ROLLBACK TO SAVEPOINT skibidi_sp_23;
SELECT public.t_clear();
SELECT 'skibidi coin ok' AS status;
COMMIT;
