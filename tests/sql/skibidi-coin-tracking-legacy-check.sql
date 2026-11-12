-- Dopo la migration, la forma precedente non deve più uscire dal tracking.
BEGIN;
SELECT public.t_assert(
  position('to_jsonb(o.*)' in pg_get_functiondef('public.get_order_tracking(uuid)'::regprocedure)) = 0
  AND position('points_requested' in pg_get_functiondef('public.get_order_tracking(uuid)'::regprocedure)) > 0
  AND NOT has_function_privilege('anon', 'public.get_order_tracking(uuid)', 'EXECUTE'),
  'legacy tracking was narrowed and anon lost execute');
SAVEPOINT legacy_owner;
SELECT public.t_as('authenticated', '00000000-0000-0000-0000-0000000000c1');
SELECT public.t_assert(
  (public.get_order_tracking('00000000-0000-0000-0000-000000000101')->>'status') = 'delivered'
  AND (public.get_order_tracking('00000000-0000-0000-0000-000000000101')->>'points_requested')::integer = 0
  AND NOT (public.get_order_tracking('00000000-0000-0000-0000-000000000101') ? 'customer_name')
  AND NOT (public.get_order_tracking('00000000-0000-0000-0000-000000000101') ? 'customer_phone'),
  'owner still tracks after the legacy function is replaced');
ROLLBACK TO SAVEPOINT legacy_owner;
SELECT public.t_clear();
SELECT 'skibidi tracking legacy ok' AS status;
COMMIT;
