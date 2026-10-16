-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260918223014 · md5 normalizado c194421aa1207241ece4b7a26ed9444a · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Tarefa 3.1: estrutura central de movimentação de estoque de produto acabado
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  variation numeric not null,
  origin text not null check (origin in ('production', 'entry', 'order', 'adjustment')),
  reference_id uuid,
  responsible_id uuid references auth.users(id) default auth.uid(),
  observation text not null default '',
  previous_balance numeric not null,
  new_balance numeric not null,
  created_at timestamptz not null default now()
);

alter table public.stock_movements enable row level security;

create policy "stock_movements_select_authenticated" on public.stock_movements
  for select to authenticated using (true);
create policy "stock_movements_insert_authenticated" on public.stock_movements
  for insert to authenticated with check (true);

create index if not exists stock_movements_product_id_idx on public.stock_movements(product_id, created_at desc);

-- Campo de estoque mínimo no cadastro de produto (Tarefa 3.1)
alter table public.products add column if not exists min_stock numeric not null default 0 check (min_stock >= 0);

-- Retrofit: create_production passa a registrar a movimentação central,
-- em vez de só atualizar current_stock direto (fim do estoque paralelo)
create or replace function public.create_production(p_product_id uuid, p_packs_quantity integer)
returns public.production_records
language plpgsql
security definer
set search_path = public
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

  insert into public.stock_movements (
    product_id, variation, origin, reference_id, previous_balance, new_balance, observation
  ) values (
    p_product_id, v_units_quantity, 'production', v_record.id, v_product.current_stock, v_product.current_stock + v_units_quantity, ''
  );

  return v_record;
end;
$$;

-- Tarefa 3.6: entrada manual de estoque de produto acabado
create or replace function public.create_stock_entry(p_product_id uuid, p_quantity numeric, p_observation text default '')
returns public.stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products;
  v_movement public.stock_movements;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Produto não encontrado';
  end if;

  update public.products
    set current_stock = current_stock + p_quantity
    where id = p_product_id;

  insert into public.stock_movements (
    product_id, variation, origin, previous_balance, new_balance, observation
  ) values (
    p_product_id, p_quantity, 'entry', v_product.current_stock, v_product.current_stock + p_quantity, coalesce(p_observation, '')
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

-- Tarefa 3.5: ajuste de estoque por contagem física
create or replace function public.adjust_stock(p_product_id uuid, p_counted_stock numeric, p_reason text)
returns public.stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products;
  v_diff numeric;
  v_movement public.stock_movements;
begin
  if p_counted_stock is null or p_counted_stock < 0 then
    raise exception 'Estoque contado deve ser zero ou maior';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Motivo é obrigatório';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Produto não encontrado';
  end if;

  v_diff := p_counted_stock - v_product.current_stock;

  update public.products
    set current_stock = p_counted_stock
    where id = p_product_id;

  insert into public.stock_movements (
    product_id, variation, origin, previous_balance, new_balance, observation
  ) values (
    p_product_id, v_diff, 'adjustment', v_product.current_stock, p_counted_stock, coalesce(p_reason, '')
  )
  returning * into v_movement;

  return v_movement;
end;
$$;
;
