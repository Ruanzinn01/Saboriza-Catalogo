ALTER TABLE public.raw_materials
  ADD COLUMN IF NOT EXISTS min_purchase_qty    numeric NOT NULL DEFAULT 0 CHECK (min_purchase_qty >= 0),
  ADD COLUMN IF NOT EXISTS default_reorder_qty numeric NOT NULL DEFAULT 0 CHECK (default_reorder_qty >= 0),
  ADD COLUMN IF NOT EXISTS purchase_multiple   numeric NOT NULL DEFAULT 0 CHECK (purchase_multiple >= 0),
  ADD COLUMN IF NOT EXISTS lead_time_days      integer NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0),
  ADD COLUMN IF NOT EXISTS cost_basis          text    NOT NULL DEFAULT 'avg_cost'
    CHECK (cost_basis IN ('avg_cost','last_cost','manual')),
  ADD COLUMN IF NOT EXISTS manual_cost         numeric NOT NULL DEFAULT 0 CHECK (manual_cost >= 0);

ALTER TABLE public.raw_materials
  ADD CONSTRAINT raw_materials_manual_cost_required
  CHECK (cost_basis <> 'manual' OR manual_cost > 0);
