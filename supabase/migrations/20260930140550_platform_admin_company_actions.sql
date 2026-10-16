-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930140550 · md5 normalizado 1c0525441e66399cf1817f6240cd3653 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create or replace function public.create_platform_company(
  p_display_name text,
  p_legal_name text default null,
  p_document text default null
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

  insert into companies (display_name, legal_name, document, status)
  values (p_display_name, nullif(p_legal_name, ''), nullif(p_document, ''), 'ACTIVE')
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.create_platform_company(text, text, text) to authenticated;

create or replace function public.set_platform_company_status(p_company_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  if p_status not in ('ACTIVE', 'SUSPENSA') then
    raise exception 'status inválido';
  end if;

  update companies set status = p_status, updated_at = now() where id = p_company_id;

  if not found then
    raise exception 'empresa não encontrada';
  end if;
end;
$$;

grant execute on function public.set_platform_company_status(uuid, text) to authenticated;
;
