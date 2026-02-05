-- ==========================================
-- 1. STORAGE BUCKET SETUP
-- ==========================================

-- Insert the 'products' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Remove existing policies to avoid conflicts or duplication
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow Updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow Deletes" ON storage.objects;

-- Create policies

-- 1. Public Read Access (Anyone can view images)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'products' );

-- 2. Allow Uploads (Authenticated users or Anon - simplified for dev)
-- WARNING: This allows anyone with the anon key to upload. Secure this in production!
CREATE POLICY "Allow Uploads"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'products' );

-- 3. Allow Updates (Authenticated users or Anon)
CREATE POLICY "Allow Updates"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'products' );

-- 4. Allow Deletes (Authenticated users or Anon)
CREATE POLICY "Allow Deletes"
ON storage.objects FOR DELETE
USING ( bucket_id = 'products' );


-- ==========================================
-- 2. PRODUCTS TABLE RLS (Unblocking the seed script)
-- ==========================================

-- Ensure RLS is enabled
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might be too restrictive for your current testing
DROP POLICY IF EXISTS "Public products are viewable by everyone" ON products;
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Enable write access for all users" ON products;


-- Create new permissive policies for development (REPLACE with secure policies for production)

-- 1. Public Read
CREATE POLICY "Enable read access for all users"
ON products FOR SELECT
USING (true);

-- 2. Public Write (Insert/Update/Delete) - To unblock your seed scripts
-- WARNING: This allows anyone to modify products. 
CREATE POLICY "Enable write access for all users"
ON products FOR ALL
USING (true)
WITH CHECK (true);

-- ==========================================
-- 3. VERIFICATION
-- ==========================================
SELECT * FROM storage.buckets WHERE id = 'products';
