-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930231942 · md5 normalizado 85751e6a7f857393439a07bbe98e59d9 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- ============================================================
-- Fase 5 (Asaas) + Fase 6 (Emissao Fiscal): estrutura completa de
-- credenciais por empresa/tenant. A chamada real pra API externa
-- (Asaas/provedor fiscal) fica de proposito FORA deste escopo -
-- so a integracao em si permanece pendente.
-- ============================================================

create table public.company_integration_credentials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  provider text not null check (provider in ('ASAAS','FISCAL')),
  environment text not null default 'SANDBOX' check (environment in ('SANDBOX','PRODUCAO')),
  vault_secret_id uuid,
  key_last4 text,
  wallet_id text,
  fiscal_provider_name text,
  status text not null default 'NAO_CONFIGURADO' check (status in ('NAO_CONFIGURADO','CONFIGURADO','VALIDADO','ERRO')),
  last_validated_at timestamptz,
  last_error text,
  created_by_user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider, environment)
);

alter table public.company_integration_credentials enable row level security;

create policy cic_select on public.company_integration_credentials
  for select using (private.has_permission(company_id, 'financeiro.integracoes.read'));
create policy cic_insert on public.company_integration_credentials
  for insert with check (private.has_permission(company_id, 'financeiro.integracoes.manage'));
create policy cic_update on public.company_integration_credentials
  for update using (private.has_permission(company_id, 'financeiro.integracoes.manage'))
  with check (private.has_permission(company_id, 'financeiro.integracoes.manage'));
create policy cic_delete on public.company_integration_credentials
  for delete using (private.has_permission(company_id, 'financeiro.integracoes.manage'));

-- Mesma logica de rastreabilidade que 'charges' ja tem - fiscal_documents
-- tambem passa a saber qual provedor emitiu.
alter table public.fiscal_documents add column provider text;

-- Catalogo de permissao (mesmo padrao de fechamento.read/fechamento.manage)
insert into public.permissions (key, name, description, sensitivity) values
  ('financeiro.integracoes.read', 'Ver Integracoes Financeiras', 'Ver status das credenciais de Asaas e emissao fiscal (sem ver a chave)', 'CRITICAL'),
  ('financeiro.integracoes.manage', 'Gerenciar Integracoes Financeiras', 'Cadastrar, atualizar ou remover credenciais de Asaas e emissao fiscal', 'CRITICAL');

-- Concede ao Proprietario da(s) empresa(s) hoje existente(s) - mesmo padrao
-- usado em fechamento.manage. Empresas novas (franquias) precisam desse
-- grant replicado quando o onboarding de empresa for automatizado.
insert into public.role_permissions (company_id, role_id, permission_key)
select m.company_id, mr.role_id, perm.key
from public.memberships m
join public.membership_roles mr on mr.membership_id = m.id
join public.roles r on r.id = mr.role_id and r.name = 'Proprietário'
cross join (values ('financeiro.integracoes.read'), ('financeiro.integracoes.manage')) as perm(key)
group by m.company_id, mr.role_id, perm.key;

-- ============================================================
-- RPC: salvar (criar ou atualizar) uma credencial - a chave nunca
-- fica em coluna comum, vai pro Supabase Vault (criptografada).
-- ============================================================
create or replace function public.save_integration_credential(
  p_provider text,
  p_environment text,
  p_api_key text,
  p_wallet_id text default null,
  p_fiscal_provider_name text default null
) returns public.company_integration_credentials
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company uuid := private.default_company_id();
  v_existing public.company_integration_credentials;
  v_secret_id uuid;
  v_row public.company_integration_credentials;
begin
  if not private.has_permission(v_company, 'financeiro.integracoes.manage') then
    raise exception 'Sem permissao para gerenciar integracoes financeiras';
  end if;

  if p_api_key is null or length(trim(p_api_key)) < 8 then
    raise exception 'Chave de API invalida';
  end if;

  select * into v_existing from public.company_integration_credentials
    where company_id = v_company and provider = p_provider and environment = p_environment
    for update;

  if found then
    perform vault.update_secret(v_existing.vault_secret_id, p_api_key);
    update public.company_integration_credentials
      set key_last4 = right(p_api_key, 4),
          wallet_id = coalesce(p_wallet_id, wallet_id),
          fiscal_provider_name = coalesce(p_fiscal_provider_name, fiscal_provider_name),
          status = 'CONFIGURADO',
          last_error = null,
          updated_at = now()
      where id = v_existing.id
      returning * into v_row;
  else
    v_secret_id := vault.create_secret(
      p_api_key,
      'integration_' || v_company || '_' || p_provider || '_' || p_environment,
      'Credencial ' || p_provider || ' (' || p_environment || ') da empresa ' || v_company
    );
    insert into public.company_integration_credentials (
      company_id, provider, environment, vault_secret_id, key_last4, wallet_id, fiscal_provider_name, status
    ) values (
      v_company, p_provider, p_environment, v_secret_id, right(p_api_key, 4), p_wallet_id, p_fiscal_provider_name, 'CONFIGURADO'
    ) returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.save_integration_credential(text, text, text, text, text) from public;
grant execute on function public.save_integration_credential(text, text, text, text, text) to authenticated;

-- ============================================================
-- RPC: remover credencial (some com o segredo no Vault tambem)
-- ============================================================
create or replace function public.remove_integration_credential(
  p_provider text,
  p_environment text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company uuid := private.default_company_id();
  v_row public.company_integration_credentials;
begin
  if not private.has_permission(v_company, 'financeiro.integracoes.manage') then
    raise exception 'Sem permissao para gerenciar integracoes financeiras';
  end if;

  select * into v_row from public.company_integration_credentials
    where company_id = v_company and provider = p_provider and environment = p_environment;

  if not found then
    return;
  end if;

  delete from public.company_integration_credentials where id = v_row.id;
  delete from vault.secrets where id = v_row.vault_secret_id;
end;
$$;

revoke execute on function public.remove_integration_credential(text, text) from public;
grant execute on function public.remove_integration_credential(text, text) to authenticated;

alter publication supabase_realtime add table public.company_integration_credentials;
;
