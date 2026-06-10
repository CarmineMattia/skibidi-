-- Bugfix visibilità ordini (TASK143):
-- 1) i clienti loggati vedevano TUTTI gli ordini della company (privacy leak)
-- 2) gli ospiti non potevano vedere il proprio ordine nel tracking (RLS blocca anon)

-- 1) Select più strette: admin = ordini della company, cliente = solo i propri
DROP POLICY IF EXISTS orders_select ON orders;
CREATE POLICY orders_select ON orders FOR SELECT
  USING (
    (is_admin() AND company_id = get_my_company_id())
    OR auth.uid() = customer_id
  );

DROP POLICY IF EXISTS order_items_select ON order_items;
CREATE POLICY order_items_select ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND (
          (is_admin() AND o.company_id = get_my_company_id())
          OR o.customer_id = auth.uid()
        )
    )
  );

-- 2) Tracking ospite: chi conosce l'UUID dell'ordine (magic link) lo può leggere
CREATE OR REPLACE FUNCTION get_order_tracking(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(o.*) || jsonb_build_object(
    'order_items', COALESCE((
      SELECT jsonb_agg(to_jsonb(oi.*) || jsonb_build_object('product', to_jsonb(p.*)))
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM orders o
  WHERE o.id = p_order_id;
$$;

REVOKE ALL ON FUNCTION get_order_tracking(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_order_tracking(uuid) TO anon, authenticated;

-- 3) Verifica capacità slot nel checkout senza esporre i dati degli ordini
CREATE OR REPLACE FUNCTION get_capacity_snapshot(p_company uuid, p_from timestamptz, p_to timestamptz)
RETURNS TABLE(created_at timestamptz, fulfillment_token text, order_type text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.created_at,
         substring(o.notes FROM '\[FULFILLMENT:([^\]]+)\]') AS fulfillment_token,
         o.order_type::text
  FROM orders o
  WHERE o.company_id = p_company
    AND o.status IN ('pending','preparing','ready')
    AND o.created_at >= p_from
    AND o.created_at <= p_to;
$$;

REVOKE ALL ON FUNCTION get_capacity_snapshot(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_capacity_snapshot(uuid, timestamptz, timestamptz) TO anon, authenticated;
