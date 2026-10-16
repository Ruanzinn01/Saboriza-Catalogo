-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930180542 · md5 normalizado 76bdf150ad66cc7f467fa5a69ddfd4b5 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

alter table public.orders add column if not exists seller_employee_id uuid references public.employees(id);
alter table public.employees add column if not exists commission_rate_percent numeric;

create table if not exists public.sales_commissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  order_id uuid not null references public.orders(id),
  employee_id uuid not null references public.employees(id),
  receivable_id uuid not null unique references public.receivables(id),
  installment_number int,
  sale_amount numeric not null,
  commission_rate numeric not null,
  commission_amount numeric not null,
  status text not null default 'PREVISTA' check (status in ('PREVISTA', 'REALIZADA')),
  due_date date not null,
  realized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_commissions_company_idx on public.sales_commissions(company_id);
create index if not exists sales_commissions_employee_idx on public.sales_commissions(employee_id);
create index if not exists sales_commissions_order_idx on public.sales_commissions(order_id);

alter table public.sales_commissions enable row level security;

create policy sales_commissions_select on public.sales_commissions
  for select using (private.has_permission(company_id, 'vendas.read'));
create policy sales_commissions_manage on public.sales_commissions
  for all using (private.has_permission(company_id, 'vendas.manage'))
  with check (private.has_permission(company_id, 'vendas.manage'));

create or replace function private.generate_sales_commission()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order_id uuid;
  v_company_id uuid;
  v_employee_id uuid;
  v_rate numeric;
  v_installment_number int;
begin
  select b.order_id into v_order_id from public.billings b where b.id = new.billing_id;
  select o.company_id, o.seller_employee_id into v_company_id, v_employee_id
  from public.orders o where o.id = v_order_id;

  if v_employee_id is null then
    return new;
  end if;

  select e.commission_rate_percent into v_rate from public.employees e where e.id = v_employee_id;
  if v_rate is null or v_rate <= 0 then
    return new;
  end if;

  select i.number into v_installment_number from public.installments i where i.id = new.installment_id;

  insert into public.sales_commissions (
    company_id, order_id, employee_id, receivable_id, installment_number,
    sale_amount, commission_rate, commission_amount, due_date
  ) values (
    v_company_id, v_order_id, v_employee_id, new.id, v_installment_number,
    new.amount, v_rate, round(new.amount * v_rate / 100, 2), new.due_date
  );

  return new;
end;
$function$;

drop trigger if exists trg_generate_sales_commission on public.receivables;
create trigger trg_generate_sales_commission
  after insert on public.receivables
  for each row execute function private.generate_sales_commission();

create or replace function private.sync_sales_commission_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status = 'PAGO' and old.status is distinct from 'PAGO' then
    update public.sales_commissions
    set status = 'REALIZADA', realized_at = now(), updated_at = now()
    where receivable_id = new.id;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_sync_sales_commission_status on public.receivables;
create trigger trg_sync_sales_commission_status
  after update of status on public.receivables
  for each row execute function private.sync_sales_commission_status();

create or replace function public.get_sales_commissions_report(
  p_employee_id uuid default null,
  p_period_start date default null,
  p_period_end date default null
)
returns table (
  commission_id uuid,
  order_id uuid,
  order_number text,
  customer_name text,
  employee_id uuid,
  employee_name text,
  installment_number int,
  sale_amount numeric,
  commission_rate numeric,
  commission_amount numeric,
  status text,
  due_date date,
  realized_at timestamptz
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  return query
  select sc.id, sc.order_id, o.order_number, o.customer_name, sc.employee_id, e.name,
         sc.installment_number, sc.sale_amount, sc.commission_rate, sc.commission_amount,
         sc.status, sc.due_date, sc.realized_at
  from public.sales_commissions sc
  join public.orders o on o.id = sc.order_id
  join public.employees e on e.id = sc.employee_id
  where private.has_permission(sc.company_id, 'vendas.read')
    and (p_employee_id is null or sc.employee_id = p_employee_id)
    and (p_period_start is null or sc.due_date >= p_period_start)
    and (p_period_end is null or sc.due_date <= p_period_end)
  order by sc.due_date desc;
end;
$function$;

create table if not exists public.employee_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.resolve_write_company_id(),
  employee_id uuid not null references public.employees(id),
  title text not null,
  description text,
  due_date date,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')),
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_tasks_company_idx on public.employee_tasks(company_id);
create index if not exists employee_tasks_employee_idx on public.employee_tasks(employee_id);

alter table public.employee_tasks enable row level security;

create policy employee_tasks_select on public.employee_tasks
  for select using (private.has_permission(company_id, 'tarefas.read'));
create policy employee_tasks_insert on public.employee_tasks
  for insert with check (private.has_permission(company_id, 'tarefas.manage'));
create policy employee_tasks_update on public.employee_tasks
  for update using (private.has_permission(company_id, 'tarefas.manage'))
  with check (private.has_permission(company_id, 'tarefas.manage'));
create policy employee_tasks_delete on public.employee_tasks
  for delete using (private.has_permission(company_id, 'tarefas.manage'));

insert into public.permissions (key, name, description, sensitivity)
values
  ('vendas.read', 'Ver comissoes e força de vendas', 'Visualizar relatorios de comissao e vendedores', 'NORMAL'),
  ('vendas.manage', 'Gerenciar força de vendas', 'Definir vendedor do pedido e taxa de comissao', 'SENSITIVE'),
  ('tarefas.read', 'Ver tarefas e missoes', 'Visualizar tarefas atribuidas a colaboradores', 'NORMAL'),
  ('tarefas.manage', 'Gerenciar tarefas e missoes', 'Criar, editar e concluir tarefas de colaboradores', 'NORMAL')
on conflict (key) do nothing;

insert into public.role_permissions (company_id, role_id, permission_key)
select r.company_id, r.id, p.key
from public.roles r
cross join public.permissions p
where p.key in ('vendas.read', 'vendas.manage', 'tarefas.read', 'tarefas.manage')
on conflict do nothing;
;
