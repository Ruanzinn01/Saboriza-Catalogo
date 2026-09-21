CREATE TABLE IF NOT EXISTS public.raw_material_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS raw_material_categories_name_key
  ON public.raw_material_categories (lower(btrim(name)));

ALTER TABLE public.raw_material_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY raw_material_categories_admin_select_all ON public.raw_material_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY raw_material_categories_admin_insert ON public.raw_material_categories
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY raw_material_categories_admin_update ON public.raw_material_categories
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY raw_material_categories_admin_delete ON public.raw_material_categories
  FOR DELETE TO authenticated USING (true);

INSERT INTO public.raw_material_categories (name)
SELECT DISTINCT btrim(category) FROM public.raw_materials WHERE btrim(category) <> ''
ON CONFLICT DO NOTHING;
