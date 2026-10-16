-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930184628 · md5 normalizado 05a9fa8a75cb22b994218bdbc7f00fb1 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- ============================================================
-- Bloco de Producao: Liberar Producao + Chao de Fabrica V10 (MVP)
-- + Produziu Registra V4 R2 (confirmacao sem participantes/rateio)
-- Nao mexe em production_records/production_participants/production_consumptions
-- historicos da V3 (leitura preservada).
-- ============================================================

-- 1) Liberar Producao: efeito de estoque = ZERO
create table public.production_releases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  unit_id uuid not null default private.default_unit_id(),
  product_id uuid not null references public.products(id),
  requested_packs integer not null check (requested_packs > 0),
  requested_units integer not null check (requested_units > 0),
  reason text,
  note text,
  urgent_demand_id uuid references public.urgent_demands(id),
  origin text not null default 'MANUAL' check (origin in ('MANUAL','PLANO')),
  created_by_user_id uuid default auth.uid(),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (company_id, idempotency_key)
);

alter table public.production_releases enable row level security;

create policy production_releases_select on public.production_releases
  for select using (private.is_active_company_member(company_id));
create policy production_releases_insert on public.production_releases
  for insert with check (private.is_active_company_member(company_id));

-- 2) Chao de Fabrica V10 (MVP): execucao/contexto, sem efeito de estoque
create table public.floor_executions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  unit_id uuid not null default private.default_unit_id(),
  product_id uuid not null references public.products(id),
  production_release_id uuid references public.production_releases(id),
  route_version_label text not null default 'v1',
  status text not null default 'DISPONIVEL' check (status in ('DISPONIVEL','EM_ANDAMENTO','PAUSADO','CONCLUIDO','CANCELADO')),
  target_quantity integer not null check (target_quantity > 0),
  operational_quantity integer not null default 0 check (operational_quantity >= 0),
  assumed_by_employee_id uuid references public.employees(id),
  assumed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  production_record_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.floor_executions enable row level security;

create policy floor_executions_select on public.floor_executions
  for select using (private.is_active_company_member(company_id));

create table public.floor_execution_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  floor_execution_id uuid not null references public.floor_executions(id),
  employee_id uuid references public.employees(id),
  event_type text not null check (event_type in ('ASSUMIU','INICIOU','PAUSOU','RETOMOU','AVANCOU','CONCLUIU','CANCELOU')),
  quantity_delta integer,
  note text,
  created_at timestamptz not null default now()
);

alter table public.floor_execution_events enable row level security;

create policy floor_execution_events_select on public.floor_execution_events
  for select using (private.is_active_company_member(company_id));

create index idx_floor_executions_company_status on public.floor_executions(company_id, status);
create index idx_floor_execution_events_execution on public.floor_execution_events(floor_execution_id, created_at);

-- 3) Produziu Registra V4 R2: confirmacao oficial sem participantes/rateio,
--    com idempotencia e vinculo opcional ao Chao de Fabrica.
alter table public.production_records
  add column floor_execution_id uuid references public.floor_executions(id),
  add column idempotency_key text;

create unique index uq_production_records_company_idempotency
  on public.production_records(company_id, idempotency_key)
  where idempotency_key is not null;

-- 4) RPC: criar liberacao (zero estoque) + abre execucao no Chao automaticamente
create or replace function public.create_production_release(
  p_product_id uuid,
  p_packs_quantity integer,
  p_reason text,
  p_note text,
  p_urgent_demand_id uuid,
  p_idempotency_key text
) returns public.production_releases
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_product public.products;
  v_units integer;
  v_release public.production_releases;
  v_company uuid := private.default_company_id();
begin
  select * into v_release from public.production_releases
    where company_id = v_company and idempotency_key = p_idempotency_key;
  if found then
    return v_release;
  end if;

  if p_packs_quantity is null or p_packs_quantity <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
  end if;

  select * into v_product from public.products where id = p_product_id and active = true;
  if not found then
    raise exception 'Produto nao encontrado ou inativo';
  end if;

  v_units := p_packs_quantity * v_product.pack_quantity;

  insert into public.production_releases (
    product_id, requested_packs, requested_units, reason, note, urgent_demand_id, idempotency_key
  ) values (
    p_product_id, p_packs_quantity, v_units, p_reason, nullif(p_note, ''), p_urgent_demand_id, p_idempotency_key
  ) returning * into v_release;

  insert into public.floor_executions (
    product_id, production_release_id, target_quantity
  ) values (
    p_product_id, v_release.id, v_units
  );

  return v_release;
end;
$$;

-- 5) RPC: assumir execucao no Chao (atomica, evita duas pessoas assumirem a mesma)
create or replace function public.floor_assume_execution(
  p_floor_execution_id uuid,
  p_employee_id uuid
) returns public.floor_executions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_exec public.floor_executions;
  v_employee public.employees;
begin
  select * into v_employee from public.employees
    where id = p_employee_id and status = 'ATIVO' and can_operate_production = true;
  if not found then
    raise exception 'Colaborador nao habilitado para producao';
  end if;

  update public.floor_executions
    set status = 'EM_ANDAMENTO',
        assumed_by_employee_id = p_employee_id,
        assumed_at = now(),
        started_at = now(),
        updated_at = now()
    where id = p_floor_execution_id and status = 'DISPONIVEL'
    returning * into v_exec;

  if not found then
    raise exception 'Execucao indisponivel (ja assumida ou concluida)';
  end if;

  insert into public.floor_execution_events (floor_execution_id, employee_id, event_type)
    values (p_floor_execution_id, p_employee_id, 'ASSUMIU');
  insert into public.floor_execution_events (floor_execution_id, employee_id, event_type)
    values (p_floor_execution_id, p_employee_id, 'INICIOU');

  return v_exec;
end;
$$;

-- 6) RPC: avancar quantidade parcial (reconciliacao ponta a ponta)
create or replace function public.floor_advance_quantity(
  p_floor_execution_id uuid,
  p_quantity_delta integer
) returns public.floor_executions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_exec public.floor_executions;
begin
  if p_quantity_delta is null or p_quantity_delta <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
  end if;

  select * into v_exec from public.floor_executions where id = p_floor_execution_id for update;
  if not found or v_exec.status <> 'EM_ANDAMENTO' then
    raise exception 'Execucao nao esta em andamento';
  end if;
  if v_exec.operational_quantity + p_quantity_delta > v_exec.target_quantity then
    raise exception 'Quantidade excede o alvo da liberacao';
  end if;

  update public.floor_executions
    set operational_quantity = operational_quantity + p_quantity_delta,
        updated_at = now()
    where id = p_floor_execution_id
    returning * into v_exec;

  insert into public.floor_execution_events (floor_execution_id, employee_id, event_type, quantity_delta)
    values (p_floor_execution_id, v_exec.assumed_by_employee_id, 'AVANCOU', p_quantity_delta);

  return v_exec;
end;
$$;

-- 7) RPC: concluir execucao operacionalmente (NAO mexe em estoque)
create or replace function public.floor_complete_execution(
  p_floor_execution_id uuid
) returns public.floor_executions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_exec public.floor_executions;
  v_changed boolean := false;
begin
  update public.floor_executions
    set status = 'CONCLUIDO', completed_at = now(), updated_at = now()
    where id = p_floor_execution_id and status in ('EM_ANDAMENTO','PAUSADO')
    returning * into v_exec;

  if found then
    v_changed := true;
  else
    select * into v_exec from public.floor_executions where id = p_floor_execution_id;
    if not found then
      raise exception 'Execucao nao encontrada';
    end if;
  end if;

  if v_changed then
    insert into public.floor_execution_events (floor_execution_id, employee_id, event_type)
      values (p_floor_execution_id, v_exec.assumed_by_employee_id, 'CONCLUIU');
  end if;

  return v_exec;
end;
$$;

-- 8) RPC: confirmacao oficial do produto acabado (V4 R2) - sem participantes/rateio,
--    idempotente, vincula floor_execution opcionalmente, autoridade de estoque preservada.
create or replace function public.confirm_production_release(
  p_product_id uuid,
  p_packs_quantity integer,
  p_urgent_demand_id uuid default null,
  p_floor_execution_id uuid default null,
  p_idempotency_key text default null
) returns public.production_records
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_product public.products;
  v_units_quantity integer;
  v_record public.production_records;
  v_recipe record;
  v_needed numeric;
  v_consumed numeric;
  v_material public.raw_materials;
  v_urgent public.urgent_demands;
  v_allocated integer := 0;
  v_company uuid := private.default_company_id();
  v_exec public.floor_executions;
begin
  if p_idempotency_key is not null then
    select * into v_record from public.production_records
      where company_id = v_company and idempotency_key = p_idempotency_key;
    if found then
      return v_record;
    end if;
  end if;

  if p_packs_quantity is null or p_packs_quantity <= 0 then
    raise exception 'Quantidade de packs deve ser maior que zero';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Produto nao encontrado';
  end if;

  if p_floor_execution_id is not null then
    select * into v_exec from public.floor_executions where id = p_floor_execution_id for update;
    if not found or v_exec.company_id <> v_company then
      raise exception 'Execucao do Chao de Fabrica nao encontrada';
    end if;
    if v_exec.status <> 'CONCLUIDO' then
      raise exception 'Execucao do Chao de Fabrica ainda nao foi concluida';
    end if;
    if v_exec.production_record_id is not null then
      raise exception 'Execucao do Chao de Fabrica ja foi fechada em outro registro';
    end if;
  end if;

  v_units_quantity := p_packs_quantity * v_product.pack_quantity;

  if p_urgent_demand_id is not null then
    select * into v_urgent from public.urgent_demands where id = p_urgent_demand_id for update;
    if found and v_urgent.status = 'ATIVO' and v_urgent.product_id = p_product_id then
      v_allocated := least(v_units_quantity, v_urgent.total_quantity - v_urgent.done_quantity);
      if v_allocated < 0 then v_allocated := 0; end if;
      update public.urgent_demands
        set done_quantity = done_quantity + v_allocated,
            status = case when done_quantity + v_allocated >= total_quantity then 'CONCLUIDO' else status end
        where id = p_urgent_demand_id;
    else
      p_urgent_demand_id := null;
    end if;
  end if;

  insert into public.production_records (
    product_id, packs_quantity, units_quantity, urgent_demand_id, urgent_allocated_units,
    floor_execution_id, idempotency_key
  ) values (
    p_product_id, p_packs_quantity, v_units_quantity, p_urgent_demand_id, v_allocated,
    p_floor_execution_id, p_idempotency_key
  ) returning * into v_record;

  for v_recipe in
    select * from public.product_recipe where product_id = p_product_id
  loop
    select * into v_material from public.raw_materials where id = v_recipe.raw_material_id for update;

    v_needed := v_recipe.quantity_per_unit * v_units_quantity;
    v_consumed := least(v_needed, v_material.current_stock);

    update public.raw_materials
      set current_stock = v_material.current_stock - v_consumed
      where id = v_material.id;

    insert into public.production_consumptions (
      production_record_id, raw_material_id, needed_quantity, consumed_quantity, previous_balance, new_balance
    ) values (
      v_record.id, v_material.id, v_needed, v_consumed, v_material.current_stock, v_material.current_stock - v_consumed
    );
  end loop;

  update public.products
    set current_stock = current_stock + v_units_quantity
    where id = p_product_id;

  insert into public.stock_movements (
    product_id, variation, origin, reference_id, previous_balance, new_balance, observation
  ) values (
    p_product_id, v_units_quantity, 'production', v_record.id, v_product.current_stock, v_product.current_stock + v_units_quantity, ''
  );

  if p_floor_execution_id is not null then
    update public.floor_executions set production_record_id = v_record.id, updated_at = now() where id = p_floor_execution_id;
  end if;

  return v_record;
end;
$$;

-- 9) Realtime: liberar streaming sem F5 para Chao de Fabrica e liberacoes
alter publication supabase_realtime add table public.floor_executions;
alter publication supabase_realtime add table public.production_releases;
alter publication supabase_realtime add table public.floor_execution_events;
;
