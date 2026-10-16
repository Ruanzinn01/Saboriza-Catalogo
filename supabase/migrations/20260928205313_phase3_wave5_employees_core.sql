-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260928205313 · md5 normalizado ebed769681056e6a753e2a24320744ed · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- ÓRIS360 — Onda 4 (recorte V1) — Colaboradores (núcleo) + Produziu Registra ganha "Produzido por".
begin;

create sequence if not exists public.employees_code_seq;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  unit_id uuid references public.units(id),
  code text not null default '',
  name text not null check (btrim(name) <> ''),
  cpf text,
  phone text,
  email text,
  photo_url text,
  birth_date date check (birth_date is null or birth_date <= current_date),
  role text,
  department text,
  admission_date date,
  status text not null default 'ATIVO' check (status in ('ATIVO','INATIVO')),
  termination_date date,
  termination_reason text,
  can_operate_production boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, cpf),
  unique (company_id, id),
  check (termination_date is null or admission_date is null or termination_date >= admission_date)
);

create or replace function public.set_employee_code()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.code is null or new.code = '' then
    new.code := 'COL-' || lpad(nextval('public.employees_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_set_employee_code on public.employees;
create trigger trg_set_employee_code before insert on public.employees
  for each row execute function public.set_employee_code();

create index if not exists employees_company_idx on public.employees(company_id, status);
alter table public.employees add constraint employees_unit_company_fkey
  foreign key (company_id, unit_id) references public.units(company_id, id);

create trigger employees_company_immutable before update on public.employees
  for each row execute function private.guard_company_id_immutable();
create trigger employees_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

alter table public.employees enable row level security;
revoke all on public.employees from anon;
grant select, insert, update, delete on public.employees to authenticated;

create policy employees_select on public.employees for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy employees_insert on public.employees for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));
create policy employees_update on public.employees for update to authenticated
  using ((select private.is_active_company_member(company_id)))
  with check ((select private.is_active_company_member(company_id)));
create policy employees_delete on public.employees for delete to authenticated
  using ((select private.is_active_company_member(company_id)));

create table if not exists public.production_participants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  production_record_id uuid not null references public.production_records(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  allocated_units integer not null check (allocated_units > 0),
  created_at timestamptz not null default now(),
  unique (production_record_id, employee_id),
  foreign key (company_id, production_record_id) references public.production_records(company_id, id),
  foreign key (company_id, employee_id) references public.employees(company_id, id)
);
create index if not exists production_participants_company_idx on public.production_participants(company_id);

alter table public.production_participants enable row level security;
revoke all on public.production_participants from anon;
grant select, insert on public.production_participants to authenticated;

create policy production_participants_select on public.production_participants for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy production_participants_insert on public.production_participants for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));

create or replace function public.create_production(
  p_product_id uuid,
  p_packs_quantity integer,
  p_employee_ids uuid[] default null
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
begin
  if p_packs_quantity is null or p_packs_quantity <= 0 then
    raise exception 'Quantidade de packs deve ser maior que zero';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Produto não encontrado';
  end if;

  v_units_quantity := p_packs_quantity * v_product.pack_quantity;

  insert into public.production_records (product_id, packs_quantity, units_quantity)
    values (p_product_id, p_packs_quantity, v_units_quantity)
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

commit;
;
