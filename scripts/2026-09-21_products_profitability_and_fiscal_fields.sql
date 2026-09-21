ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS target_margin_pct numeric NOT NULL DEFAULT 40 CHECK (target_margin_pct >= 0 AND target_margin_pct <= 100),
  ADD COLUMN IF NOT EXISTS gtin  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ncm   text NOT NULL DEFAULT '';
