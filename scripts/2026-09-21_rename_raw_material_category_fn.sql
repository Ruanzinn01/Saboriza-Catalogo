CREATE OR REPLACE FUNCTION public.rename_raw_material_category(p_id uuid, p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_old text;
  v_new text := regexp_replace(btrim(p_name), '\s+', ' ', 'g');
BEGIN
  IF v_new = '' THEN
    RAISE EXCEPTION 'O nome da categoria não pode ficar vazio';
  END IF;

  SELECT name INTO v_old FROM public.raw_material_categories WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoria não encontrada';
  END IF;

  UPDATE public.raw_material_categories SET name = v_new WHERE id = p_id;
  UPDATE public.raw_materials
     SET category = v_new, updated_at = now()
   WHERE lower(btrim(category)) = lower(btrim(v_old));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rename_raw_material_category(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_raw_material_category(uuid, text) TO authenticated;
