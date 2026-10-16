-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260917141436 · md5 normalizado 2ec9ed33dfbc0309c45835361e30f33a · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- Fase 2 · Produção: ficha técnica, registro de produção e consumo automático

alter table public.products
  add column current_stock numeric not null default 0 check (current_stock >= 0);

create table public.product_recipe (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  raw_material_id uuid not null references public.raw_materials(id),
  quantity_per_unit numeric not null check (quantity_per_unit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, raw_material_id)
);

create trigger product_recipe_set_updated_at
  before update on public.product_recipe
  for each row execute function public.set_updated_at();

alter table public.product_recipe enable row level security;

create policy product_recipe_admin_select_all on public.product_recipe
  for select to authenticated using (true);
create policy product_recipe_admin_insert on public.product_recipe
  for insert to authenticated with check (true);
create policy product_recipe_admin_update on public.product_recipe
  for update to authenticated using (true) with check (true);
create policy product_recipe_admin_delete on public.product_recipe
  for delete to authenticated using (true);

create table public.production_records (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  packs_quantity integer not null check (packs_quantity > 0),
  units_quantity integer not null check (units_quantity > 0),
  status text not null default 'confirmed',
  responsible_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger production_records_set_updated_at
  before update on public.production_records
  for each row execute function public.set_updated_at();

alter table public.production_records enable row level security;

create policy production_records_admin_select_all on public.production_records
  for select to authenticated using (true);
create policy production_records_admin_insert on public.production_records
  for insert to authenticated with check (true);

create table public.production_consumptions (
  id uuid primary key default gen_random_uuid(),
  production_record_id uuid not null references public.production_records(id),
  raw_material_id uuid not null references public.raw_materials(id),
  needed_quantity numeric not null,
  consumed_quantity numeric not null,
  previous_balance numeric not null,
  new_balance numeric not null,
  created_at timestamptz not null default now()
);

alter table public.production_consumptions enable row level security;

create policy production_consumptions_admin_select_all on public.production_consumptions
  for select to authenticated using (true);
create policy production_consumptions_admin_insert on public.production_consumptions
  for insert to authenticated with check (true);

-- Confirmação atômica: consome componentes (baixa até zero, nunca negativo) e lança produto acabado

create or replace function public.create_production(p_product_id uuid, p_packs_quantity integer)
returns public.production_records
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

  return v_record;
end;
$$;

revoke execute on function public.create_production(uuid, integer) from public, anon;
grant execute on function public.create_production(uuid, integer) to authenticated;
;
