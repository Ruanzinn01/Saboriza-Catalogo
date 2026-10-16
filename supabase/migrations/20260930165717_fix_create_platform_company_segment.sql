-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930165717 · md5 normalizado f86529cd7f03449ef29cb09c5f54b868 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create or replace function public.create_platform_company(
  p_display_name text,
  p_legal_name text default null,
  p_document text default null,
  p_segment text default 'GERAL'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not exists (select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  if p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'nome da empresa é obrigatório';
  end if;

  insert into companies (display_name, legal_name, document, segment, status)
  values (p_display_name, nullif(p_legal_name, ''), nullif(p_document, ''), coalesce(nullif(p_segment, ''), 'GERAL'), 'ACTIVE')
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.create_platform_company(text, text, text, text) to authenticated;
;
