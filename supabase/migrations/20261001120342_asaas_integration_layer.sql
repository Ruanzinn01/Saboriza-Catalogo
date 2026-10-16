-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001120342 · md5 normalizado 331579f123bbd6d7ff2877d88fc42518 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Estados tecnicos separados do status financeiro (patch secao 6)
alter table public.charges add column if not exists technical_state text not null default 'NAO_ENVIADO';
alter table public.charges add column if not exists last_error text;
alter table public.charges add constraint charges_technical_state_check
  check (technical_state in ('NAO_ENVIADO','PENDENTE_ENVIO','ENVIANDO','ENVIADO','AGUARDANDO_EVENTO','SINCRONIZADO','FALHA_TEMPORARIA','FALHA_DEFINITIVA','RECONCILIAR'));

-- Vinculo Oris <-> Asaas por cliente (idempotencia de criacao de customer)
alter table public.customers add column if not exists asaas_customer_id text;

-- Token de validacao do webhook (header asaas-access-token), por credencial
alter table public.company_integration_credentials add column if not exists webhook_token text;

-- Eventos de webhook: persistidos antes de qualquer regra de negocio, event_id idempotente (patch secao 4)
create table if not exists public.asaas_webhook_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id),
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  process_error text
);

alter table public.asaas_webhook_events enable row level security;

create policy "asaas_webhook_events_company_read" on public.asaas_webhook_events
  for select using (private.has_permission(company_id, 'financeiro.integracoes.manage'));

revoke all on public.asaas_webhook_events from anon, authenticated;
grant select on public.asaas_webhook_events to authenticated;
;
