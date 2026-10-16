-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001145055 · md5 normalizado 12a4c1a713ba4e63841112bdd2c3e21e · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

create or replace function public.confirm_production_release(
  p_product_id uuid,
  p_packs_quantity integer,
  p_urgent_demand_id uuid default null::uuid,
  p_floor_execution_id uuid default null::uuid,
  p_idempotency_key text default null::text
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
$function$;
;
