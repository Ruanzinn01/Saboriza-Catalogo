-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260928215639 · md5 normalizado 30f1b90614e153a25a9cab994043e504 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
begin;

create table if not exists public.urgent_demands (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  unit_id uuid references public.units(id),
  product_id uuid not null references public.products(id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  total_quantity integer not null check (total_quantity > 0),
  done_quantity integer not null default 0 check (done_quantity >= 0),
  status text not null default 'ATIVO' check (status in ('ATIVO','CONCLUIDO','CANCELADO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, product_id) references public.products(company_id, id)
);
create index if not exists urgent_demands_company_idx on public.urgent_demands(company_id, status);

alter table public.production_records
  add column if not exists urgent_demand_id uuid references public.urgent_demands(id),
  add column if not exists urgent_allocated_units integer not null default 0 check (urgent_allocated_units >= 0);
alter table public.production_records add constraint production_records_urgent_company_fkey
  foreign key (company_id, urgent_demand_id) references public.urgent_demands(company_id, id);

create table if not exists public.production_diaries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  unit_id uuid references public.units(id),
  local_date date not null,
  status text not null default 'EM_ANDAMENTO' check (status in ('EM_ANDAMENTO','CONCLUIDO')),
  general_note text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, local_date)
);
create index if not exists production_diaries_company_idx on public.production_diaries(company_id, local_date);

create table if not exists public.diary_evaluations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  diary_id uuid not null references public.production_diaries(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  pace_grade text not null,
  quality_grade text not null,
  commitment_grade text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (diary_id, employee_id),
  foreign key (company_id, diary_id) references public.production_diaries(company_id, id),
  foreign key (company_id, employee_id) references public.employees(company_id, id)
);

create table if not exists public.diary_occurrences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  diary_id uuid not null references public.production_diaries(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  occurrence_type text not null check (occurrence_type in ('Destaque positivo','Atenção','Operacional')),
  description text not null,
  created_at timestamptz not null default now(),
  foreign key (company_id, diary_id) references public.production_diaries(company_id, id),
  foreign key (company_id, employee_id) references public.employees(company_id, id)
);

create table if not exists public.diary_other_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  diary_id uuid not null references public.production_diaries(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  activity text not null,
  period text,
  created_at timestamptz not null default now(),
  foreign key (company_id, diary_id) references public.production_diaries(company_id, id),
  foreign key (company_id, employee_id) references public.employees(company_id, id)
);

do $$
declare t text;
begin
  foreach t in array array['urgent_demands','production_diaries','diary_evaluations','diary_occurrences','diary_other_activities']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format($p$create policy %I_select on public.%I for select to authenticated using ((select private.is_active_company_member(company_id)))$p$, t, t);
    execute format($p$create policy %I_insert on public.%I for insert to authenticated with check ((select private.is_active_company_member(company_id)))$p$, t, t);
    execute format($p$create policy %I_update on public.%I for update to authenticated using ((select private.is_active_company_member(company_id))) with check ((select private.is_active_company_member(company_id)))$p$, t, t);
    execute format($p$create policy %I_delete on public.%I for delete to authenticated using ((select private.is_active_company_member(company_id)))$p$, t, t);
  end loop;
end $$;

create or replace function public.create_production(
  p_product_id uuid,
  p_packs_quantity integer,
  p_employee_ids uuid[] default null,
  p_urgent_demand_id uuid default null
)
returns production_records
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_product public.products;
  v_units_quantity integer;
  v_record public.production_records;
  v_recipe record;
  v_needed numeric;
  v_consumed numeric;
  v_material public.raw_materials;
  v_participant_count integer;
  v_base_units integer;
  v_remainder integer;
  v_employee_id uuid;
  v_idx integer := 0;
  v_urgent public.urgent_demands;
  v_allocated integer := 0;
begin
  if p_packs_quantity is null or p_packs_quantity <= 0 then
    raise exception 'Quantidade de packs deve ser maior que zero';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Produto não encontrado';
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

  insert into public.production_records (product_id, packs_quantity, units_quantity, urgent_demand_id, urgent_allocated_units)
    values (p_product_id, p_packs_quantity, v_units_quantity, p_urgent_demand_id, v_allocated)
    returning * into v_record;

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

  if p_employee_ids is not null and array_length(p_employee_ids, 1) > 0 then
    v_participant_count := array_length(p_employee_ids, 1);
    v_base_units := v_units_quantity / v_participant_count;
    v_remainder := v_units_quantity % v_participant_count;

    foreach v_employee_id in array p_employee_ids
    loop
      v_idx := v_idx + 1;
      insert into public.production_participants (
        company_id, production_record_id, employee_id, allocated_units
      ) values (
        v_record.company_id, v_record.id, v_employee_id,
        v_base_units + case when v_idx <= v_remainder then 1 else 0 end
      );
    end loop;
  end if;

  return v_record;
end;
$function$;

create or replace function public.reverse_production(p_production_id uuid, p_reason text)
returns production_records
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_record public.production_records;
  v_consumption record;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Motivo do estorno é obrigatório';
  end if;

  select * into v_record from public.production_records where id = p_production_id for update;
  if not found then raise exception 'Produção não encontrada'; end if;
  if v_record.status = 'reversed' then raise exception 'Produção já estornada'; end if;

  update public.products set current_stock = greatest(current_stock - v_record.units_quantity, 0) where id = v_record.product_id;
  insert into public.stock_movements (product_id, variation, origin, reference_id, previous_balance, new_balance, observation)
  select v_record.product_id, -v_record.units_quantity, 'adjustment', v_record.id, p.current_stock + v_record.units_quantity, p.current_stock,
    'Estorno de produção — ' || p_reason
  from public.products p where p.id = v_record.product_id;

  for v_consumption in select * from public.production_consumptions where production_record_id = p_production_id loop
    update public.raw_materials set current_stock = current_stock + v_consumption.consumed_quantity where id = v_consumption.raw_material_id;
  end loop;

  if v_record.urgent_demand_id is not null then
    update public.urgent_demands
      set done_quantity = greatest(done_quantity - v_record.urgent_allocated_units, 0), status = 'ATIVO'
      where id = v_record.urgent_demand_id;
  end if;

  update public.production_records set status = 'reversed' where id = p_production_id returning * into v_record;
  return v_record;
end;
$function$;

commit;
;
