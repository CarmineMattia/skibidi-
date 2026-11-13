-- Capacità per fascia: da conteggio ordini a unità pizza/pallina equivalenti.
-- Il token [CAPACITY_UNITS:x] viene scritto in orders.notes al checkout.

DROP FUNCTION IF EXISTS get_capacity_snapshot(uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION get_capacity_snapshot(p_company uuid, p_from timestamptz, p_to timestamptz)
RETURNS TABLE(
  created_at timestamptz,
  fulfillment_token text,
  order_type text,
  capacity_units numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.created_at,
         substring(o.notes FROM '\[FULFILLMENT:([^\]]+)\]') AS fulfillment_token,
         o.order_type::text,
         COALESCE(
           NULLIF(substring(o.notes FROM '\[CAPACITY_UNITS:([^\]]+)\]'), '')::numeric,
           1
         ) AS capacity_units
  FROM orders o
  WHERE o.company_id = p_company
    AND o.status IN ('pending','preparing','ready')
    AND o.created_at >= p_from
    AND o.created_at <= p_to;
$$;

REVOKE ALL ON FUNCTION get_capacity_snapshot(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_capacity_snapshot(uuid, timestamptz, timestamptz) TO anon, authenticated;
