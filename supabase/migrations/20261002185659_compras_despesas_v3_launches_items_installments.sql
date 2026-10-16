-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002185659 · md5 normalizado 65a0a34a66adf8f507a5512199275351 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Cabeçalho do lançamento (nota/fornecedor/condição) + itens (fato econômico, 1 por item do carrinho)
-- + parcelas (financeiro, agregado do lançamento todo — mesmo padrão já usado em billings/installments
-- do módulo Faturar). Cada parcela gera 1 registro em `expenses` (expenses.launch_id), que é quem
-- continua alimentando a Visão Geral/KPIs — não duplicamos a fonte, só agregamos diferente.
create table public.expense_launches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  kind text not null check (kind in ('stock','asset','expense','salary','partner')),
  party_type text not null check (party_type in ('supplier','partner','employee','other')),
  party_name text not null,
  supplier_id uuid references public.suppliers(id),
  partner_id uuid references public.company_partners(id),
  competence date not null,
  document_ref text,
  document_series text,
  document_issue_date date,
  document_access_key text,
  batch text,
  expiry_date date,
  freight numeric not null default 0,
  discount numeric not null default 0,
  total_amount numeric not null default 0,
  received boolean not null default false,
  payment_method text,
  payment_condition text,
  scheduled boolean not null default false,
  recipient_key text,
  recipient_holder text,
  observations text,
  status text not null default 'ABERTO' check (status in ('ABERTO','RASCUNHO')),
  duplicate_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.expense_launches enable row level security;
create policy expense_launches_select on public.expense_launches for select using (private.has_permission(company_id, 'despesas.read'));
create policy expense_launches_insert on public.expense_launches for insert with check (private.has_permission(company_id, 'despesas.manage'));

create table public.expense_launch_items (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references public.expense_launches(id) on delete cascade,
  kind text not null check (kind in ('stock','asset','expense','salary','partner')),
  category_id uuid references public.expense_categories(id),
  raw_material_id uuid references public.raw_materials(id),
  catalog_item_id uuid references public.expense_catalog_items(id),
  employee_id uuid references public.employees(id),
  name_snapshot text not null,
  unit text not null default 'un',
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  amount numeric not null default 0,
  rateable boolean not null default false,
  contract_label text,
  payroll_type text check (payroll_type in ('salary','advance')),
  reference_expense_id uuid references public.expenses(id),
  recurrence_id uuid references public.expense_recurrences(id),
  expense_id uuid references public.expenses(id),
  created_at timestamptz not null default now()
);

create index expense_launch_items_launch_idx on public.expense_launch_items(launch_id);
alter table public.expense_launch_items enable row level security;
create policy expense_launch_items_select on public.expense_launch_items for select using (
  exists (select 1 from public.expense_launches l where l.id = launch_id and private.has_permission(l.company_id, 'despesas.read'))
);
create policy expense_launch_items_insert on public.expense_launch_items for insert with check (
  exists (select 1 from public.expense_launches l where l.id = launch_id and private.has_permission(l.company_id, 'despesas.manage'))
);

create table public.expense_launch_installments (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references public.expense_launches(id) on delete cascade,
  number integer not null,
  amount numeric not null,
  due_date date not null,
  scheduled_payment_at date,
  boleto_code text,
  expense_id uuid references public.expenses(id),
  created_at timestamptz not null default now()
);

create index expense_launch_installments_launch_idx on public.expense_launch_installments(launch_id);
alter table public.expense_launch_installments enable row level security;
create policy expense_launch_installments_select on public.expense_launch_installments for select using (
  exists (select 1 from public.expense_launches l where l.id = launch_id and private.has_permission(l.company_id, 'despesas.read'))
);
create policy expense_launch_installments_insert on public.expense_launch_installments for insert with check (
  exists (select 1 from public.expense_launches l where l.id = launch_id and private.has_permission(l.company_id, 'despesas.manage'))
);

alter table public.expenses add column launch_id uuid references public.expense_launches(id);
create index expenses_launch_idx on public.expenses(launch_id) where launch_id is not null;
;
