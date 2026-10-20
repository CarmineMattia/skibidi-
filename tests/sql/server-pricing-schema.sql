-- Fixture for the server-side pricing tests. Disposable local DB only.
-- Adds the menu columns the order chain fixture does not model (same names /
-- types as prod: categories.name, products.name/category_id/ingredients,
-- companies.settings).
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY, name text NOT NULL, active boolean DEFAULT true, company_id uuid REFERENCES public.companies(id)
);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ingredients text[];
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
SELECT 'pricing fixture ready' AS status;
