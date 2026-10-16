-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002185639 · md5 normalizado 4c26135b7c0a085e1ab015d153f83a8c · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Pacote "Compras e Despesas V3": categorias configuráveis com rateio, catálogo de itens genérico
-- (para asset/expense/partner — stock usa raw_materials real, salary usa employees real),
-- e cadastro de recorrência por contrato/compromisso.

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null,
  kind text not null check (kind in ('stock','asset','expense','partner')),
  rateable boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, kind, name)
);

alter table public.expense_categories enable row level security;
create policy expense_categories_select on public.expense_categories for select using (private.has_permission(company_id, 'despesas.read'));
create policy expense_categories_insert on public.expense_categories for insert with check (private.has_permission(company_id, 'despesas.manage'));
create policy expense_categories_update on public.expense_categories for update using (private.has_permission(company_id, 'despesas.manage')) with check (private.has_permission(company_id, 'despesas.manage'));

create table public.expense_catalog_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null,
  code text not null,
  category_id uuid references public.expense_categories(id),
  kind text not null check (kind in ('asset','expense','partner')),
  unit text not null default 'un',
  suggested_price numeric not null default 0,
  suggest_recurring boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.expense_catalog_items enable row level security;
create policy expense_catalog_items_select on public.expense_catalog_items for select using (private.has_permission(company_id, 'despesas.read'));
create policy expense_catalog_items_insert on public.expense_catalog_items for insert with check (private.has_permission(company_id, 'despesas.manage'));

create table public.expense_recurrences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  kind text not null check (kind in ('stock','asset','expense','partner')),
  party_type text not null check (party_type in ('supplier','partner','other')),
  party_name text not null,
  supplier_id uuid references public.suppliers(id),
  partner_id uuid references public.company_partners(id),
  raw_material_id uuid references public.raw_materials(id),
  catalog_item_id uuid references public.expense_catalog_items(id),
  contract_label text not null,
  amount numeric not null default 0,
  rateable boolean not null default false,
  frequency text not null check (frequency in ('weekly','monthly','yearly','custom')),
  interval_days integer,
  day_of_month integer,
  start_date date not null,
  end_mode text not null default 'none' check (end_mode in ('none','date','count')),
  end_date date,
  occurrences integer,
  variable_amount boolean not null default false,
  reference_expense_id uuid references public.expenses(id),
  status text not null default 'ATIVA' check (status in ('ATIVA','PAUSADA','ENCERRADA')),
  first_launch_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create unique index expense_recurrences_commitment_idx on public.expense_recurrences (
  company_id, kind, party_name, contract_label,
  coalesce(raw_material_id, catalog_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

alter table public.expense_recurrences enable row level security;
create policy expense_recurrences_select on public.expense_recurrences for select using (private.has_permission(company_id, 'despesas.read'));
create policy expense_recurrences_insert on public.expense_recurrences for insert with check (private.has_permission(company_id, 'despesas.manage'));
create policy expense_recurrences_update on public.expense_recurrences for update using (private.has_permission(company_id, 'despesas.manage')) with check (private.has_permission(company_id, 'despesas.manage'));

-- Apuração salarial com ajustes (extras/descontos) — hoje salary_obligations só tinha base_salary.
alter table public.salary_obligations
  add column additions numeric not null default 0,
  add column deductions numeric not null default 0,
  add column net_amount numeric;

update public.salary_obligations set net_amount = base_salary where net_amount is null;
alter table public.salary_obligations alter column net_amount set not null;
comment on column public.salary_obligations.net_amount is 'base_salary + additions - deductions - adiantamentos já pagos, calculado na apuração (HTML V3 salaryPreview)';
;
