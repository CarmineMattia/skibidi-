-- Add table_number column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS table_number TEXT;

-- Update RLS policies if necessary (existing policies likely cover it as part of row)
-- Ensuring it's accessible to read/write as per existing policies
