-- Add phone and address to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;

-- Add order details to orders
-- We use text for order_type to allow flexibility, but we can add a check constraint
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'eat_in';
ALTER TABLE public.orders ADD CONSTRAINT check_order_type CHECK (order_type IN ('eat_in', 'take_away', 'delivery'));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address text;

-- Update RLS policies if necessary (usually existing ones cover updates if owner)
-- Ensure authenticated users can update their own profile
CREATE POLICY "Users can update own profile details" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);
