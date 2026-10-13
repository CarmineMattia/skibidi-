-- Test antiabuso: solo DB locale usa-e-getta. Nessun DB ospitato.
\set ON_ERROR_STOP on
-- Utenti di test
INSERT INTO profiles(id) VALUES
 ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'),
 ('00000000-0000-0000-0000-0000000000a3'), ('00000000-0000-0000-0000-0000000000a4');
INSERT INTO products VALUES ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001',true,200);

CREATE FUNCTION pg_temp.expect_error(p_sql text, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> p_msg THEN RAISE EXCEPTION 'Expected % got %', p_msg, SQLERRM; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Expected error % but statement succeeded', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.expect_error(text, text) TO anon, authenticated;

CREATE FUNCTION pg_temp.ord(p_id int, p_customer text, p_total numeric DEFAULT 5, p_product text DEFAULT '00000000-0000-0000-0000-000000000011')
RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.create_order_with_items(%L::jsonb, %L::jsonb)',
    jsonb_build_object('id', format('00000000-0000-0000-0000-%s', lpad(p_id::text, 12, '0')),
      'company_id','00000000-0000-0000-0000-000000000001','customer_id', p_customer,
      'display_code','T','total_amount',p_total,'order_type','take_away'),
    jsonb_build_array(jsonb_build_object('product_id',p_product,'quantity',1,'unit_price',p_total,'total_price',p_total)));
$$;
GRANT EXECUTE ON FUNCTION pg_temp.ord(int, text, numeric, text) TO anon, authenticated;

-- 1) Ospite: niente ordini (grant revocato e controllo auth.uid()).
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    EXECUTE pg_temp.ord(101, NULL);
    RAISE EXCEPTION 'guest order accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET ROLE authenticated;
-- 1b) Sessione anonima Supabase (is_anonymous): rifiutata.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
SELECT set_config('request.jwt.claims', '{"is_anonymous":true}', false);
SELECT pg_temp.expect_error(pg_temp.ord(102, '00000000-0000-0000-0000-0000000000a4'), 'ANTIABUSE_LOGIN_REQUIRED');
SELECT set_config('request.jwt.claims', '{}', false);
-- 1c) Senza sub: rifiutato.
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT pg_temp.expect_error(pg_temp.ord(103, NULL), 'ANTIABUSE_LOGIN_REQUIRED');

-- 2) Valore massimo ordine (default 150 €).
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT pg_temp.expect_error(pg_temp.ord(110, '00000000-0000-0000-0000-0000000000a1', 200, '00000000-0000-0000-0000-000000000012'), 'ANTIABUSE_ORDER_TOO_LARGE');

-- 3) Max 2 ordini aperti; il retry idempotente dello stesso ordine passa sempre.
DO $$ BEGIN EXECUTE pg_temp.ord(111, '00000000-0000-0000-0000-0000000000a1'); EXECUTE pg_temp.ord(112, '00000000-0000-0000-0000-0000000000a1'); END $$;
DO $$ BEGIN EXECUTE pg_temp.ord(112, '00000000-0000-0000-0000-0000000000a1'); END $$;
SELECT pg_temp.expect_error(pg_temp.ord(113, '00000000-0000-0000-0000-0000000000a1'), 'ANTIABUSE_TOO_MANY_OPEN_ORDERS');
RESET ROLE;

-- 4) Rate limit: 3 ordini / 10 min anche se i precedenti sono chiusi.
UPDATE orders SET status = 'delivered' WHERE customer_id = '00000000-0000-0000-0000-0000000000a1';
SET ROLE authenticated;
DO $$ BEGIN EXECUTE pg_temp.ord(114, '00000000-0000-0000-0000-0000000000a1'); END $$;
RESET ROLE;
UPDATE orders SET status = 'delivered' WHERE customer_id = '00000000-0000-0000-0000-0000000000a1';
SET ROLE authenticated;
SELECT pg_temp.expect_error(pg_temp.ord(115, '00000000-0000-0000-0000-0000000000a1'), 'ANTIABUSE_RATE_LIMITED');
RESET ROLE;
-- fuori finestra: ok di nuovo
UPDATE orders SET created_at = now() - interval '11 minutes' WHERE customer_id = '00000000-0000-0000-0000-0000000000a1';
SET ROLE authenticated;
DO $$ BEGIN EXECUTE pg_temp.ord(116, '00000000-0000-0000-0000-0000000000a1'); END $$;

-- 5) Il cliente non può sbloccarsi né azzerare il contatore dei mancati ritiri.
SELECT pg_temp.expect_error($q$UPDATE profiles SET blocked = true WHERE id = '00000000-0000-0000-0000-0000000000a1'$q$, 'Only an admin can change abuse flags');
SELECT pg_temp.expect_error($q$UPDATE profiles SET no_show_count = 5 WHERE id = '00000000-0000-0000-0000-0000000000a1'$q$, 'Only an admin can change abuse flags');
-- 6) Il cliente non può segnare "non ritirato" né bloccare altri.
SELECT pg_temp.expect_error($q$SELECT public.mark_order_no_show('00000000-0000-0000-0000-000000000111')$q$, 'Only an admin can mark a no-show');
SELECT pg_temp.expect_error($q$SELECT public.set_customer_blocked('00000000-0000-0000-0000-0000000000a1', true)$q$, 'Only an admin can block customers');
RESET ROLE;

-- 7) Admin di un'altra pizzeria non vede l'ordine.
SET ROLE authenticated;
SET test.staff = 'true';
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ff', false);
SET test.company_id = '00000000-0000-0000-0000-000000000002';
SELECT pg_temp.expect_error($q$SELECT public.mark_order_no_show('00000000-0000-0000-0000-000000000111')$q$, 'Order not found');
-- 8) Admin giusto: 3 mancati ritiri -> blocco automatico (soglia default 3), idempotente sullo stesso ordine.
SET test.company_id = '00000000-0000-0000-0000-000000000001';
DO $$ DECLARE r jsonb; BEGIN
  r := public.mark_order_no_show('00000000-0000-0000-0000-000000000111', 'test');
  r := public.mark_order_no_show('00000000-0000-0000-0000-000000000111', 'retry');
  IF (r->>'no_show_count')::int <> 1 OR (r->>'blocked')::boolean THEN RAISE EXCEPTION 'no-show not idempotent: %', r; END IF;
  r := public.mark_order_no_show('00000000-0000-0000-0000-000000000112');
  r := public.mark_order_no_show('00000000-0000-0000-0000-000000000114');
  IF (r->>'no_show_count')::int <> 3 OR NOT (r->>'blocked')::boolean THEN RAISE EXCEPTION 'expected auto-block: %', r; END IF;
END $$;
RESET test.staff;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT blocked_reason FROM profiles WHERE id = '00000000-0000-0000-0000-0000000000a1') <> 'no_show' THEN
    RAISE EXCEPTION 'blocked_reason missing';
  END IF;
END $$;
UPDATE orders SET created_at = now() - interval '1 day', status = 'delivered';

-- 9) Account bloccato: non può ordinare.
SET ROLE authenticated;
SET test.staff = 'false';
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT pg_temp.expect_error(pg_temp.ord(120, '00000000-0000-0000-0000-0000000000a1'), 'ANTIABUSE_ACCOUNT_BLOCKED');
RESET ROLE;
-- 10) Admin sblocca manualmente -> può ordinare di nuovo.
SET ROLE authenticated;
SET test.staff = 'true';
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ff', false);
SELECT public.set_customer_blocked('00000000-0000-0000-0000-0000000000a1', false);
SET test.staff = 'false';
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
DO $$ BEGIN EXECUTE pg_temp.ord(121, '00000000-0000-0000-0000-0000000000a1'); END $$;
RESET ROLE;

-- 11) Limiti configurabili per pizzeria + Turnstile obbligatorio con pass monouso.
UPDATE companies SET max_order_total = 300, require_turnstile = true WHERE id = '00000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
SELECT pg_temp.expect_error(pg_temp.ord(130, '00000000-0000-0000-0000-0000000000a2', 200, '00000000-0000-0000-0000-000000000012'), 'ANTIABUSE_CAPTCHA_REQUIRED');
DO $$ BEGIN
  BEGIN
    PERFORM * FROM order_captcha_passes;
    RAISE EXCEPTION 'client can read captcha passes';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
-- l'edge function (service role) scrive un pass valido
INSERT INTO order_captcha_passes(user_id, expires_at) VALUES ('00000000-0000-0000-0000-0000000000a2', now() + interval '5 minutes');
SET ROLE authenticated;
DO $$ BEGIN EXECUTE pg_temp.ord(130, '00000000-0000-0000-0000-0000000000a2', 200, '00000000-0000-0000-0000-000000000012'); END $$;
-- pass consumato: il secondo ordine nuovo richiede un nuovo Turnstile
SELECT pg_temp.expect_error(pg_temp.ord(131, '00000000-0000-0000-0000-0000000000a2'), 'ANTIABUSE_CAPTCHA_REQUIRED');
RESET ROLE;
-- pass scaduto non vale
INSERT INTO order_captcha_passes(user_id, expires_at) VALUES ('00000000-0000-0000-0000-0000000000a2', now() - interval '1 minute');
SET ROLE authenticated;
SELECT pg_temp.expect_error(pg_temp.ord(131, '00000000-0000-0000-0000-0000000000a2'), 'ANTIABUSE_CAPTCHA_REQUIRED');
RESET ROLE;

DO $$ BEGIN
  IF (SELECT count(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id) <> (SELECT count(*) FROM orders) THEN
    RAISE EXCEPTION 'order without items';
  END IF;
END $$;
SELECT 'PASS: login obbligatorio, valore max, ordini aperti, rate limit, blocco, storico mancati ritiri, Turnstile' AS result;
