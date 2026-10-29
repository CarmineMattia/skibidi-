-- Bucket Storage "products" e relative policy.
-- Registrata su prod come versione 20260117194108; il file non era nel repo, qui è ricostruito
-- dalla riga di supabase_migrations.schema_migrations (sola lettura, 2026-10-29).
--
-- Già idempotente (ON CONFLICT, DROP POLICY IF EXISTS prima di ogni CREATE POLICY). In più
-- è protetta da una guardia: dove lo schema `storage` non esiste (PGlite, test) non fa nulla,
-- invece di fallire.
DO $mig$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE '20260117194108: schema storage assente, salto';
    RETURN;
  END IF;
  EXECUTE $q$
-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'products',
  'products',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist 
DROP POLICY IF EXISTS "Public Access for Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

-- Create RLS policies for the bucket
-- Allow anyone to read (public bucket)
CREATE POLICY "Public Access for Product Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'products');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'products');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'products');

-- Allow authenticated users (admins) to delete
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'products');
$q$;
END
$mig$;
