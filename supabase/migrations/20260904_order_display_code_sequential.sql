-- Readable sequential order codes: "Ordine #12" (per company / day).
-- Replaces fun pizza nicknames like "Patate #3".

CREATE OR REPLACE FUNCTION reserve_order_display_code(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counter integer;
BEGIN
  INSERT INTO order_daily_counters (company_id, day, counter)
  VALUES (p_company_id, current_date, 1)
  ON CONFLICT (company_id, day)
  DO UPDATE SET counter = order_daily_counters.counter + 1
  RETURNING counter INTO v_counter;

  RETURN 'Ordine #' || v_counter::text;
END;
$$;
