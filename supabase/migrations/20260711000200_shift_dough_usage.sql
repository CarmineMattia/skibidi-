-- Palline consumate nella serata/shift corrente (da shiftStartedAt in settings).

CREATE OR REPLACE FUNCTION get_shift_dough_usage(p_company uuid, p_since timestamptz)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    COALESCE(
      NULLIF(substring(o.notes FROM '\[CAPACITY_UNITS:([^\]]+)\]'), '')::numeric,
      1
    )
  ), 0)
  FROM orders o
  WHERE o.company_id = p_company
    AND o.created_at >= p_since
    AND o.status IN ('pending', 'preparing', 'ready', 'delivered');
$$;

REVOKE ALL ON FUNCTION get_shift_dough_usage(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_shift_dough_usage(uuid, timestamptz) TO anon, authenticated;
