-- Fixture for the order_items insert guard tests. Disposable local DB only.
-- The order chain fixture has no display-code counters: create the table like
-- 20260711 does, then the runner applies the real reserve_order_display_code
-- (20260904) and the counters RLS (20261013).
CREATE TABLE IF NOT EXISTS public.order_daily_counters (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT current_date,
  counter integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, day)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
SELECT 'fixture ready' AS status;
