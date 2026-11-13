-- can_insert_order_item(uuid): Prima versione del fix: legge oi.price, colonna che non esiste (corretta subito dopo da 20260901224024).
-- Registrata su prod come versione 20260901223534; il file non era nel repo, qui è ricostruito
-- dalla riga di supabase_migrations.schema_migrations (sola lettura, 2026-10-29).
-- Corpo originale invariato: CREATE OR REPLACE FUNCTION, quindi rieseguibile. In plpgsql le
-- colonne si controllano a runtime, perciò la creazione non fallisce neanche con `price`.
-- Il comportamento attuale è poi ridefinito da 20261020140000_order_items_insert_guard.sql.

CREATE OR REPLACE FUNCTION public.can_insert_order_item(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  v_order_company uuid;
BEGIN
  SELECT o.company_id INTO v_order_company
  FROM public.orders o
  WHERE o.id = p_order_id
    AND (
      o.customer_id IS NULL
      OR o.customer_id = auth.uid()
      OR (public.is_admin() AND public.get_my_company_id() IS NOT NULL)
    );

  IF v_order_company IS NULL THEN
    RETURN false;
  END IF;

  FOR rec IN
    SELECT oi.product_id, oi.price, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = rec.product_id
        AND p.company_id = v_order_company
        AND p.active = true
        AND p.price = rec.price
    ) THEN
      RETURN false;
    END IF;

    IF rec.quantity IS NULL OR rec.quantity < 0 OR rec.quantity > 1000 THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.can_insert_order_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_insert_order_item(uuid) TO anon, authenticated;
