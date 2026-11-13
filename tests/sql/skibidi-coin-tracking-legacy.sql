-- Simula get_order_tracking com'era prima di #57: l'ordine intero, anche per anon.
CREATE OR REPLACE FUNCTION public.get_order_tracking(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(o.*)
  FROM public.orders o
  WHERE o.id = p_order_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_order_tracking(uuid) TO anon, authenticated;
