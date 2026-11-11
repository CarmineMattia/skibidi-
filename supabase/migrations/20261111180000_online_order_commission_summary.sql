-- Resoconto mensile della commissione sugli ordini online.
-- SOLO file di migration: NON applicato al database di produzione.
-- Applicare solo con l'OK esplicito di Carmine.
--
-- Modello: niente canone. Commissione sugli ordini del cliente (ruolo
-- profiles.role = customer), stato delivered («ritirato e pagato»), con almeno
-- una riga in order_items, senza riga in order_no_shows. Il lordo è
-- orders.total_amount (include il costo di consegna già salvato sull'ordine).
-- L'aliquota è quella con effective_from più recente <= created_at dell'ordine:
-- un cambio a metà mese non riscrive gli ordini già fatti, e un mese già
-- congelato non viene ricalcolato.
--
-- Non esiste una colonna «creato dal personale». create_order_with_items
-- salva customer_id = auth.uid(). Si escludono quindi gli ordini il cui
-- profilo non è customer (admin, kiosk, profilo assente, customer_id nullo).
-- Un ordine del personale fatto entrando nell'account del cliente non è
-- distinguibile: resta incluso.
--
-- Chi legge: admin della propria company (titolare) oppure riga in
-- platform_owners (Carmine). Il ruolo kiosk (cassa/cucina, quando non è
-- admin) non legge. anon e customer non leggono. Nessun GRANT a anon,
-- nessun MAINTAIN. Le tabelle non sono scrivibili dal browser: l'importo
-- del mese lo ricalcola il trigger, e UPDATE/DELETE sul congelato falliscono.

-- ---------------------------------------------------------------------------
-- Proprietario della piattaforma (Carmine). Tabella vuota finché il suo
-- user id non viene inserito dal SQL editor (ruolo postgres), una tantum.
-- Un admin della pizzeria non può auto-iscriversi.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_owners (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_owners ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_owners WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_owners_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  -- Il browser (anon/authenticated) non scrive, neanche con un GRANT futuro.
  IF current_user IN ('anon', 'authenticated', 'authenticator') THEN
    RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  -- Sessione con JWT di un utente che non è già proprietario: no.
  -- La prima riga la inserisce il SQL editor (nessun JWT). Le successive,
  -- un proprietario già riconosciuto (auth.uid() in tabella).
  IF auth.uid() IS NOT NULL AND NOT coalesce(public.is_platform_owner(), false) THEN
    RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS platform_owners_guard ON public.platform_owners;
CREATE TRIGGER platform_owners_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.platform_owners
  FOR EACH ROW EXECUTE FUNCTION public.platform_owners_guard();

-- ---------------------------------------------------------------------------
-- Aliquote. Append-only per il passato. effective_from è l'istante da cui
-- vale la percentuale (confronto con orders.created_at).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.commission_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rate_percent numeric(5,2) NOT NULL,
  effective_from timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT commission_rates_percent_range CHECK (rate_percent >= 0 AND rate_percent <= 100),
  CONSTRAINT commission_rates_company_effective_unique UNIQUE (company_id, effective_from)
);

CREATE INDEX IF NOT EXISTS commission_rates_company_effective_idx
  ON public.commission_rates (company_id, effective_from DESC);

ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.commission_rate_value_ok(p_rate numeric)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_rate IS NOT NULL
     AND p_rate = p_rate
     AND p_rate >= 0
     AND p_rate <= 100
     AND round(p_rate, 2) IS NOT DISTINCT FROM p_rate;
$$;

CREATE OR REPLACE FUNCTION public.commission_rates_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_mode text := current_setting('skibidi.commission_write', true);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'COMMISSION_RATE_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  IF current_user IN ('anon', 'authenticated', 'authenticator') THEN
    RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF v_mode IS DISTINCT FROM 'rate' OR NOT coalesce(public.is_platform_owner(), false) THEN
      RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF OLD.effective_from <= now() THEN
      RAISE EXCEPTION 'COMMISSION_RATE_IMMUTABLE' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT. 'seed' = migration (aliquota storica iniziale). 'rate' = RPC.
  IF v_mode = 'seed' THEN
    RETURN NEW;
  END IF;
  IF v_mode IS DISTINCT FROM 'rate' OR NOT coalesce(public.is_platform_owner(), false) THEN
    RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NOT public.commission_rate_value_ok(NEW.rate_percent) THEN
    RAISE EXCEPTION 'COMMISSION_RATE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NEW.effective_from < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'COMMISSION_RATE_BACKDATE' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commission_rates_guard ON public.commission_rates;
CREATE TRIGGER commission_rates_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.commission_rates
  FOR EACH ROW EXECUTE FUNCTION public.commission_rates_guard();

-- 5% dal 2020-01-01 UTC per ogni pizzeria già presente. Non sovrascrive
-- una riga già inserita con la stessa decorrenza. Le pizzerie create dopo
-- non ricevono un'aliquota finché il proprietario della piattaforma non la imposta.
DO $seed$
BEGIN
  PERFORM set_config('skibidi.commission_write', 'seed', true);
  INSERT INTO public.commission_rates (company_id, rate_percent, effective_from)
  SELECT c.id, 5.00, timestamptz '2020-01-01 00:00:00+00'
  FROM public.companies c
  ON CONFLICT (company_id, effective_from) DO NOTHING;
  PERFORM set_config('skibidi.commission_write', '', true);
END
$seed$;

-- ---------------------------------------------------------------------------
-- Mese chiuso: una riga congelata. Il mese in corso non si salva (anteprima).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.commission_month_snapshots (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  order_count integer NOT NULL,
  gross_total numeric(12,2) NOT NULL,
  commission_total numeric(12,2) NOT NULL,
  unrated_order_count integer NOT NULL DEFAULT 0,
  unrated_gross numeric(12,2) NOT NULL DEFAULT 0,
  rates jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, month_start),
  CONSTRAINT commission_month_snapshots_first_day CHECK (
    month_start = date_trunc('month', month_start::timestamp)::date
  )
);

ALTER TABLE public.commission_month_snapshots ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.commission_caller_can_read(p_company uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_company IS NULL OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF coalesce(public.is_platform_owner(), false) THEN
    RETURN true;
  END IF;
  RETURN coalesce(public.is_admin(), false)
     AND p_company IS NOT DISTINCT FROM public.get_my_company_id();
END;
$$;

-- Qualifying orders for one Rome month. p_month is the first day.
CREATE OR REPLACE FUNCTION public.commission_month_compute(p_company uuid, p_month date)
RETURNS TABLE (
  order_count integer,
  gross_total numeric,
  commission_total numeric,
  unrated_order_count integer,
  unrated_gross numeric,
  rates jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      (p_month::timestamp AT TIME ZONE 'Europe/Rome') AS start_at,
      ((p_month + interval '1 month') AT TIME ZONE 'Europe/Rome') AS end_at
  ),
  base AS (
    SELECT
      round(o.total_amount, 2) AS gross,
      (
        SELECT r.rate_percent
        FROM public.commission_rates r
        WHERE r.company_id = o.company_id
          AND r.effective_from <= o.created_at
        ORDER BY r.effective_from DESC
        LIMIT 1
      ) AS rate_percent
    FROM public.orders o
    CROSS JOIN bounds b
    WHERE o.company_id = p_company
      AND o.created_at >= b.start_at
      AND o.created_at < b.end_at
      AND o.status::text = 'delivered'
      AND o.customer_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = o.customer_id
          AND p.role::text = 'customer'
      )
      AND EXISTS (
        SELECT 1 FROM public.order_items i
        WHERE i.order_id = o.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.order_no_shows n
        WHERE n.order_id = o.id
      )
  ),
  rated AS (
    SELECT gross, rate_percent, round(gross * rate_percent / 100, 2) AS commission
    FROM base
    WHERE rate_percent IS NOT NULL
  ),
  slices AS (
    SELECT
      rate_percent,
      count(*)::integer AS order_count,
      coalesce(sum(gross), 0)::numeric(12,2) AS gross_total,
      coalesce(sum(commission), 0)::numeric(12,2) AS commission_total
    FROM rated
    GROUP BY rate_percent
  )
  SELECT
    coalesce((SELECT count(*)::integer FROM rated), 0),
    coalesce((SELECT sum(gross) FROM rated), 0)::numeric(12,2),
    coalesce((SELECT sum(commission) FROM rated), 0)::numeric(12,2),
    coalesce((SELECT count(*)::integer FROM base WHERE rate_percent IS NULL), 0),
    coalesce((SELECT sum(gross) FROM base WHERE rate_percent IS NULL), 0)::numeric(12,2),
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'rate_percent', s.rate_percent,
        'order_count', s.order_count,
        'gross_total', s.gross_total,
        'commission_total', s.commission_total
      ) ORDER BY s.rate_percent)
      FROM slices s
    ), '[]'::jsonb);
$$;

CREATE OR REPLACE FUNCTION public.commission_snapshot_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v record;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'COMMISSION_SNAPSHOT_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  IF current_user IN ('anon', 'authenticated', 'authenticator') THEN
    RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  NEW.month_start := date_trunc('month', NEW.month_start::timestamp)::date;
  SELECT * INTO v FROM public.commission_month_compute(NEW.company_id, NEW.month_start);
  NEW.order_count := coalesce(v.order_count, 0);
  NEW.gross_total := coalesce(v.gross_total, 0);
  NEW.commission_total := coalesce(v.commission_total, 0);
  NEW.unrated_order_count := coalesce(v.unrated_order_count, 0);
  NEW.unrated_gross := coalesce(v.unrated_gross, 0);
  NEW.rates := coalesce(v.rates, '[]'::jsonb);
  IF NEW.generated_at IS NULL THEN
    NEW.generated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commission_snapshot_guard ON public.commission_month_snapshots;
CREATE TRIGGER commission_snapshot_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.commission_month_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.commission_snapshot_guard();

-- ---------------------------------------------------------------------------
-- Lettura. I mesi chiusi si congelano alla prima lettura (stesse cifre e
-- stesso generated_at per titolare e Carmine). Il mese di Roma in corso
-- è un'anteprima, non salvata.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.commission_monthly_summary(p_company uuid, p_months integer DEFAULT 18)
RETURNS TABLE (
  month_start date,
  order_count integer,
  gross_total numeric,
  commission_total numeric,
  unrated_order_count integer,
  unrated_gross numeric,
  is_preview boolean,
  generated_at timestamptz,
  rates jsonb
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_months integer := coalesce(p_months, 18);
  v_current date;
  v_from date;
  v_cursor date;
  v_calc record;
  v_row public.commission_month_snapshots%ROWTYPE;
BEGIN
  IF NOT public.commission_caller_can_read(p_company) THEN
    RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF v_months < 1 OR v_months > 36 THEN
    RAISE EXCEPTION 'COMMISSION_MONTHS_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company) THEN
    RAISE EXCEPTION 'COMMISSION_COMPANY_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('commission-summary:' || p_company::text, 0));

  v_current := (date_trunc('month', now() AT TIME ZONE 'Europe/Rome'))::date;
  v_from := (v_current - make_interval(months => v_months - 1))::date;
  v_cursor := v_current;

  WHILE v_cursor >= v_from LOOP
    IF v_cursor = v_current THEN
      SELECT * INTO v_calc FROM public.commission_month_compute(p_company, v_cursor);
      RETURN QUERY
      SELECT v_cursor,
             coalesce(v_calc.order_count, 0),
             coalesce(v_calc.gross_total, 0),
             coalesce(v_calc.commission_total, 0),
             coalesce(v_calc.unrated_order_count, 0),
             coalesce(v_calc.unrated_gross, 0),
             true,
             now(),
             coalesce(v_calc.rates, '[]'::jsonb);
    ELSE
      -- SELECT INTO, se non trova righe, azzera la variabile: non riusare il mese precedente.
      v_row := NULL;
      SELECT * INTO v_row
      FROM public.commission_month_snapshots s
      WHERE s.company_id = p_company AND s.month_start = v_cursor;
      IF NOT FOUND THEN
        SELECT * INTO v_calc FROM public.commission_month_compute(p_company, v_cursor);
        IF coalesce(v_calc.order_count, 0) > 0 OR coalesce(v_calc.unrated_order_count, 0) > 0 THEN
          INSERT INTO public.commission_month_snapshots (
            company_id, month_start, order_count, gross_total, commission_total,
            unrated_order_count, unrated_gross, rates
          ) VALUES (
            p_company, v_cursor, 0, 0, 0, 0, 0, '[]'::jsonb
          )
          ON CONFLICT (company_id, month_start) DO NOTHING;
          SELECT * INTO v_row
          FROM public.commission_month_snapshots s
          WHERE s.company_id = p_company AND s.month_start = v_cursor;
        END IF;
      END IF;
      IF v_row.company_id IS NOT NULL THEN
        RETURN QUERY
        SELECT v_row.month_start,
               v_row.order_count,
               v_row.gross_total,
               v_row.commission_total,
               v_row.unrated_order_count,
               v_row.unrated_gross,
               false,
               v_row.generated_at,
               v_row.rates;
      END IF;
    END IF;
    v_cursor := (v_cursor - interval '1 month')::date;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.commission_rate_schedule(p_company uuid)
RETURNS TABLE (
  rate_percent numeric,
  effective_from timestamptz,
  is_current boolean,
  is_scheduled boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_current timestamptz;
BEGIN
  IF NOT public.commission_caller_can_read(p_company) THEN
    RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT max(r.effective_from) INTO v_current
  FROM public.commission_rates r
  WHERE r.company_id = p_company AND r.effective_from <= now();
  RETURN QUERY
  SELECT r.rate_percent,
         r.effective_from,
         r.effective_from IS NOT DISTINCT FROM v_current,
         r.effective_from > now()
  FROM public.commission_rates r
  WHERE r.company_id = p_company
  ORDER BY r.effective_from;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_commission_rate(
  p_company uuid,
  p_rate numeric,
  p_effective_from timestamptz DEFAULT NULL,
  p_effective_on date DEFAULT NULL
)
RETURNS TABLE (rate_percent numeric, effective_from timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_from timestamptz;
BEGIN
  IF NOT coalesce(public.is_platform_owner(), false) THEN
    RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_company IS NULL OR NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company) THEN
    RAISE EXCEPTION 'COMMISSION_COMPANY_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.commission_rate_value_ok(p_rate) THEN
    RAISE EXCEPTION 'COMMISSION_RATE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_effective_from IS NOT NULL AND p_effective_on IS NOT NULL THEN
    RAISE EXCEPTION 'COMMISSION_RATE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_effective_on IS NOT NULL THEN
    v_from := p_effective_on::timestamp AT TIME ZONE 'Europe/Rome';
  ELSIF p_effective_from IS NOT NULL THEN
    v_from := p_effective_from;
  ELSE
    v_from := now();
  END IF;
  IF v_from < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'COMMISSION_RATE_BACKDATE' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.commission_rates r
    WHERE r.company_id = p_company AND r.effective_from >= v_from
  ) THEN
    RAISE EXCEPTION 'COMMISSION_RATE_ORDER' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('skibidi.commission_write', 'rate', true);
  INSERT INTO public.commission_rates (company_id, rate_percent, effective_from, created_by)
  VALUES (p_company, round(p_rate, 2), v_from, auth.uid());
  RETURN QUERY SELECT round(p_rate, 2), v_from;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_scheduled_commission_rate(p_company uuid, p_effective_from timestamptz)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT coalesce(public.is_platform_owner(), false) THEN
    RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_effective_from IS NULL OR p_effective_from <= now() THEN
    RAISE EXCEPTION 'COMMISSION_RATE_NOT_SCHEDULED' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('skibidi.commission_write', 'rate', true);
  DELETE FROM public.commission_rates
  WHERE company_id = p_company AND effective_from = p_effective_from;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMMISSION_RATE_NOT_SCHEDULED' USING ERRCODE = '22023';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Privilegi. REVOKE ALL toglie anche MAINTAIN (PostgreSQL 17) se un default
-- privilege (supabase_admin / postgres) l'aveva concesso. Poi GRANT espliciti.
-- anon non riceve nulla. Le funzioni interne restano senza EXECUTE.
-- ---------------------------------------------------------------------------

DO $revoke$
DECLARE
  rel text;
  fn text;
BEGIN
  FOREACH rel IN ARRAY ARRAY[
    'public.platform_owners',
    'public.commission_rates',
    'public.commission_month_snapshots'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', rel);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM service_role', rel);
    END IF;
    IF current_setting('server_version_num')::int >= 170000 THEN
      EXECUTE format('REVOKE MAINTAIN ON TABLE %s FROM PUBLIC, anon, authenticated', rel);
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE format('REVOKE MAINTAIN ON TABLE %s FROM service_role', rel);
      END IF;
    END IF;
  END LOOP;

  FOREACH fn IN ARRAY ARRAY[
    'public.is_platform_owner()',
    'public.platform_owners_guard()',
    'public.commission_rate_value_ok(numeric)',
    'public.commission_rates_guard()',
    'public.commission_caller_can_read(uuid)',
    'public.commission_month_compute(uuid, date)',
    'public.commission_snapshot_guard()',
    'public.commission_monthly_summary(uuid, integer)',
    'public.commission_rate_schedule(uuid)',
    'public.set_commission_rate(uuid, numeric, timestamp with time zone, date)',
    'public.cancel_scheduled_commission_rate(uuid, timestamp with time zone)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);
    END IF;
  END LOOP;
END
$revoke$;

GRANT EXECUTE ON FUNCTION public.is_platform_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.commission_monthly_summary(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.commission_rate_schedule(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_commission_rate(uuid, numeric, timestamp with time zone, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_commission_rate(uuid, timestamp with time zone) TO authenticated;
