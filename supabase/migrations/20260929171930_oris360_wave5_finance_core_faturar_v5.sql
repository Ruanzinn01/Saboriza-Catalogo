-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260929171930 · md5 normalizado a7efbe7bc3a29dc6bce57c95e95544fe · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- ONDA 5 — Finance Core + Faturar V5 (terreno/schema apenas; integracao Asaas fica para depois)
-- Modelo conceitual da secao 17 do PATCH_FINAL, nomes adaptados ao padrao ja usado no projeto (snake_case, company_id).

-- 1) Credito do cliente (limite permanente)
create table public.customer_credit (
  customer_id uuid primary key references public.customers(id),
  company_id uuid,
  credit_limit numeric not null default 0,
  policy_id text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function private.set_company_from_customer()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  select c.company_id into new.company_id from public.customers c where c.id = new.customer_id;
  return new;
end;
$$;

create trigger customer_credit_set_company before insert on public.customer_credit
  for each row execute function private.set_company_from_customer();
create trigger customer_credit_set_updated_at before update on public.customer_credit
  for each row execute function public.set_updated_at();
create trigger customer_credit_company_immutable before update on public.customer_credit
  for each row execute function private.guard_company_id_immutable();

alter table public.customer_credit enable row level security;
create policy customer_credit_select on public.customer_credit for select
  using (private.has_permission(company_id, 'billing.view_credit_analysis'));
create policy customer_credit_upsert on public.customer_credit for insert
  with check (private.has_permission(company_id, 'customer_credit.change_permanent_limit'));
create policy customer_credit_update on public.customer_credit for update
  using (private.has_permission(company_id, 'customer_credit.change_permanent_limit'))
  with check (private.has_permission(company_id, 'customer_credit.change_permanent_limit'));

-- 2) Compromissos de credito (pedidos em analise que ainda nao viraram recebivel)
create table public.credit_commitments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  customer_id uuid not null references public.customers(id),
  order_id uuid references public.orders(id),
  origin text not null default 'ORDER',
  amount numeric not null,
  status text not null default 'ABERTO' check (status in ('ABERTO','CONVERTIDO','CANCELADO')),
  converted_receivable_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger credit_commitments_set_company before insert on public.credit_commitments
  for each row execute function private.set_company_from_customer();
create trigger credit_commitments_set_updated_at before update on public.credit_commitments
  for each row execute function public.set_updated_at();
create trigger credit_commitments_company_immutable before update on public.credit_commitments
  for each row execute function private.guard_company_id_immutable();

alter table public.credit_commitments enable row level security;
create policy credit_commitments_select on public.credit_commitments for select
  using (private.has_permission(company_id, 'billing.view_credit_analysis'));
create policy credit_commitments_insert on public.credit_commitments for insert
  with check (private.has_permission(company_id, 'billing.invoice_order'));
create policy credit_commitments_update on public.credit_commitments for update
  using (private.has_permission(company_id, 'billing.invoice_order'))
  with check (private.has_permission(company_id, 'billing.invoice_order'));

-- 3) Faturamento (uma linha por Pedido faturado)
create table public.billings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  order_id uuid not null unique references public.orders(id),
  customer_id uuid not null references public.customers(id),
  status text not null default 'RASCUNHO' check (status in ('RASCUNHO','CONFIRMADO')),
  fiscal_choice text check (fiscal_choice in ('EMITIR_NFE','SEM_DOCUMENTO_FISCAL')),
  idempotency_key text unique,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.set_company_from_order_ref()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  select o.company_id into new.company_id from public.orders o where o.id = new.order_id;
  return new;
end;
$$;

create trigger billings_set_company before insert on public.billings
  for each row execute function private.set_company_from_order_ref();
create trigger billings_set_updated_at before update on public.billings
  for each row execute function public.set_updated_at();
create trigger billings_company_immutable before update on public.billings
  for each row execute function private.guard_company_id_immutable();

alter table public.billings enable row level security;
create policy billings_select on public.billings for select
  using (private.has_permission(company_id, 'billing.invoice_order'));
create policy billings_insert on public.billings for insert
  with check (private.has_permission(company_id, 'billing.invoice_order'));
create policy billings_update on public.billings for update
  using (private.has_permission(company_id, 'billing.invoice_order'))
  with check (private.has_permission(company_id, 'billing.invoice_order'));

-- 4) Snapshot financeiro no momento do faturamento (concorrencia/fingerprint)
create table public.billing_credit_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  billing_id uuid not null references public.billings(id),
  open_receivables numeric not null default 0,
  overdue_amount numeric not null default 0,
  overdue_count integer not null default 0,
  commitments numeric not null default 0,
  credit_limit numeric not null default 0,
  current_exposure numeric not null default 0,
  financed_part numeric not null default 0,
  projected_exposure numeric not null default 0,
  available_after numeric not null default 0,
  excess numeric not null default 0,
  fingerprint text not null,
  created_at timestamptz not null default now()
);

create or replace function private.set_company_from_billing()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  select b.company_id into new.company_id from public.billings b where b.id = new.billing_id;
  return new;
end;
$$;

create trigger billing_credit_snapshots_set_company before insert on public.billing_credit_snapshots
  for each row execute function private.set_company_from_billing();

alter table public.billing_credit_snapshots enable row level security;
create policy billing_credit_snapshots_select on public.billing_credit_snapshots for select
  using (private.has_permission(company_id, 'billing.view_credit_analysis'));
create policy billing_credit_snapshots_insert on public.billing_credit_snapshots for insert
  with check (private.has_permission(company_id, 'billing.invoice_order'));

-- 5) Liberacao de credito (solicitacao / autorizacao excepcional)
create table public.credit_releases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  billing_id uuid not null references public.billings(id),
  user_id uuid not null default auth.uid(),
  type text not null check (type in ('SOLICITACAO','AUTORIZACAO_EXCEPCIONAL')),
  reason text not null,
  snapshot_id uuid references public.billing_credit_snapshots(id),
  status text not null default 'PENDENTE' check (status in ('PENDENTE','AUTORIZADA','INVALIDADA')),
  created_at timestamptz not null default now()
);

create trigger credit_releases_set_company before insert on public.credit_releases
  for each row execute function private.set_company_from_billing();

alter table public.credit_releases enable row level security;
create policy credit_releases_select on public.credit_releases for select
  using (private.has_permission(company_id, 'billing.view_credit_analysis'));
create policy credit_releases_insert_request on public.credit_releases for insert
  with check (
    (type = 'SOLICITACAO' and private.has_permission(company_id, 'billing.request_credit_release'))
    or (type = 'AUTORIZACAO_EXCEPCIONAL' and private.has_permission(company_id, 'billing.authorize_credit_exception'))
  );

-- 6) Formas de pagamento do faturamento
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  billing_id uuid not null references public.billings(id),
  type text not null check (type in ('BOLETO','PIX','DINHEIRO','CARTAO','TRANSFERENCIA','OUTROS')),
  amount numeric not null,
  condition text,
  generates_credit boolean not null default false,
  fees jsonb not null default '{}'::jsonb,
  auto_messages boolean not null default true,
  created_at timestamptz not null default now()
);

create trigger payment_methods_set_company before insert on public.payment_methods
  for each row execute function private.set_company_from_billing();

alter table public.payment_methods enable row level security;
create policy payment_methods_select on public.payment_methods for select
  using (private.has_permission(company_id, 'billing.invoice_order'));
create policy payment_methods_insert on public.payment_methods for insert
  with check (private.has_permission(company_id, 'billing.invoice_order'));

-- 7) Parcelas
create table public.installments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  payment_method_id uuid not null references public.payment_methods(id),
  number integer not null,
  days integer not null default 0,
  due_date date not null,
  amount numeric not null,
  status text not null default 'ABERTA' check (status in ('ABERTA','PAGA','VENCIDA','CANCELADA')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.set_company_from_payment_method()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  select pm.company_id into new.company_id from public.payment_methods pm where pm.id = new.payment_method_id;
  return new;
end;
$$;

create trigger installments_set_company before insert on public.installments
  for each row execute function private.set_company_from_payment_method();
create trigger installments_set_updated_at before update on public.installments
  for each row execute function public.set_updated_at();

alter table public.installments enable row level security;
create policy installments_select on public.installments for select
  using (private.has_permission(company_id, 'billing.invoice_order'));
create policy installments_insert on public.installments for insert
  with check (private.has_permission(company_id, 'billing.invoice_order'));
create policy installments_update on public.installments for update
  using (private.has_permission(company_id, 'billing.invoice_order'))
  with check (private.has_permission(company_id, 'billing.invoice_order'));

-- 8) Cobrancas externas (placeholder Asaas — sem chamada real ainda)
create table public.charges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  installment_id uuid not null references public.installments(id),
  provider text not null default 'ASAAS',
  external_id text,
  idempotency_key text not null unique,
  status text not null default 'PENDENTE' check (status in ('PENDENTE','EMITIDA','PAGA','FALHOU','CANCELADA')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.set_company_from_installment()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  select i.company_id into new.company_id from public.installments i where i.id = new.installment_id;
  return new;
end;
$$;

create trigger charges_set_company before insert on public.charges
  for each row execute function private.set_company_from_installment();
create trigger charges_set_updated_at before update on public.charges
  for each row execute function public.set_updated_at();

alter table public.charges enable row level security;
create policy charges_select on public.charges for select
  using (private.has_permission(company_id, 'billing.invoice_order'));
create policy charges_insert on public.charges for insert
  with check (private.has_permission(company_id, 'billing.invoice_order'));

-- 9) Contas a receber (fato financeiro, distinto da cobranca externa)
create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  customer_id uuid not null references public.customers(id),
  billing_id uuid not null references public.billings(id),
  installment_id uuid references public.installments(id),
  amount numeric not null,
  due_date date not null,
  status text not null default 'ABERTO' check (status in ('ABERTO','PAGO','VENCIDO','CANCELADO')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger receivables_set_company before insert on public.receivables
  for each row execute function private.set_company_from_billing();
create trigger receivables_set_updated_at before update on public.receivables
  for each row execute function public.set_updated_at();

alter table public.receivables enable row level security;
create policy receivables_select on public.receivables for select
  using (private.has_permission(company_id, 'billing.view_receivables'));
create policy receivables_insert on public.receivables for insert
  with check (private.has_permission(company_id, 'billing.invoice_order'));
create policy receivables_update on public.receivables for update
  using (private.has_permission(company_id, 'billing.invoice_order'))
  with check (private.has_permission(company_id, 'billing.invoice_order'));

-- 10) Documento fiscal (placeholder motor fiscal — sem emissao real ainda)
create table public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  billing_id uuid not null references public.billings(id),
  number text,
  key text,
  status text not null default 'NAO_EMITIDO' check (status in ('NAO_EMITIDO','PROCESSANDO','AUTORIZADA','REJEITADA')),
  xml_ref text,
  pdf_ref text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger fiscal_documents_set_company before insert on public.fiscal_documents
  for each row execute function private.set_company_from_billing();
create trigger fiscal_documents_set_updated_at before update on public.fiscal_documents
  for each row execute function public.set_updated_at();

alter table public.fiscal_documents enable row level security;
create policy fiscal_documents_select on public.fiscal_documents for select
  using (private.has_permission(company_id, 'billing.invoice_order'));
create policy fiscal_documents_insert on public.fiscal_documents for insert
  with check (private.has_permission(company_id, 'billing.invoice_order'));
create policy fiscal_documents_update on public.fiscal_documents for update
  using (private.has_permission(company_id, 'billing.invoice_order'))
  with check (private.has_permission(company_id, 'billing.invoice_order'));

-- 11) Permissoes (secao 18 do patch)
insert into public.permissions (key, name, description, sensitivity) values
  ('billing.invoice_order', 'Faturar pedido', 'Preparar e confirmar o faturamento de um pedido', 'SENSITIVE'),
  ('billing.view_receivables', 'Consultar recebíveis', 'Ver contas a receber de clientes', 'SENSITIVE'),
  ('billing.view_credit_analysis', 'Consultar análise de crédito', 'Ver limite, exposição e histórico de crédito do cliente', 'SENSITIVE'),
  ('billing.request_credit_release', 'Solicitar liberação de crédito', 'Pedir análise para faturar acima do limite/vencido', 'SENSITIVE'),
  ('billing.authorize_credit_exception', 'Autorizar exceção de crédito', 'Liberar excepcionalmente um faturamento bloqueado', 'CRITICAL'),
  ('customer_credit.change_permanent_limit', 'Alterar limite de crédito permanente', 'Definir o limite de crédito cadastrado do cliente', 'CRITICAL');

insert into public.role_permissions (company_id, role_id, permission_key)
select r.company_id, r.id, p.key
from public.roles r
cross join (values
  ('billing.invoice_order'),
  ('billing.view_receivables'),
  ('billing.view_credit_analysis'),
  ('billing.request_credit_release'),
  ('billing.authorize_credit_exception'),
  ('customer_credit.change_permanent_limit')
) as p(key);
;
