-- Skibidi Coin: lo stato punti nel tracking, senza riaprire i dati del cliente.
-- get_order_tracking può essere già quella ristretta di 20261111234500 (#57)
-- oppure la versione precedente che restituiva l'ordine intero. In entrambi i
-- casi il risultato resta: solo il proprietario, lo staff della stessa company
-- o il kiosk della stessa company; niente nome, telefono, note o indirizzo.
-- Se #57 viene applicata prima, si aggiungono solo i campi punti. Se non è
-- ancora applicata, si installa la stessa forma ristretta con i campi punti.

DO $track_points$
DECLARE
  src text;
  original text;
BEGIN
  IF to_regprocedure('public.get_order_tracking(uuid)') IS NULL THEN
    RAISE NOTICE '20261112030000: get_order_tracking assente';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'points_requested'
  ) THEN
    RAISE NOTICE '20261112030000: colonne punti assenti, tracking invariato';
    RETURN;
  END IF;

  src := pg_get_functiondef('public.get_order_tracking(uuid)'::regprocedure);
  IF position('points_requested' in src) > 0
     AND position('to_jsonb(o.*)' in src) = 0 THEN
    RAISE NOTICE '20261112030000: tracking già limitato ai campi punti';
  ELSIF position('jsonb_build_object' in src) > 0
        AND position('''declined_at'', o.declined_at' in src) > 0 THEN
    original := src;
    src := replace(src, '''declined_at'', o.declined_at',
      '''declined_at'', o.declined_at,
    ''points_requested'', o.points_requested,
    ''points_redeemed'', o.points_redeemed,
    ''points_discount_eur'', o.points_discount_eur,
    ''points_confirmed_at'', o.points_confirmed_at');
    IF src = original THEN
      RAISE EXCEPTION '20261112030000: get_order_tracking non aggiornata';
    END IF;
    EXECUTE src;
  ELSE
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.get_order_tracking(p_order_id uuid)
      RETURNS jsonb
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v jsonb;
      BEGIN
        IF auth.uid() IS NULL THEN
          RETURN NULL;
        END IF;
        SELECT jsonb_build_object(
          'id', o.id,
          'status', o.status,
          'created_at', o.created_at,
          'updated_at', o.updated_at,
          'accepted_at', o.accepted_at,
          'display_code', o.display_code,
          'order_type', o.order_type,
          'table_number', o.table_number,
          'decline_reason_preset', o.decline_reason_preset,
          'decline_reason_note', o.decline_reason_note,
          'declined_at', o.declined_at,
          'points_requested', o.points_requested,
          'points_redeemed', o.points_redeemed,
          'points_discount_eur', o.points_discount_eur,
          'points_confirmed_at', o.points_confirmed_at
        )
        INTO v
        FROM public.orders o
        WHERE o.id = p_order_id
          AND (
            o.customer_id = auth.uid()
            OR (
              coalesce(public.is_admin(), false)
              AND o.company_id IS NOT DISTINCT FROM public.get_my_company_id()
            )
            OR EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid()
                AND p.role = 'kiosk'::public.user_role
                AND p.company_id IS NOT DISTINCT FROM o.company_id
            )
          );
        RETURN v;
      END;
      $body$
    $fn$;
  END IF;
END
$track_points$;

REVOKE ALL ON FUNCTION public.get_order_tracking(uuid) FROM PUBLIC;
DO $track_grants$
BEGIN
  IF to_regprocedure('public.get_order_tracking(uuid)') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.get_order_tracking(uuid) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.get_order_tracking(uuid) FROM authenticated;
    GRANT EXECUTE ON FUNCTION public.get_order_tracking(uuid) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.get_order_tracking(uuid) TO service_role;
  END IF;
END
$track_grants$;
