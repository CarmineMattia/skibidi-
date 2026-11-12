-- Skibidi Coin, fase 1. Punti fedeltà interni, solo nel database, solo per la
-- company che ha il programma acceso (in partenza Pizzeria Ambrosia
-- 00000000-0000-0000-0000-000000000001). Non è cripto, non si vende, non si
-- trasferisce tra clienti. Nessuna ricarica a pagamento: quella è la fase 2
-- e non va aggiunta in questo file.
--
-- Regole: 1 punto per euro intero di merce (floor del subtotale righe, quindi
-- senza il contributo di consegna, che non è una riga); 100 punti = 5€ di
-- sconto; scadenza 12 mesi dalla data in cui il punto è stato guadagnato.
-- Il cliente può CHIEDERE i punti sull'ordine. Lo sconto nasce solo quando
-- il personale (is_admin(), la stessa funzione della cucina) lo conferma in
-- cassa. I punti si accreditano quando l'ordine passa a delivered (ritirato
-- e pagato). Annullati, rifiutati, vuoti e non ritirati non accreditano.
-- Un accredito sbagliato si storna con una riga nuova, mai modificando la
-- riga vecchia.
--
-- Il saldo è la somma delle righe non scadute (expires_at nullo oppure nel
-- futuro). I riscatti sono fette FIFO che ereditano la scadenza del lotto
-- consumato, così quando il lotto esce dal saldo esce anche la parte già
-- spesa e il saldo non diventa negativo.
--
-- Migration solo nel repository. Non applicarla al progetto ospitato senza
-- l'ok di Carmine. Ruolo atteso: postgres. Nessun ALTER su storage, auth o
-- realtime.

-- ---------------------------------------------------------------------------
-- 1. Impostazioni per company
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.loyalty_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  points_per_euro integer NOT NULL DEFAULT 1,
  points_per_redeem_unit integer NOT NULL DEFAULT 100,
  redeem_value_eur numeric(10,2) NOT NULL DEFAULT 5,
  expiry_months integer NOT NULL DEFAULT 12,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_settings_points_per_euro CHECK (points_per_euro BETWEEN 1 AND 100),
  CONSTRAINT loyalty_settings_redeem_unit CHECK (points_per_redeem_unit BETWEEN 1 AND 100000),
  CONSTRAINT loyalty_settings_redeem_value CHECK (redeem_value_eur >= 0),
  CONSTRAINT loyalty_settings_expiry CHECK (expiry_months BETWEEN 1 AND 60)
);

INSERT INTO public.loyalty_settings (company_id, enabled)
SELECT c.id, c.id = '00000000-0000-0000-0000-000000000001'
FROM public.companies c
ON CONFLICT (company_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.loyalty_settings_for_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.loyalty_settings (company_id, enabled)
  VALUES (NEW.id, NEW.id = '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_loyalty_settings_for_company ON public.companies;
CREATE TRIGGER trg_loyalty_settings_for_company
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.loyalty_settings_for_company();

-- ---------------------------------------------------------------------------
-- 2. Conto per (cliente, company) e registro append-only
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_accounts_customer_company UNIQUE (customer_id, company_id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.loyalty_accounts(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  type text NOT NULL,
  quantity integer NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  staff_user_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  source_ledger_id uuid REFERENCES public.loyalty_ledger(id) ON DELETE RESTRICT,
  reverses_ledger_id uuid REFERENCES public.loyalty_ledger(id) ON DELETE RESTRICT,
  CONSTRAINT loyalty_ledger_type CHECK (type IN ('earn_order', 'redeem', 'gift', 'reversal', 'expire')),
  CONSTRAINT loyalty_ledger_quantity_nonzero CHECK (quantity <> 0),
  CONSTRAINT loyalty_ledger_reason_length CHECK (reason IS NULL OR char_length(reason) <= 500),
  CONSTRAINT loyalty_ledger_shape CHECK (
    (type = 'earn_order' AND quantity > 0 AND order_id IS NOT NULL AND expires_at IS NOT NULL
      AND staff_user_id IS NULL AND source_ledger_id IS NULL AND reverses_ledger_id IS NULL)
    OR (type = 'gift' AND quantity > 0 AND order_id IS NULL AND expires_at IS NOT NULL
      AND staff_user_id IS NOT NULL AND source_ledger_id IS NULL AND reverses_ledger_id IS NULL
      AND reason IS NOT NULL AND char_length(btrim(reason)) BETWEEN 3 AND 500)
    OR (type = 'redeem' AND quantity < 0 AND order_id IS NOT NULL AND staff_user_id IS NOT NULL
      AND source_ledger_id IS NOT NULL AND expires_at IS NOT NULL AND reverses_ledger_id IS NULL)
    OR (type = 'reversal' AND quantity <> 0 AND staff_user_id IS NOT NULL
      AND reverses_ledger_id IS NOT NULL AND source_ledger_id IS NOT NULL AND expires_at IS NOT NULL
      AND reason IS NOT NULL AND char_length(btrim(reason)) BETWEEN 3 AND 500)
    OR (type = 'expire' AND quantity < 0 AND staff_user_id IS NULL AND source_ledger_id IS NOT NULL
      AND order_id IS NULL AND reverses_ledger_id IS NULL AND expires_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_ledger_one_earn_per_order
  ON public.loyalty_ledger (order_id)
  WHERE type = 'earn_order';

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_ledger_one_reversal
  ON public.loyalty_ledger (reverses_ledger_id)
  WHERE type = 'reversal';

CREATE INDEX IF NOT EXISTS loyalty_ledger_account_created_idx
  ON public.loyalty_ledger (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS loyalty_ledger_company_created_idx
  ON public.loyalty_ledger (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS loyalty_ledger_source_idx
  ON public.loyalty_ledger (source_ledger_id)
  WHERE source_ledger_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Richiesta punti sull'ordine (non è ancora uno sconto)
-- ---------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS points_requested integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_redeemed integer,
  ADD COLUMN IF NOT EXISTS points_discount_eur numeric(10,2),
  ADD COLUMN IF NOT EXISTS points_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS points_confirmed_by uuid;

DO $points_checks$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_points_requested_nonnegative' AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_points_requested_nonnegative CHECK (points_requested >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_points_redeemed_positive' AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_points_redeemed_positive CHECK (points_redeemed IS NULL OR points_redeemed > 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_points_discount_nonnegative' AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_points_discount_nonnegative
      CHECK (points_discount_eur IS NULL OR points_discount_eur >= 0);
  END IF;
END
$points_checks$;

-- Il client e lo staff non scrivono queste colonne con un UPDATE diretto.
-- Le funzioni sotto alzano skibidi.loyalty_write per la durata della transazione.
CREATE OR REPLACE FUNCTION public.loyalty_guard_order_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.points_redeemed IS NOT NULL
       OR NEW.points_discount_eur IS NOT NULL
       OR NEW.points_confirmed_at IS NOT NULL
       OR NEW.points_confirmed_by IS NOT NULL THEN
      RAISE EXCEPTION 'Lo sconto punti si conferma solo in cassa'
        USING DETAIL = 'LOYALTY_POINTS_LOCKED', ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.points_requested IS DISTINCT FROM OLD.points_requested
     OR NEW.points_redeemed IS DISTINCT FROM OLD.points_redeemed
     OR NEW.points_discount_eur IS DISTINCT FROM OLD.points_discount_eur
     OR NEW.points_confirmed_at IS DISTINCT FROM OLD.points_confirmed_at
     OR NEW.points_confirmed_by IS DISTINCT FROM OLD.points_confirmed_by THEN
    IF coalesce(current_setting('skibidi.loyalty_write', true), '') IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'I punti dell''ordine si scrivono solo dalle funzioni loyalty'
        USING DETAIL = 'LOYALTY_POINTS_LOCKED', ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_loyalty_guard_order_points ON public.orders;
CREATE TRIGGER trg_loyalty_guard_order_points
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.loyalty_guard_order_points();

-- ---------------------------------------------------------------------------
-- 4. Funzioni interne
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.loyalty_assert_staff(p_company uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL
     OR coalesce(auth.role(), '') = 'anon'
     OR NOT coalesce(public.is_admin(), false) THEN
    RAISE EXCEPTION 'Solo il personale della pizzeria può farlo'
      USING DETAIL = 'LOYALTY_NOT_STAFF', ERRCODE = '42501';
  END IF;
  IF p_company IS NULL OR p_company IS DISTINCT FROM public.get_my_company_id() THEN
    RAISE EXCEPTION 'Operazione fuori dalla propria pizzeria'
      USING DETAIL = 'LOYALTY_OTHER_COMPANY', ERRCODE = '42501';
  END IF;
  RETURN auth.uid();
END;
$fn$;

CREATE OR REPLACE FUNCTION public.loyalty_require_reason(p_reason text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  IF char_length(v_reason) < 3 OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'Serve un motivo (da 3 a 500 caratteri)'
      USING DETAIL = 'LOYALTY_REASON_REQUIRED', ERRCODE = '23514';
  END IF;
  RETURN v_reason;
END;
$fn$;

-- Crea il conto se manca e lo blocca per tutta la transazione. I riscatti
-- concorrenti si mettono in fila su questa riga e rileggono il saldo dopo.
CREATE OR REPLACE FUNCTION public.loyalty_ensure_account(p_customer uuid, p_company uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_id uuid;
BEGIN
  IF p_customer IS NULL OR p_company IS NULL THEN
    RAISE EXCEPTION 'Conto punti senza cliente o pizzeria'
      USING DETAIL = 'LOYALTY_ACCOUNT_MISMATCH';
  END IF;
  INSERT INTO public.loyalty_accounts (customer_id, company_id)
  VALUES (p_customer, p_company)
  ON CONFLICT (customer_id, company_id) DO NOTHING;
  SELECT id INTO v_id
  FROM public.loyalty_accounts
  WHERE customer_id = p_customer AND company_id = p_company
  FOR UPDATE;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Conto punti non disponibile' USING DETAIL = 'LOYALTY_ACCOUNT_MISMATCH';
  END IF;
  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.loyalty_balance(p_account uuid, p_as_of timestamptz DEFAULT now())
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT coalesce(sum(quantity), 0)::integer
  FROM public.loyalty_ledger
  WHERE account_id = p_account
    AND (expires_at IS NULL OR expires_at > p_as_of);
$fn$;

CREATE OR REPLACE FUNCTION public.loyalty_lot_remaining(p_lot uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT coalesce((
    SELECT l.quantity + coalesce((
      SELECT sum(c.quantity) FROM public.loyalty_ledger c WHERE c.source_ledger_id = l.id
    ), 0)
    FROM public.loyalty_ledger l
    WHERE l.id = p_lot
  ), 0)::integer;
$fn$;

CREATE OR REPLACE FUNCTION public.loyalty_ledger_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Il registro punti è solo in aggiunta: uno storno è una riga nuova'
      USING DETAIL = 'LOYALTY_APPEND_ONLY', ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.loyalty_accounts a
    WHERE a.id = NEW.account_id
      AND a.company_id = NEW.company_id
      AND a.customer_id = NEW.customer_id
  ) THEN
    RAISE EXCEPTION 'Conto punti non coerente con la riga'
      USING DETAIL = 'LOYALTY_ACCOUNT_MISMATCH';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_loyalty_ledger_before_write ON public.loyalty_ledger;
CREATE TRIGGER trg_loyalty_ledger_before_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.loyalty_ledger
  FOR EACH ROW EXECUTE FUNCTION public.loyalty_ledger_before_write();

-- Valida la richiesta del cliente. Non tocca il totale e non scala i punti:
-- è solo il numero che la cassa potrà confermare.
CREATE OR REPLACE FUNCTION public.loyalty_normalize_request(
  p_company uuid,
  p_customer uuid,
  p_subtotal numeric,
  p_requested text
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_raw text := nullif(btrim(coalesce(p_requested, '')), '');
  v_points integer := 0;
  v_settings public.loyalty_settings%ROWTYPE;
  v_account uuid;
  v_balance integer := 0;
  v_discount numeric;
BEGIN
  IF v_raw IS NULL OR v_raw = '0' THEN
    RETURN 0;
  END IF;
  IF auth.uid() IS NOT NULL AND p_customer IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'La richiesta punti è solo del cliente dell''ordine'
      USING DETAIL = 'LOYALTY_NOT_OWNER', ERRCODE = '42501';
  END IF;
  IF v_raw !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Richiesta punti non valida' USING DETAIL = 'LOYALTY_INVALID', ERRCODE = '23514';
  END IF;
  BEGIN
    v_points := v_raw::integer;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Richiesta punti non valida' USING DETAIL = 'LOYALTY_INVALID', ERRCODE = '23514';
  END;
  IF v_points = 0 THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_settings FROM public.loyalty_settings WHERE company_id = p_company;
  IF NOT FOUND OR NOT v_settings.enabled THEN
    RAISE EXCEPTION 'Skibidi Coin non è attivo in questa pizzeria'
      USING DETAIL = 'LOYALTY_DISABLED';
  END IF;
  IF v_points % v_settings.points_per_redeem_unit <> 0 THEN
    RAISE EXCEPTION 'I punti si usano a multipli di %', v_settings.points_per_redeem_unit
      USING DETAIL = 'LOYALTY_NOT_MULTIPLE', ERRCODE = '23514';
  END IF;
  v_discount := (v_points / v_settings.points_per_redeem_unit) * v_settings.redeem_value_eur;
  IF v_discount > coalesce(p_subtotal, 0) THEN
    RAISE EXCEPTION 'Lo sconto punti supera il totale dei prodotti'
      USING DETAIL = 'LOYALTY_DISCOUNT_TOO_HIGH', ERRCODE = '23514';
  END IF;

  SELECT id INTO v_account
  FROM public.loyalty_accounts
  WHERE customer_id = p_customer AND company_id = p_company;
  IF v_account IS NOT NULL THEN
    v_balance := public.loyalty_balance(v_account, now());
  END IF;
  IF v_points > v_balance THEN
    RAISE EXCEPTION 'Punti insufficienti' USING DETAIL = 'LOYALTY_INSUFFICIENT', ERRCODE = '23514';
  END IF;
  RETURN v_points;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.loyalty_credit_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_order public.orders%ROWTYPE;
  v_settings public.loyalty_settings%ROWTYPE;
  v_goods numeric;
  v_points integer;
  v_account uuid;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.status::text IS DISTINCT FROM 'delivered' OR v_order.customer_id IS NULL THEN
    RETURN;
  END IF;
  SELECT * INTO v_settings FROM public.loyalty_settings WHERE company_id = v_order.company_id;
  IF NOT FOUND OR NOT v_settings.enabled THEN
    RETURN;
  END IF;
  -- Subtotale righe: la consegna, se c'è, sta nel total_amount e non in una riga.
  -- Un ordine senza righe (o con totale merci 0) non accredita.
  SELECT coalesce(sum(total_price), 0) INTO v_goods
  FROM public.order_items
  WHERE order_id = v_order.id;
  IF v_goods <= 0 THEN
    RETURN;
  END IF;
  v_points := floor(v_goods)::integer * v_settings.points_per_euro;
  IF v_points <= 0 THEN
    RETURN;
  END IF;

  v_account := public.loyalty_ensure_account(v_order.customer_id, v_order.company_id);
  INSERT INTO public.loyalty_ledger (
    account_id, company_id, customer_id, type, quantity, order_id, expires_at
  ) VALUES (
    v_account,
    v_order.company_id,
    v_order.customer_id,
    'earn_order',
    v_points,
    v_order.id,
    now() + make_interval(months => v_settings.expiry_months)
  )
  ON CONFLICT (order_id) WHERE type = 'earn_order' DO NOTHING;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.loyalty_on_order_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.status::text = 'delivered'
     AND (TG_OP = 'INSERT' OR OLD.status::text IS DISTINCT FROM 'delivered') THEN
    PERFORM public.loyalty_credit_order(NEW.id);
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_loyalty_credit_on_delivered ON public.orders;
CREATE TRIGGER trg_loyalty_credit_on_delivered
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status::text = 'delivered' AND OLD.status::text IS DISTINCT FROM 'delivered')
  EXECUTE FUNCTION public.loyalty_on_order_delivered();

-- ---------------------------------------------------------------------------
-- 5. Funzioni chiamate dall'app
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.loyalty_my_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_company uuid := public.get_my_company_id();
  v_settings public.loyalty_settings%ROWTYPE;
  v_account uuid;
  v_balance integer := 0;
  v_soon integer := 0;
  v_next timestamptz;
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.role(), '') = 'anon' THEN
    RAISE EXCEPTION 'Accesso non consentito'
      USING DETAIL = 'LOYALTY_NOT_AUTHENTICATED', ERRCODE = '42501';
  END IF;
  IF v_company IS NOT NULL THEN
    SELECT * INTO v_settings FROM public.loyalty_settings WHERE company_id = v_company;
    SELECT id INTO v_account
    FROM public.loyalty_accounts
    WHERE customer_id = auth.uid() AND company_id = v_company;
    IF v_account IS NOT NULL THEN
      v_balance := public.loyalty_balance(v_account, now());
      SELECT coalesce(sum(public.loyalty_lot_remaining(l.id)), 0)::integer
        INTO v_soon
      FROM public.loyalty_ledger l
      WHERE l.account_id = v_account
        AND l.type IN ('earn_order', 'gift')
        AND l.expires_at > now()
        AND l.expires_at <= now() + interval '30 days'
        AND public.loyalty_lot_remaining(l.id) > 0;
      SELECT min(l.expires_at) INTO v_next
      FROM public.loyalty_ledger l
      WHERE l.account_id = v_account
        AND l.type IN ('earn_order', 'gift')
        AND l.expires_at > now()
        AND public.loyalty_lot_remaining(l.id) > 0;
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'enabled', coalesce(v_settings.enabled, false),
    'balance', coalesce(v_balance, 0),
    'expiring_soon', coalesce(v_soon, 0),
    'next_expires_at', v_next,
    'points_per_euro', coalesce(v_settings.points_per_euro, 1),
    'points_per_redeem_unit', coalesce(v_settings.points_per_redeem_unit, 100),
    'redeem_value_eur', coalesce(v_settings.redeem_value_eur, 5),
    'expiry_months', coalesce(v_settings.expiry_months, 12),
    'company_id', v_company
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.loyalty_my_ledger(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  entry_type text,
  quantity integer,
  reason text,
  order_id uuid,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.role(), '') = 'anon' THEN
    RAISE EXCEPTION 'Accesso non consentito'
      USING DETAIL = 'LOYALTY_NOT_AUTHENTICATED', ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT l.id, l.type, l.quantity, l.reason, l.order_id, l.created_at, l.expires_at
  FROM public.loyalty_ledger l
  WHERE l.customer_id = auth.uid()
    AND l.company_id IS NOT DISTINCT FROM public.get_my_company_id()
  ORDER BY l.created_at DESC, l.id DESC
  LIMIT least(greatest(coalesce(p_limit, 50), 1), 100);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.loyalty_staff_ledger(p_limit integer DEFAULT 30)
RETURNS TABLE (
  id uuid,
  entry_type text,
  quantity integer,
  reason text,
  order_id uuid,
  customer_id uuid,
  customer_name text,
  created_at timestamptz,
  expires_at timestamptz,
  staff_user_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_company uuid := public.get_my_company_id();
BEGIN
  PERFORM public.loyalty_assert_staff(v_company);
  RETURN QUERY
  SELECT l.id, l.type, l.quantity, l.reason, l.order_id, l.customer_id,
         p.full_name, l.created_at, l.expires_at, l.staff_user_id
  FROM public.loyalty_ledger l
  LEFT JOIN public.profiles p ON p.id = l.customer_id
  WHERE l.company_id = v_company
  ORDER BY l.created_at DESC, l.id DESC
  LIMIT least(greatest(coalesce(p_limit, 30), 1), 100);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.loyalty_lookup_customer(p_query text)
RETURNS TABLE (
  customer_id uuid,
  full_name text,
  email text,
  balance integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_company uuid := public.get_my_company_id();
  v_q text := btrim(coalesce(p_query, ''));
BEGIN
  PERFORM public.loyalty_assert_staff(v_company);
  IF char_length(v_q) < 3 THEN
    RETURN;
  END IF;
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  RETURN QUERY
  SELECT p.id, p.full_name, p.email,
         coalesce(public.loyalty_balance(a.id, now()), 0)::integer
  FROM public.profiles p
  LEFT JOIN public.loyalty_accounts a
    ON a.customer_id = p.id AND a.company_id = p.company_id
  WHERE p.company_id = v_company
    AND p.role = 'customer'::public.user_role
    AND (
      coalesce(p.full_name, '') ILIKE '%' || v_q || '%' ESCAPE '\'
      OR coalesce(p.email, '') ILIKE '%' || v_q || '%' ESCAPE '\'
    )
  ORDER BY p.full_name NULLS LAST, p.email
  LIMIT 8;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.loyalty_gift(
  p_customer uuid,
  p_quantity integer,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_company uuid := public.get_my_company_id();
  v_staff uuid;
  v_reason text;
  v_settings public.loyalty_settings%ROWTYPE;
  v_account uuid;
  v_id uuid;
BEGIN
  v_staff := public.loyalty_assert_staff(v_company);
  v_reason := public.loyalty_require_reason(p_reason);
  IF p_customer IS NULL OR p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 10000 THEN
    RAISE EXCEPTION 'Quantità punti non valida' USING DETAIL = 'LOYALTY_INVALID', ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_customer
      AND company_id = v_company
      AND role = 'customer'::public.user_role
  ) THEN
    RAISE EXCEPTION 'Cliente non trovato in questa pizzeria'
      USING DETAIL = 'LOYALTY_OTHER_COMPANY', ERRCODE = '42501';
  END IF;
  SELECT * INTO v_settings FROM public.loyalty_settings WHERE company_id = v_company;
  IF NOT FOUND OR NOT v_settings.enabled THEN
    RAISE EXCEPTION 'Skibidi Coin non è attivo in questa pizzeria'
      USING DETAIL = 'LOYALTY_DISABLED';
  END IF;
  v_account := public.loyalty_ensure_account(p_customer, v_company);
  INSERT INTO public.loyalty_ledger (
    account_id, company_id, customer_id, type, quantity, staff_user_id, reason, expires_at
  ) VALUES (
    v_account, v_company, p_customer, 'gift', p_quantity, v_staff, v_reason,
    now() + make_interval(months => v_settings.expiry_months)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.loyalty_confirm_redeem(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_order public.orders%ROWTYPE;
  v_settings public.loyalty_settings%ROWTYPE;
  v_staff uuid;
  v_account uuid;
  v_goods numeric;
  v_discount numeric(10,2);
  v_left integer;
  v_lot record;
  v_take integer;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Ordine mancante' USING DETAIL = 'LOYALTY_INVALID';
  END IF;
  -- Prima l'ordine, poi il conto: stesso ordine di lock dell'accredito.
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordine non trovato' USING DETAIL = 'LOYALTY_NOT_FOUND';
  END IF;
  v_staff := public.loyalty_assert_staff(v_order.company_id);
  IF v_order.status::text IN ('cancelled', 'rejected') THEN
    RAISE EXCEPTION 'Non si confermano punti su un ordine annullato o rifiutato'
      USING DETAIL = 'LOYALTY_CLOSED_ORDER';
  END IF;
  IF v_order.customer_id IS NULL THEN
    RAISE EXCEPTION 'L''ordine non ha un cliente' USING DETAIL = 'LOYALTY_NOT_OWNER';
  END IF;
  IF coalesce(v_order.points_requested, 0) <= 0 THEN
    RAISE EXCEPTION 'Nessuna richiesta punti su questo ordine' USING DETAIL = 'LOYALTY_NO_REQUEST';
  END IF;
  IF v_order.points_redeemed IS NOT NULL THEN
    RAISE EXCEPTION 'Sconto punti già confermato' USING DETAIL = 'LOYALTY_ALREADY_CONFIRMED';
  END IF;

  SELECT * INTO v_settings FROM public.loyalty_settings WHERE company_id = v_order.company_id;
  IF NOT FOUND OR NOT v_settings.enabled THEN
    RAISE EXCEPTION 'Skibidi Coin non è attivo in questa pizzeria'
      USING DETAIL = 'LOYALTY_DISABLED';
  END IF;
  IF v_order.points_requested % v_settings.points_per_redeem_unit <> 0 THEN
    RAISE EXCEPTION 'I punti si usano a multipli di %', v_settings.points_per_redeem_unit
      USING DETAIL = 'LOYALTY_NOT_MULTIPLE', ERRCODE = '23514';
  END IF;
  v_discount := round(
    (v_order.points_requested / v_settings.points_per_redeem_unit) * v_settings.redeem_value_eur,
    2
  );
  SELECT coalesce(sum(total_price), 0) INTO v_goods
  FROM public.order_items WHERE order_id = v_order.id;
  IF v_discount > v_goods THEN
    RAISE EXCEPTION 'Lo sconto punti supera il totale dei prodotti'
      USING DETAIL = 'LOYALTY_DISCOUNT_TOO_HIGH', ERRCODE = '23514';
  END IF;

  v_account := public.loyalty_ensure_account(v_order.customer_id, v_order.company_id);
  IF public.loyalty_balance(v_account, now()) < v_order.points_requested THEN
    RAISE EXCEPTION 'Punti insufficienti' USING DETAIL = 'LOYALTY_INSUFFICIENT', ERRCODE = '23514';
  END IF;

  v_left := v_order.points_requested;
  FOR v_lot IN
    SELECT l.id, l.expires_at,
           (l.quantity + coalesce((
             SELECT sum(c.quantity) FROM public.loyalty_ledger c WHERE c.source_ledger_id = l.id
           ), 0))::integer AS remaining
    FROM public.loyalty_ledger l
    WHERE l.account_id = v_account
      AND l.type IN ('earn_order', 'gift')
      AND l.expires_at > now()
    ORDER BY l.expires_at, l.created_at, l.id
    FOR UPDATE OF l
  LOOP
    EXIT WHEN v_left <= 0;
    IF v_lot.remaining <= 0 THEN
      CONTINUE;
    END IF;
    v_take := least(v_left, v_lot.remaining);
    INSERT INTO public.loyalty_ledger (
      account_id, company_id, customer_id, type, quantity, order_id,
      staff_user_id, reason, expires_at, source_ledger_id
    ) VALUES (
      v_account, v_order.company_id, v_order.customer_id, 'redeem', -v_take, v_order.id,
      v_staff, 'Conferma sconto in cassa', v_lot.expires_at, v_lot.id
    );
    v_left := v_left - v_take;
  END LOOP;
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'Punti insufficienti' USING DETAIL = 'LOYALTY_INSUFFICIENT', ERRCODE = '23514';
  END IF;

  PERFORM set_config('skibidi.loyalty_write', 'on', true);
  UPDATE public.orders
  SET points_redeemed = points_requested,
      points_discount_eur = v_discount,
      points_confirmed_at = now(),
      points_confirmed_by = v_staff,
      updated_at = now()
  WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'points', v_order.points_requested,
    'discount_eur', v_discount
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.loyalty_reverse(p_ledger_id uuid, p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row public.loyalty_ledger%ROWTYPE;
  v_slice public.loyalty_ledger%ROWTYPE;
  v_staff uuid;
  v_reason text;
  v_count integer := 0;
  v_order_id uuid;
  v_account uuid;
BEGIN
  IF p_ledger_id IS NULL THEN
    RAISE EXCEPTION 'Movimento mancante' USING DETAIL = 'LOYALTY_INVALID';
  END IF;
  SELECT l.order_id, l.account_id
    INTO v_order_id, v_account
  FROM public.loyalty_ledger l
  WHERE l.id = p_ledger_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimento non trovato' USING DETAIL = 'LOYALTY_NOT_FOUND';
  END IF;
  IF v_order_id IS NOT NULL THEN
    PERFORM 1 FROM public.orders WHERE id = v_order_id FOR UPDATE;
  END IF;
  PERFORM 1 FROM public.loyalty_accounts WHERE id = v_account FOR UPDATE;
  SELECT * INTO v_row FROM public.loyalty_ledger WHERE id = p_ledger_id FOR UPDATE;
  v_staff := public.loyalty_assert_staff(v_row.company_id);
  v_reason := public.loyalty_require_reason(p_reason);

  IF v_row.type IN ('earn_order', 'gift') THEN
    IF EXISTS (
      SELECT 1 FROM public.loyalty_ledger WHERE type = 'reversal' AND reverses_ledger_id = v_row.id
    ) THEN
      RAISE EXCEPTION 'Movimento già stornato' USING DETAIL = 'LOYALTY_ALREADY_REVERSED';
    END IF;
    IF v_row.expires_at <= now() THEN
      RAISE EXCEPTION 'Quei punti sono già scaduti' USING DETAIL = 'LOYALTY_EXPIRED';
    END IF;
    IF public.loyalty_lot_remaining(v_row.id) <> v_row.quantity THEN
      RAISE EXCEPTION 'Quei punti sono già stati usati, in tutto o in parte'
        USING DETAIL = 'LOYALTY_ALREADY_USED';
    END IF;
    INSERT INTO public.loyalty_ledger (
      account_id, company_id, customer_id, type, quantity, order_id,
      staff_user_id, reason, expires_at, source_ledger_id, reverses_ledger_id
    ) VALUES (
      v_row.account_id, v_row.company_id, v_row.customer_id, 'reversal', -v_row.quantity, v_row.order_id,
      v_staff, v_reason, v_row.expires_at, v_row.id, v_row.id
    );
    RETURN 1;
  END IF;

  IF v_row.type = 'redeem' THEN
    FOR v_slice IN
      SELECT * FROM public.loyalty_ledger
      WHERE type = 'redeem' AND order_id = v_row.order_id AND account_id = v_row.account_id
      ORDER BY created_at, id
      FOR UPDATE
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.loyalty_ledger WHERE type = 'reversal' AND reverses_ledger_id = v_slice.id
      ) THEN
        CONTINUE;
      END IF;
      INSERT INTO public.loyalty_ledger (
        account_id, company_id, customer_id, type, quantity, order_id,
        staff_user_id, reason, expires_at, source_ledger_id, reverses_ledger_id
      ) VALUES (
        v_slice.account_id, v_slice.company_id, v_slice.customer_id, 'reversal', -v_slice.quantity,
        v_slice.order_id, v_staff, v_reason, v_slice.expires_at, v_slice.source_ledger_id, v_slice.id
      );
      v_count := v_count + 1;
    END LOOP;
    IF v_count = 0 THEN
      RAISE EXCEPTION 'Riscatto già stornato' USING DETAIL = 'LOYALTY_ALREADY_REVERSED';
    END IF;
    PERFORM set_config('skibidi.loyalty_write', 'on', true);
    UPDATE public.orders
    SET points_redeemed = NULL,
        points_discount_eur = NULL,
        points_confirmed_at = NULL,
        points_confirmed_by = NULL,
        updated_at = now()
    WHERE id = v_row.order_id;
    RETURN v_count;
  END IF;

  RAISE EXCEPTION 'Questo movimento non si può stornare' USING DETAIL = 'LOYALTY_NOT_REVERSIBLE';
END;
$fn$;

-- Scrive le righe `expire` per i lotti già usciti dal saldo. Il saldo è già
-- giusto senza questa funzione (le righe scadute non entrano nella somma):
-- la riga serve solo come traccia. Non è una ricarica e non modifica il passato.
CREATE OR REPLACE FUNCTION public.loyalty_expire_due(p_company uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_company uuid := p_company;
  v_account uuid;
  v_lot record;
  v_count integer := 0;
  v_remaining integer;
BEGIN
  IF auth.uid() IS NOT NULL OR coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
    PERFORM public.loyalty_assert_staff(coalesce(v_company, public.get_my_company_id()));
    v_company := public.get_my_company_id();
  END IF;

  FOR v_account IN
    SELECT DISTINCT l.account_id
    FROM public.loyalty_ledger l
    WHERE l.type IN ('earn_order', 'gift')
      AND l.expires_at <= now()
      AND (v_company IS NULL OR l.company_id = v_company)
  LOOP
    PERFORM 1 FROM public.loyalty_accounts WHERE id = v_account FOR UPDATE;
    FOR v_lot IN
      SELECT l.id, l.account_id, l.company_id, l.customer_id, l.expires_at
      FROM public.loyalty_ledger l
      WHERE l.account_id = v_account
        AND l.type IN ('earn_order', 'gift')
        AND l.expires_at <= now()
      ORDER BY l.id
      FOR UPDATE
    LOOP
      v_remaining := public.loyalty_lot_remaining(v_lot.id);
      IF v_remaining <= 0 THEN
        CONTINUE;
      END IF;
      INSERT INTO public.loyalty_ledger (
        account_id, company_id, customer_id, type, quantity, reason, expires_at, source_ledger_id
      ) VALUES (
        v_lot.account_id, v_lot.company_id, v_lot.customer_id, 'expire', -v_remaining,
        'Scadenza', v_lot.expires_at, v_lot.id
      );
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  RETURN v_count;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 6. Saldo letto dal server (la vista rispetta la RLS di chi la interroga)
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.loyalty_balances;
CREATE VIEW public.loyalty_balances
WITH (security_invoker = true) AS
SELECT
  a.id AS account_id,
  a.company_id,
  a.customer_id,
  coalesce(sum(l.quantity) FILTER (
    WHERE l.expires_at IS NULL OR l.expires_at > now()
  ), 0)::integer AS balance
FROM public.loyalty_accounts a
LEFT JOIN public.loyalty_ledger l ON l.account_id = a.id
GROUP BY a.id, a.company_id, a.customer_id;

-- ---------------------------------------------------------------------------
-- 7. RLS: il cliente legge solo il proprio conto e il proprio registro.
--    anon non ha privilegi. Nessun INSERT/UPDATE/DELETE per i ruoli client.
-- ---------------------------------------------------------------------------

ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loyalty_settings_select ON public.loyalty_settings;
CREATE POLICY loyalty_settings_select ON public.loyalty_settings
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS loyalty_accounts_select ON public.loyalty_accounts;
CREATE POLICY loyalty_accounts_select ON public.loyalty_accounts
  FOR SELECT TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    OR (public.is_admin() AND company_id = public.get_my_company_id())
  );

DROP POLICY IF EXISTS loyalty_ledger_select ON public.loyalty_ledger;
CREATE POLICY loyalty_ledger_select ON public.loyalty_ledger
  FOR SELECT TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    OR (public.is_admin() AND company_id = public.get_my_company_id())
  );

DO $revoke_tables$
DECLARE
  rel text;
BEGIN
  FOREACH rel IN ARRAY ARRAY[
    'public.loyalty_settings',
    'public.loyalty_accounts',
    'public.loyalty_ledger',
    'public.loyalty_balances'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', rel);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM anon', rel);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM authenticated', rel);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM service_role', rel);
    END IF;
  END LOOP;
END
$revoke_tables$;

DO $grant_select$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON TABLE
      public.loyalty_settings,
      public.loyalty_accounts,
      public.loyalty_ledger,
      public.loyalty_balances
    TO authenticated;
  END IF;
END
$grant_select$;

-- ---------------------------------------------------------------------------
-- 8. Grant: le funzioni interne restano al proprietario. Quelle dell'app
--    vanno a authenticated (e a service_role se esiste). I controlli di
--    ruolo stanno nel corpo, non solo nel GRANT.
-- ---------------------------------------------------------------------------

DO $fn_grants$
DECLARE
  fn text;
  client boolean;
BEGIN
  FOR fn, client IN
    SELECT * FROM (VALUES
      ('public.loyalty_settings_for_company()', false),
      ('public.loyalty_guard_order_points()', false),
      ('public.loyalty_assert_staff(uuid)', false),
      ('public.loyalty_require_reason(text)', false),
      ('public.loyalty_ensure_account(uuid, uuid)', false),
      ('public.loyalty_balance(uuid, timestamp with time zone)', false),
      ('public.loyalty_lot_remaining(uuid)', false),
      ('public.loyalty_ledger_before_write()', false),
      ('public.loyalty_normalize_request(uuid, uuid, numeric, text)', false),
      ('public.loyalty_credit_order(uuid)', false),
      ('public.loyalty_on_order_delivered()', false),
      ('public.loyalty_my_summary()', true),
      ('public.loyalty_my_ledger(integer)', true),
      ('public.loyalty_staff_ledger(integer)', true),
      ('public.loyalty_lookup_customer(text)', true),
      ('public.loyalty_gift(uuid, integer, text)', true),
      ('public.loyalty_confirm_redeem(uuid)', true),
      ('public.loyalty_reverse(uuid, text)', true),
      ('public.loyalty_expire_due(uuid)', true)
    ) AS t(fn, client)
  LOOP
    IF to_regprocedure(fn) IS NULL THEN
      RAISE EXCEPTION 'skibidi coin: funzione mancante %', fn;
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
    END IF;
    IF client AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    END IF;
    IF client AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
    IF NOT client AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);
    END IF;
  END LOOP;
END
$fn_grants$;

-- ---------------------------------------------------------------------------
-- 9. Collega la richiesta a create_order_with_items senza riscrivere il
--    prezzo. Se la funzione non c'è (database di test minimo) si avvisa.
--    Se c'è e non ha la forma nota, la migration fallisce: meglio un errore
--    chiaro che un ordine che ignora i punti in silenzio.
-- ---------------------------------------------------------------------------

DO $patch$
DECLARE
  src text;
  phone_old text := 'v_existing->>''customer_phone'' IS DISTINCT FROM p_order->>''customer_phone'' THEN';
  phone_new text := 'v_existing->>''customer_phone'' IS DISTINCT FROM p_order->>''customer_phone'''
    || E'\n       OR coalesce((v_existing->>''points_requested'')::integer, 0)'
    || E'\n          IS DISTINCT FROM coalesce(nullif(p_order->>''points_requested'', '''')::integer, 0) THEN';
  cols_old text := 'delivery_address, table_number)';
  cols_new text := 'delivery_address, table_number,' || E'\n    points_requested)';
  vals_old text := 'p_order->>''table_number'');';
  vals_new text := 'p_order->>''table_number'',' || E'\n    v_points_requested);';
  insert_old text := 'INSERT INTO public.orders';
  insert_new text := 'v_points_requested := public.loyalty_normalize_request(v_company, v_customer, v_subtotal, p_order->>''points_requested'');'
    || E'\n\n  INSERT INTO public.orders';
BEGIN
  IF to_regprocedure('public.create_order_with_items(jsonb, jsonb)') IS NULL THEN
    RAISE NOTICE 'skibidi coin: create_order_with_items assente, richiesta punti non collegata';
    RETURN;
  END IF;
  src := pg_get_functiondef('public.create_order_with_items(jsonb, jsonb)'::regprocedure);
  IF position('loyalty_normalize_request' in src) > 0 THEN
    RAISE NOTICE 'skibidi coin: create_order_with_items già collegato';
    RETURN;
  END IF;
  -- Frammenti presenti sia nel corpo originale (20261022100000) sia dopo il
  -- rewire di 20261111234500. Non dipendono dall'indentazione.
  IF position('v_items jsonb;' in src) = 0
     OR position(phone_old in src) = 0
     OR position(cols_old in src) = 0
     OR position(vals_old in src) = 0
     OR position(insert_old in src) = 0 THEN
    RAISE EXCEPTION 'create_order_with_items non riconosciuto: richiesta punti non collegata';
  END IF;
  src := replace(src, 'v_items jsonb;', E'v_items jsonb;\n  v_points_requested integer := 0;');
  src := replace(src, phone_old, phone_new);
  src := replace(src, cols_old, cols_new);
  src := replace(src, vals_old, vals_new);
  src := replace(src, insert_old, insert_new);
  EXECUTE src;
END
$patch$;
