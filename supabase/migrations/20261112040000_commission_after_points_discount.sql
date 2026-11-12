-- Commissione di piattaforma sull'incassato dopo lo sconto punti confermato.
-- SOLO file di migration: NON applicato al database di produzione.
-- Va dopo 20261112030000, quando le colonne points_* esistono già.
-- Non modifica le migration 20261111180000 e 20261111193000, già in produzione.
--
-- La base resta la colonna gross_total (snapshot e RPC non cambiano firma).
-- Il valore è total_amount meno points_discount_eur solo se points_confirmed_at
-- è valorizzato. Una richiesta non confermata non scala nulla. Lo sconto non
-- porta la base sotto zero. Senza conferma il calcolo è quello di prima.
-- I mesi già congelati restano com'erano: lo snapshot non si ricalcola.
-- total_amount, l'accredito punti, l'IVA e il modulo fiscale non si toccano.
-- RLS, SECURITY DEFINER, search_path e i GRANT restano quelli di oggi:
-- commission_month_compute non è eseguibile dal client.

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
      round(
        CASE
          WHEN o.points_confirmed_at IS NOT NULL
           AND coalesce(o.points_discount_eur, 0) > 0
          THEN greatest(0, o.total_amount - o.points_discount_eur)
          ELSE o.total_amount
        END,
        2
      ) AS gross,
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

REVOKE ALL ON FUNCTION public.commission_month_compute(uuid, date) FROM PUBLIC, anon, authenticated;
DO $revoke_compute$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.commission_month_compute(uuid, date) FROM service_role;
  END IF;
END
$revoke_compute$;
