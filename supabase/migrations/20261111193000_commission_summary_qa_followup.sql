-- Seguito QA del resoconto commissioni (non bloccante).
-- SOLO file di migration: NON applicato al database di produzione.
-- Applicare solo con l'OK esplicito di Carmine, insieme a
-- 20261111180000_online_order_commission_summary.sql.
--
-- 1. Niente snapshot del mese di Roma in corso o di un mese futuro,
--    neanche da postgres: congelarlo farebbe cadere gli ordini successivi.
-- 2. TRUNCATE non svuota i mesi congelati né lo storico delle aliquote.
-- 3. DELETE su platform_owners solo da una sessione senza JWT che non sia
--    un ruolo dell'app (editor SQL), per togliere un UUID sbagliato.
-- 4. Lo spaccato aliquote distingue i periodi (5% poi 8% poi di nuovo 5%
--    restano tre fette), non solo la percentuale.

CREATE OR REPLACE FUNCTION public.platform_owners_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_user IN ('anon', 'authenticated', 'authenticator', 'service_role') THEN
      RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    -- Un JWT, anche nella sessione postgres, non cancella.
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF current_user IN ('anon', 'authenticated', 'authenticator') THEN
    RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT coalesce(public.is_platform_owner(), false) THEN
    RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

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
      rate.rate_id,
      rate.rate_percent,
      rate.effective_from
    FROM public.orders o
    CROSS JOIN bounds b
    LEFT JOIN LATERAL (
      SELECT r.id AS rate_id, r.rate_percent, r.effective_from
      FROM public.commission_rates r
      WHERE r.company_id = o.company_id
        AND r.effective_from <= o.created_at
      ORDER BY r.effective_from DESC
      LIMIT 1
    ) rate ON true
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
    SELECT
      gross,
      rate_id,
      rate_percent,
      effective_from,
      round(gross * rate_percent / 100, 2) AS commission
    FROM base
    WHERE rate_percent IS NOT NULL
  ),
  slices AS (
    SELECT
      rate_id,
      rate_percent,
      effective_from,
      count(*)::integer AS order_count,
      coalesce(sum(gross), 0)::numeric(12,2) AS gross_total,
      coalesce(sum(commission), 0)::numeric(12,2) AS commission_total
    FROM rated
    GROUP BY rate_id, rate_percent, effective_from
  )
  SELECT
    coalesce((SELECT count(*)::integer FROM rated), 0),
    coalesce((SELECT sum(gross) FROM rated), 0)::numeric(12,2),
    coalesce((SELECT sum(commission) FROM rated), 0)::numeric(12,2),
    coalesce((SELECT count(*)::integer FROM base WHERE rate_percent IS NULL), 0),
    coalesce((SELECT sum(gross) FROM base WHERE rate_percent IS NULL), 0)::numeric(12,2),
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'rate_id', s.rate_id,
        'rate_percent', s.rate_percent,
        'effective_from', s.effective_from,
        'order_count', s.order_count,
        'gross_total', s.gross_total,
        'commission_total', s.commission_total
      ) ORDER BY s.effective_from)
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
  v_current date;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'COMMISSION_SNAPSHOT_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  IF current_user IN ('anon', 'authenticated', 'authenticator') THEN
    RAISE EXCEPTION 'COMMISSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  NEW.month_start := date_trunc('month', NEW.month_start::timestamp)::date;
  v_current := (date_trunc('month', now() AT TIME ZONE 'Europe/Rome'))::date;
  -- Anche postgres: un mese aperto (o futuro) non si congela.
  IF NEW.month_start >= v_current THEN
    RAISE EXCEPTION 'COMMISSION_SNAPSHOT_OPEN' USING ERRCODE = '55000';
  END IF;
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

CREATE OR REPLACE FUNCTION public.commission_block_truncate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'commission_rates' THEN
    RAISE EXCEPTION 'COMMISSION_RATE_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  RAISE EXCEPTION 'COMMISSION_SNAPSHOT_IMMUTABLE' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS commission_snapshots_block_truncate ON public.commission_month_snapshots;
CREATE TRIGGER commission_snapshots_block_truncate
  BEFORE TRUNCATE ON public.commission_month_snapshots
  FOR EACH STATEMENT EXECUTE FUNCTION public.commission_block_truncate();

DROP TRIGGER IF EXISTS commission_rates_block_truncate ON public.commission_rates;
CREATE TRIGGER commission_rates_block_truncate
  BEFORE TRUNCATE ON public.commission_rates
  FOR EACH STATEMENT EXECUTE FUNCTION public.commission_block_truncate();

REVOKE ALL ON FUNCTION public.commission_block_truncate() FROM PUBLIC, anon, authenticated;
DO $revoke_truncate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.commission_block_truncate() FROM service_role;
  END IF;
END
$revoke_truncate$;
