-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001203543 · md5 normalizado 55cb1239cfd73a94c42855d687ab4238 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create or replace function public.create_platform_company(p_display_name text, p_legal_name text DEFAULT NULL::text, p_document text DEFAULT NULL::text, p_segment text DEFAULT 'GERAL'::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  new_id uuid;
  base_slug text;
  final_slug text;
  suffix int := 1;
  reserved_slugs text[] := array['admin', 'platform', 'checkout', 'pedido-confirmado', 'api', 'assets'];
begin
  if not exists (select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  if p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'nome da empresa é obrigatório';
  end if;

  base_slug := lower(regexp_replace(regexp_replace(trim(p_display_name), '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'));
  if base_slug = any(reserved_slugs) or length(base_slug) = 0 then
    base_slug := base_slug || '-empresa';
  end if;

  final_slug := base_slug;
  while exists (select 1 from companies where slug = final_slug) or final_slug = any(reserved_slugs) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix::text;
  end loop;

  insert into companies (display_name, legal_name, document, segment, status, slug)
  values (p_display_name, nullif(p_legal_name, ''), nullif(p_document, ''), coalesce(nullif(p_segment, ''), 'GERAL'), 'ACTIVE', final_slug)
  returning id into new_id;

  insert into settings (company_id, fantasy_name, factory_name)
  values (new_id, p_display_name, p_display_name);

  return new_id;
end;
$function$;
;
