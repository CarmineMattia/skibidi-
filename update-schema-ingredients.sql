-- Add ingredients column to products
-- It's a text array to store a list of ingredients
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ingredients text[] DEFAULT '{}';
