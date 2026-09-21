ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS max_stock numeric NOT NULL DEFAULT 0 CHECK (max_stock >= 0);
