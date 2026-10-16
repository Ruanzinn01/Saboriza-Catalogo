-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260917120239 · md5 normalizado 9f050e40e1af6282c10fe6eb1aa68ee4 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- Fase 1 · Base de insumos: cadastro de matérias-primas, entradas e custo médio

create sequence if not exists raw_materials_code_seq;

create table public.raw_materials (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default '',
  name text not null,
  description text not null default '',
  category text not null default '',
  control_unit text not null check (control_unit in ('kg', 'g', 'L', 'mL', 'un')),
  image_url text not null default '',
  purchase_unit_label text not null default '',
  purchase_unit_factor numeric not null default 1 check (purchase_unit_factor > 0),
  min_stock numeric not null default 0 check (min_stock >= 0),
  max_stock numeric not null default 0 check (max_stock >= 0),
  current_stock numeric not null default 0 check (current_stock >= 0),
  avg_cost numeric not null default 0 check (avg_cost >= 0),
  primary_supplier_id uuid references public.suppliers(id),
  is_active boolean not null default true,
  unit_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger raw_materials_set_updated_at
  before update on public.raw_materials
  for each row execute function public.set_updated_at();

create or replace function public.set_raw_material_code()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'MTP-' || lpad(nextval('raw_materials_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger raw_materials_set_code
  before insert on public.raw_materials
  for each row execute function public.set_raw_material_code();

create or replace function public.lock_raw_material_control_unit()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.unit_locked and new.control_unit <> old.control_unit then
    raise exception 'Unidade de controle travada após a primeira movimentação';
  end if;
  return new;
end;
$$;

create trigger raw_materials_lock_control_unit
  before update on public.raw_materials
  for each row execute function public.lock_raw_material_control_unit();

alter table public.raw_materials enable row level security;

create policy raw_materials_admin_select_all on public.raw_materials
  for select to authenticated using (true);
create policy raw_materials_admin_insert on public.raw_materials
  for insert to authenticated with check (true);
create policy raw_materials_admin_update on public.raw_materials
  for update to authenticated using (true) with check (true);
create policy raw_materials_admin_delete on public.raw_materials
  for delete to authenticated using (true);

-- Entradas de matéria-prima

create table public.raw_material_entries (
  id uuid primary key default gen_random_uuid(),
  raw_material_id uuid not null references public.raw_materials(id),
  supplier_id uuid not null references public.suppliers(id),
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'reversed')),
  packages_quantity numeric not null check (packages_quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  conversion_factor numeric,
  control_quantity numeric,
  total_value numeric,
  batch text not null,
  expiry_date date not null,
  entry_date date not null default current_date,
  invoice_number text not null default '',
  invoice_series text not null default '',
  invoice_issue_date date,
  invoice_access_key text not null default '',
  responsible_id uuid references auth.users(id) default auth.uid(),
  previous_balance numeric,
  new_balance numeric,
  reversal_reason text,
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger raw_material_entries_set_updated_at
  before update on public.raw_material_entries
  for each row execute function public.set_updated_at();

alter table public.raw_material_entries enable row level security;

create policy raw_material_entries_admin_select_all on public.raw_material_entries
  for select to authenticated using (true);
create policy raw_material_entries_admin_insert on public.raw_material_entries
  for insert to authenticated with check (true);
create policy raw_material_entries_admin_update on public.raw_material_entries
  for update to authenticated using (true) with check (true);

-- Confirmação: efetiva a entrada, recalcula saldo e custo médio ponderado

create or replace function public.confirm_raw_material_entry(p_entry_id uuid)
returns public.raw_material_entries
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_entry public.raw_material_entries;
  v_material public.raw_materials;
  v_control_quantity numeric;
  v_total_value numeric;
  v_new_balance numeric;
  v_new_avg_cost numeric;
begin
  select * into v_entry from public.raw_material_entries where id = p_entry_id for update;
  if not found then
    raise exception 'Entrada não encontrada';
  end if;
  if v_entry.status <> 'draft' then
    raise exception 'Somente rascunhos podem ser confirmados';
  end if;

  select * into v_material from public.raw_materials where id = v_entry.raw_material_id for update;

  v_control_quantity := v_entry.packages_quantity * v_material.purchase_unit_factor;
  v_total_value := v_entry.packages_quantity * v_entry.unit_price;
  v_new_balance := v_material.current_stock + v_control_quantity;
  v_new_avg_cost := ((v_material.current_stock * v_material.avg_cost) + v_total_value) / v_new_balance;

  update public.raw_materials
    set current_stock = v_new_balance,
        avg_cost = v_new_avg_cost,
        unit_locked = true
    where id = v_material.id;

  update public.raw_material_entries
    set status = 'confirmed',
        conversion_factor = v_material.purchase_unit_factor,
        control_quantity = v_control_quantity,
        total_value = v_total_value,
        previous_balance = v_material.current_stock,
        new_balance = v_new_balance
    where id = p_entry_id
    returning * into v_entry;

  return v_entry;
end;
$$;

-- Estorno: nunca apaga, reverte saldo e custo médio com motivo obrigatório

create or replace function public.reverse_raw_material_entry(p_entry_id uuid, p_reason text)
returns public.raw_material_entries
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_entry public.raw_material_entries;
  v_material public.raw_materials;
  v_new_balance numeric;
  v_new_avg_cost numeric;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Motivo do estorno é obrigatório';
  end if;

  select * into v_entry from public.raw_material_entries where id = p_entry_id for update;
  if not found then
    raise exception 'Entrada não encontrada';
  end if;
  if v_entry.status <> 'confirmed' then
    raise exception 'Somente entradas confirmadas podem ser estornadas';
  end if;

  select * into v_material from public.raw_materials where id = v_entry.raw_material_id for update;

  v_new_balance := v_material.current_stock - v_entry.control_quantity;
  if v_new_balance < 0 then
    raise exception 'Estoque insuficiente para estornar esta entrada';
  end if;

  if v_new_balance = 0 then
    v_new_avg_cost := 0;
  else
    v_new_avg_cost := ((v_material.current_stock * v_material.avg_cost) - v_entry.total_value) / v_new_balance;
  end if;

  update public.raw_materials
    set current_stock = v_new_balance,
        avg_cost = v_new_avg_cost
    where id = v_material.id;

  update public.raw_material_entries
    set status = 'reversed',
        reversed_at = now(),
        reversed_by = auth.uid(),
        reversal_reason = p_reason
    where id = p_entry_id
    returning * into v_entry;

  return v_entry;
end;
$$;
;
