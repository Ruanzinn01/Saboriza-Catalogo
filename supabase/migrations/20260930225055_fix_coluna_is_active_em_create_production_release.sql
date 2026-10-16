-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930225055 · md5 normalizado f49c6bb2d80dbfd3cfe42c0c3281072d · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create or replace function public.create_production_release(
  p_product_id uuid,
  p_packs_quantity integer,
  p_reason text default null,
  p_note text default null,
  p_urgent_demand_id uuid default null,
  p_idempotency_key text default null,
  p_plan_id uuid default null
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
  v_route public.production_routes;
  v_plan public.production_plans;
  v_packs integer;
  v_origin text := 'MANUAL';
begin
  if p_idempotency_key is not null then
    select * into v_release from public.production_releases
      where company_id = v_company and idempotency_key = p_idempotency_key;
    if found then
      return v_release;
    end if;
  end if;

  select * into v_product from public.products where id = p_product_id and is_active = true;
  if not found then
    raise exception 'Produto nao encontrado ou inativo';
  end if;

  select * into v_route from public.production_routes
    where product_id = p_product_id and company_id = v_company and status = 'ATIVA';
  if not found then
    raise exception 'Item sem rota de producao ativa - cadastre a rota antes de liberar';
  end if;

  v_packs := p_packs_quantity;

  if p_plan_id is not null then
    select * into v_plan from public.production_plans where id = p_plan_id and company_id = v_company for update;
    if not found or v_plan.status <> 'PENDENTE' or v_plan.product_id <> p_product_id then
      raise exception 'Plano de producao invalido ou ja liberado';
    end if;
    v_packs := v_plan.planned_packs;
    v_origin := 'PLANO';
  end if;

  if v_packs is null or v_packs <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
  end if;

  v_units := v_packs * v_product.pack_quantity;

  insert into public.production_releases (
    product_id, requested_packs, requested_units, reason, note, urgent_demand_id, idempotency_key, origin, production_plan_id
  ) values (
    p_product_id, v_packs, v_units, p_reason, nullif(p_note, ''), p_urgent_demand_id,
    coalesce(p_idempotency_key, gen_random_uuid()::text), v_origin, p_plan_id
  ) returning * into v_release;

  insert into public.floor_executions (
    product_id, production_release_id, target_quantity, route_id, route_version, route_version_label
  ) values (
    p_product_id, v_release.id, v_units, v_route.id, v_route.version, 'v' || v_route.version
  );

  if p_plan_id is not null then
    update public.production_plans set status = 'LIBERADO', production_release_id = v_release.id where id = p_plan_id;
  end if;

  return v_release;
end;
$$;

revoke execute on function public.create_production_release(uuid, integer, text, text, uuid, text, uuid) from public;
grant execute on function public.create_production_release(uuid, integer, text, text, uuid, text, uuid) to authenticated;
