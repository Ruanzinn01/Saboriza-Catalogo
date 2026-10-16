-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260929172812 · md5 normalizado 5a64d766b884fd049d5d1c3a0d5926c5 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- ONDA 7 — Despesas / Receitas / Aportes / Patrimonio (terreno/schema)
-- Principio comum aos 4 contratos: fato economico unico, nunca duplicado entre modulos, estorno preserva original.

------------------------------------------------------------
-- APORTES DE SOCIOS
------------------------------------------------------------

create table public.company_partners (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  name text not null,
  document text,
  status text not null default 'ATIVO' check (status in ('ATIVO','INATIVO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger company_partners_set_updated_at before update on public.company_partners
  for each row execute function public.set_updated_at();
create trigger company_partners_company_immutable before update on public.company_partners
  for each row execute function private.guard_company_id_immutable();

alter table public.company_partners enable row level security;
create policy company_partners_select on public.company_partners for select
  using (private.has_permission(company_id, 'aportes.read'));
create policy company_partners_insert on public.company_partners for insert
  with check (private.has_permission(company_id, 'aportes.manage'));
create policy company_partners_update on public.company_partners for update
  using (private.has_permission(company_id, 'aportes.manage'))
  with check (private.has_permission(company_id, 'aportes.manage'));

create table public.partner_contributions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  partner_id uuid not null references public.company_partners(id),
  amount numeric not null check (amount > 0),
  status text not null default 'PLANEJADO' check (status in ('PLANEJADO','A_CONFIRMAR','REALIZADO','CANCELADO','ESTORNADO')),
  origin text not null check (origin in ('TRANSFERENCIA','PIX','DEPOSITO','DINHEIRO','PAGAMENTO_DIRETO_DESPESA','OUTRO')),
  planned_date date,
  realized_date date,
  notes text,
  expense_id uuid,
  reversed_contribution_id uuid references public.partner_contributions(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.set_company_from_partner()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  select p.company_id into new.company_id from public.company_partners p where p.id = new.partner_id;
  return new;
end;
$$;

create trigger partner_contributions_set_company before insert on public.partner_contributions
  for each row execute function private.set_company_from_partner();
create trigger partner_contributions_set_updated_at before update on public.partner_contributions
  for each row execute function public.set_updated_at();
create trigger partner_contributions_company_immutable before update on public.partner_contributions
  for each row execute function private.guard_company_id_immutable();

alter table public.partner_contributions enable row level security;
create policy partner_contributions_select on public.partner_contributions for select
  using (private.has_permission(company_id, 'aportes.read'));
create policy partner_contributions_insert on public.partner_contributions for insert
  with check (private.has_permission(company_id, 'aportes.manage'));
create policy partner_contributions_update on public.partner_contributions for update
  using (private.has_permission(company_id, 'aportes.manage'))
  with check (private.has_permission(company_id, 'aportes.manage'));

------------------------------------------------------------
-- DESPESAS (inclui obrigacao salarial e vales, sem reinventar Colaboradores)
------------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  description text not null,
  category text not null default 'OUTRA',
  nature text not null default 'OPERACIONAL' check (nature in ('OPERACIONAL','INVESTIMENTO','SALARIO','OUTRO')),
  employee_id uuid references public.employees(id),
  competence date,
  amount numeric not null check (amount >= 0),
  status text not null default 'ABERTO' check (status in ('ABERTO','AGENDADO','PAGO','ATRASADO')),
  due_date date,
  paid_at timestamptz,
  paid_amount numeric,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
create trigger expenses_company_immutable before update on public.expenses
  for each row execute function private.guard_company_id_immutable();

alter table public.expenses enable row level security;
create policy expenses_select on public.expenses for select
  using (private.has_permission(company_id, 'despesas.read'));
create policy expenses_insert on public.expenses for insert
  with check (private.has_permission(company_id, 'despesas.manage'));
create policy expenses_update on public.expenses for update
  using (private.has_permission(company_id, 'despesas.manage'))
  with check (private.has_permission(company_id, 'despesas.manage'));

-- alinhar aportes.expense_id ao domicilio real, agora que expenses existe
alter table public.partner_contributions
  add constraint partner_contributions_expense_id_fkey foreign key (expense_id) references public.expenses(id);

-- Uma obrigacao salarial por colaborador/competencia (nunca redigitar o salario em Despesas).
create table public.salary_obligations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  employee_id uuid not null references public.employees(id),
  competence date not null,
  base_salary numeric not null,
  status text not null default 'ABERTO' check (status in ('ABERTO','PAGO','ATRASADO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, competence)
);

create trigger salary_obligations_set_company before insert on public.salary_obligations
  for each row execute function private.set_company_from_employee();
create trigger salary_obligations_set_updated_at before update on public.salary_obligations
  for each row execute function public.set_updated_at();
create trigger salary_obligations_company_immutable before update on public.salary_obligations
  for each row execute function private.guard_company_id_immutable();

alter table public.salary_obligations enable row level security;
create policy salary_obligations_select on public.salary_obligations for select
  using (private.has_permission(company_id, 'despesas.read'));
create policy salary_obligations_insert on public.salary_obligations for insert
  with check (private.has_permission(company_id, 'despesas.manage'));
create policy salary_obligations_update on public.salary_obligations for update
  using (private.has_permission(company_id, 'despesas.manage'))
  with check (private.has_permission(company_id, 'despesas.manage'));

-- Vale: realizacao parcial da MESMA obrigacao salarial, nunca uma segunda despesa.
create table public.salary_advances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  salary_obligation_id uuid not null references public.salary_obligations(id),
  amount numeric not null check (amount > 0),
  status text not null default 'SOLICITADO' check (status in ('SOLICITADO','AGENDADO','PAGO','ESTORNADO')),
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  reversed_advance_id uuid references public.salary_advances(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.set_company_from_salary_obligation()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  select s.company_id into new.company_id from public.salary_obligations s where s.id = new.salary_obligation_id;
  return new;
end;
$$;

create trigger salary_advances_set_company before insert on public.salary_advances
  for each row execute function private.set_company_from_salary_obligation();
create trigger salary_advances_set_updated_at before update on public.salary_advances
  for each row execute function public.set_updated_at();
create trigger salary_advances_company_immutable before update on public.salary_advances
  for each row execute function private.guard_company_id_immutable();

alter table public.salary_advances enable row level security;
create policy salary_advances_select on public.salary_advances for select
  using (private.has_permission(company_id, 'despesas.read'));
create policy salary_advances_insert on public.salary_advances for insert
  with check (private.has_permission(company_id, 'despesas.manage'));
create policy salary_advances_update on public.salary_advances for update
  using (private.has_permission(company_id, 'despesas.manage'))
  with check (private.has_permission(company_id, 'despesas.manage'));

------------------------------------------------------------
-- RECEITAS
------------------------------------------------------------

create table public.revenues (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  description text not null,
  category text not null default 'OUTRA',
  competence date not null,
  payer_origin_id uuid references public.customers(id),
  principal_amount numeric not null check (principal_amount > 0),
  recurrence_rule jsonb,
  origin text not null default 'MANUAL' check (origin in ('MANUAL','CONTRATO_RECORRENCIA','INTEGRACAO','OUTRO_MODULO')),
  notes text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger revenues_set_updated_at before update on public.revenues
  for each row execute function public.set_updated_at();
create trigger revenues_company_immutable before update on public.revenues
  for each row execute function private.guard_company_id_immutable();

alter table public.revenues enable row level security;
create policy revenues_select on public.revenues for select
  using (private.has_permission(company_id, 'receitas.read'));
create policy revenues_insert on public.revenues for insert
  with check (private.has_permission(company_id, 'receitas.manage'));
create policy revenues_update on public.revenues for update
  using (private.has_permission(company_id, 'receitas.manage'))
  with check (private.has_permission(company_id, 'receitas.manage'));

create table public.revenue_receivables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  revenue_id uuid not null references public.revenues(id),
  installment_number integer not null default 1,
  total_installments integer not null default 1,
  due_date date not null,
  principal numeric not null check (principal > 0),
  open_balance numeric not null,
  status text not null default 'ABERTO' check (status in ('ABERTO','RECEBIDO','VENCIDO','CANCELADO')),
  effective_date date,
  account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.set_company_from_revenue()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  select r.company_id into new.company_id from public.revenues r where r.id = new.revenue_id;
  return new;
end;
$$;

create trigger revenue_receivables_set_company before insert on public.revenue_receivables
  for each row execute function private.set_company_from_revenue();
create trigger revenue_receivables_set_updated_at before update on public.revenue_receivables
  for each row execute function public.set_updated_at();
create trigger revenue_receivables_company_immutable before update on public.revenue_receivables
  for each row execute function private.guard_company_id_immutable();

alter table public.revenue_receivables enable row level security;
create policy revenue_receivables_select on public.revenue_receivables for select
  using (private.has_permission(company_id, 'receitas.read'));
create policy revenue_receivables_insert on public.revenue_receivables for insert
  with check (private.has_permission(company_id, 'receitas.manage'));
create policy revenue_receivables_update on public.revenue_receivables for update
  using (private.has_permission(company_id, 'receitas.manage'))
  with check (private.has_permission(company_id, 'receitas.manage'));

create table public.revenue_receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  receivable_id uuid not null references public.revenue_receivables(id),
  received_amount numeric not null check (received_amount > 0),
  effective_date date not null,
  principal_received numeric not null default 0,
  interest_penalty numeric not null default 0,
  discount numeric not null default 0,
  external_movement_id text,
  reversed_receipt_id uuid references public.revenue_receipts(id),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create or replace function private.set_company_from_receivable()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  select rr.company_id into new.company_id from public.revenue_receivables rr where rr.id = new.receivable_id;
  return new;
end;
$$;

create trigger revenue_receipts_set_company before insert on public.revenue_receipts
  for each row execute function private.set_company_from_receivable();

alter table public.revenue_receipts enable row level security;
create policy revenue_receipts_select on public.revenue_receipts for select
  using (private.has_permission(company_id, 'receitas.read'));
create policy revenue_receipts_insert on public.revenue_receipts for insert
  with check (private.has_permission(company_id, 'receitas.manage'));

------------------------------------------------------------
-- PATRIMONIO V2
------------------------------------------------------------

create table public.asset_models (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  name text not null,
  category text not null default 'OUTRO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger asset_models_set_updated_at before update on public.asset_models
  for each row execute function public.set_updated_at();
create trigger asset_models_company_immutable before update on public.asset_models
  for each row execute function private.guard_company_id_immutable();

alter table public.asset_models enable row level security;
create policy asset_models_select on public.asset_models for select
  using (private.has_permission(company_id, 'patrimonio.read'));
create policy asset_models_insert on public.asset_models for insert
  with check (private.has_permission(company_id, 'patrimonio.manage'));
create policy asset_models_update on public.asset_models for update
  using (private.has_permission(company_id, 'patrimonio.manage'))
  with check (private.has_permission(company_id, 'patrimonio.manage'));

create table public.asset_units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  asset_model_id uuid not null references public.asset_models(id),
  acquisition_value numeric not null,
  managerial_value numeric,
  estimated_current_value numeric,
  acquisition_date date,
  expense_id uuid references public.expenses(id),
  status text not null default 'ATIVO' check (status in ('ATIVO','BAIXADO')),
  current_unit_id uuid references public.units(id),
  current_responsible_id uuid references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.set_company_from_asset_model()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  select m.company_id into new.company_id from public.asset_models m where m.id = new.asset_model_id;
  return new;
end;
$$;

create trigger asset_units_set_company before insert on public.asset_units
  for each row execute function private.set_company_from_asset_model();
create trigger asset_units_set_updated_at before update on public.asset_units
  for each row execute function public.set_updated_at();
create trigger asset_units_company_immutable before update on public.asset_units
  for each row execute function private.guard_company_id_immutable();

alter table public.asset_units enable row level security;
create policy asset_units_select on public.asset_units for select
  using (private.has_permission(company_id, 'patrimonio.read'));
create policy asset_units_insert on public.asset_units for insert
  with check (private.has_permission(company_id, 'patrimonio.manage'));
create policy asset_units_update on public.asset_units for update
  using (private.has_permission(company_id, 'patrimonio.manage'))
  with check (private.has_permission(company_id, 'patrimonio.manage'));

create or replace function private.set_company_from_asset_unit()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  select u.company_id into new.company_id from public.asset_units u where u.id = new.asset_unit_id;
  return new;
end;
$$;

create table public.asset_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  asset_unit_id uuid not null references public.asset_units(id),
  type text not null check (type in (
    'TRANSFERENCIA_LOCAL','ATRIBUIR_RESPONSAVEL','CONSIGNAR','DEVOLVER_CONSIGNACAO',
    'ENVIAR_MANUTENCAO','RETORNAR_MANUTENCAO','BAIXAR','AJUSTE_INVENTARIO'
  )),
  from_unit_id uuid references public.units(id),
  to_unit_id uuid references public.units(id),
  responsible_employee_id uuid references public.employees(id),
  notes text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create trigger asset_movements_set_company before insert on public.asset_movements
  for each row execute function private.set_company_from_asset_unit();

alter table public.asset_movements enable row level security;
create policy asset_movements_select on public.asset_movements for select
  using (private.has_permission(company_id, 'patrimonio.read'));
create policy asset_movements_insert on public.asset_movements for insert
  with check (private.has_permission(company_id, 'patrimonio.manage'));

create table public.asset_consignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  asset_unit_id uuid not null references public.asset_units(id),
  customer_id uuid not null references public.customers(id),
  consigned_at timestamptz not null default now(),
  returned_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid()
);

create unique index asset_consignments_one_active_per_unit
  on public.asset_consignments (asset_unit_id) where is_active;

create trigger asset_consignments_set_company before insert on public.asset_consignments
  for each row execute function private.set_company_from_asset_unit();

alter table public.asset_consignments enable row level security;
create policy asset_consignments_select on public.asset_consignments for select
  using (private.has_permission(company_id, 'patrimonio.read'));
create policy asset_consignments_insert on public.asset_consignments for insert
  with check (private.has_permission(company_id, 'patrimonio.manage'));
create policy asset_consignments_update on public.asset_consignments for update
  using (private.has_permission(company_id, 'patrimonio.manage'))
  with check (private.has_permission(company_id, 'patrimonio.manage'));

create table public.asset_inventory_checks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  asset_unit_id uuid not null references public.asset_units(id),
  result text not null check (result in ('ENCONTRADO','NAO_ENCONTRADO','DIVERGENCIA_LOCAL','DANIFICADO')),
  notes text,
  checked_by uuid not null default auth.uid(),
  checked_at timestamptz not null default now()
);

create trigger asset_inventory_checks_set_company before insert on public.asset_inventory_checks
  for each row execute function private.set_company_from_asset_unit();

alter table public.asset_inventory_checks enable row level security;
create policy asset_inventory_checks_select on public.asset_inventory_checks for select
  using (private.has_permission(company_id, 'patrimonio.read'));
create policy asset_inventory_checks_insert on public.asset_inventory_checks for insert
  with check (private.has_permission(company_id, 'patrimonio.manage'));

------------------------------------------------------------
-- PERMISSOES
------------------------------------------------------------

insert into public.permissions (key, name, description, sensitivity) values
  ('aportes.read', 'Consultar aportes de sócios', 'Ver aportes, sócios e relatórios', 'SENSITIVE'),
  ('aportes.manage', 'Gerenciar aportes de sócios', 'Registrar, conciliar, cancelar e estornar aportes', 'CRITICAL'),
  ('despesas.read', 'Consultar despesas', 'Ver despesas, salários e vales', 'SENSITIVE'),
  ('despesas.manage', 'Gerenciar despesas', 'Lançar despesas, salários e vales', 'CRITICAL'),
  ('receitas.read', 'Consultar receitas', 'Ver receitas e recebíveis', 'SENSITIVE'),
  ('receitas.manage', 'Gerenciar receitas', 'Lançar receitas, registrar e estornar recebimentos', 'CRITICAL'),
  ('patrimonio.read', 'Consultar patrimônio', 'Ver bens, movimentações e inventário', 'NORMAL'),
  ('patrimonio.manage', 'Gerenciar patrimônio', 'Cadastrar bens, movimentar, consignar e dar baixa', 'SENSITIVE');

insert into public.role_permissions (company_id, role_id, permission_key)
select r.company_id, r.id, p.key
from public.roles r
cross join (values
  ('aportes.read'), ('aportes.manage'),
  ('despesas.read'), ('despesas.manage'),
  ('receitas.read'), ('receitas.manage'),
  ('patrimonio.read'), ('patrimonio.manage')
) as p(key);
;
