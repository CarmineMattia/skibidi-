-- Fixture for the staff receipt tests: fiscal_audit_log as on prod (columns,
-- NOT NULLs, FK to orders) and the billable / empty orders used by
-- tests/sql/staff-receipt.sql. Disposable local DB only.
CREATE TABLE IF NOT EXISTS public.fiscal_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  action varchar NOT NULL,
  provider varchar NOT NULL,
  external_id text,
  request_data jsonb,
  response_data jsonb,
  status varchar NOT NULL DEFAULT 'pending',
  error_message text,
  error_code varchar,
  attempt_count integer NOT NULL DEFAULT 1,
  processing_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL REFERENCES public.companies(id)
);
ALTER TABLE public.fiscal_audit_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_audit_log TO anon, authenticated;
CREATE POLICY fiscal_audit_select ON public.fiscal_audit_log FOR SELECT
  USING (public.is_admin() AND company_id = public.get_my_company_id());
-- the receipt functions read product names
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name text;
SELECT 'staff receipt fixture ready' AS status;
