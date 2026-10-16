-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001182921 · md5 normalizado 32197ceb78ba0310d8a8df2e45034321 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- ============================================================
-- Monitoramento de erro client-side (sem precisar de Sentry/conta
-- externa). Insert sempre permitido (nunca pode falhar por causa de
-- RLS - erro de permissao ao logar erro seria irônico). Leitura só
-- via RPC: admin da empresa ve os erros da propria empresa,
-- platform admin ve tudo.
-- ============================================================

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
$$;

create table public.client_errors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid default private.default_company_id(),
  user_id uuid default auth.uid(),
  message text not null,
  stack text,
  url text,
  user_agent text,
  severity text not null default 'ERROR' check (severity in ('ERROR','WARNING')),
  context jsonb,
  created_at timestamptz not null default now()
);

alter table public.client_errors enable row level security;

-- Ninguem le a tabela direto - so via get_client_errors (evita vazar erro
-- de uma empresa pra outra e evita expor stack trace pra quem nao deveria).
create policy client_errors_insert on public.client_errors
  for insert with check (true);

create index idx_client_errors_company_created on public.client_errors(company_id, created_at desc);

create or replace function public.get_client_errors(p_limit integer default 50)
returns setof public.client_errors
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company uuid := private.default_company_id();
begin
  if private.is_platform_admin() then
    return query select * from public.client_errors order by created_at desc limit p_limit;
  end if;

  if v_company is null or not private.has_permission(v_company, 'financeiro.integracoes.read') then
    raise exception 'Sem permissao para ver erros do sistema';
  end if;

  return query select * from public.client_errors where company_id = v_company order by created_at desc limit p_limit;
end;
$$;

revoke execute on function public.get_client_errors(integer) from anon, public;
grant execute on function public.get_client_errors(integer) to authenticated;

alter publication supabase_realtime add table public.client_errors;
;
