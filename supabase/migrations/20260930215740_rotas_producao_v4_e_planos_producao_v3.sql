-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930215740 · md5 normalizado d5fd46408c8ab6a2a534be97dedd9a3e · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- ============================================================
-- Rotas de Producao V4 (versionada, trava no inicio da execucao)
-- ============================================================
create table public.production_routes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  product_id uuid not null references public.products(id),
  version integer not null,
  status text not null default 'ATIVA' check (status in ('ATIVA','ARQUIVADA')),
  created_at timestamptz not null default now()
);

alter table public.production_routes enable row level security;
create policy production_routes_select on public.production_routes
  for select using (private.is_active_company_member(company_id));

create unique index uq_production_routes_active_per_product
  on public.production_routes(company_id, product_id)
  where status = 'ATIVA';

create table public.production_route_stages (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.production_routes(id),
  sequence_order integer not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (route_id, sequence_order)
);

alter table public.production_route_stages enable row level security;
create policy production_route_stages_select on public.production_route_stages
  for select using (
    exists (select 1 from public.production_routes r where r.id = route_id and private.is_active_company_member(r.company_id))
  );

alter table public.floor_executions
  add column route_id uuid references public.production_routes(id),
  add column route_version integer;

-- ============================================================
-- Planos de Producao V3 (liberacao automatica a partir de um plano)
-- ============================================================
create table public.production_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  unit_id uuid not null default private.default_unit_id(),
  product_id uuid not null references public.products(id),
  planned_date date not null,
  planned_packs integer not null check (planned_packs > 0),
  status text not null default 'PENDENTE' check (status in ('PENDENTE','LIBERADO','CANCELADO')),
  production_release_id uuid references public.production_releases(id),
  created_by_user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.production_plans enable row level security;
create policy production_plans_select on public.production_plans
  for select using (private.is_active_company_member(company_id));
create policy production_plans_insert on public.production_plans
  for insert with check (private.is_active_company_member(company_id));
create policy production_plans_update on public.production_plans
  for update using (private.is_active_company_member(company_id)) with check (private.is_active_company_member(company_id));

alter table public.production_releases
  add column production_plan_id uuid references public.production_plans(id);

alter publication supabase_realtime add table public.production_plans;
alter publication supabase_realtime add table public.production_routes;

-- ============================================================
-- RPC: publicar rota (arquiva a anterior, versao += 1, trava no inicio da execucao)
-- ============================================================
create or replace function public.publish_production_route(
  p_product_id uuid,
  p_stage_names text[]
) returns public.production_routes
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company uuid := private.default_company_id();
  v_route public.production_routes;
  v_max_version integer;
  v_stage text;
  v_seq integer := 0;
begin
  if p_stage_names is null or array_length(p_stage_names, 1) is null then
    raise exception 'Informe ao menos uma etapa da rota';
  end if;

  update public.production_routes
    set status = 'ARQUIVADA'
    where product_id = p_product_id and company_id = v_company and status = 'ATIVA';

  select coalesce(max(version), 0) into v_max_version
    from public.production_routes where product_id = p_product_id and company_id = v_company;

  insert into public.production_routes (product_id, version, status)
    values (p_product_id, v_max_version + 1, 'ATIVA')
    returning * into v_route;

  foreach v_stage in array p_stage_names loop
    v_seq := v_seq + 1;
    insert into public.production_route_stages (route_id, sequence_order, name) values (v_route.id, v_seq, v_stage);
  end loop;

  return v_route;
end;
$$;

revoke execute on function public.publish_production_route(uuid, text[]) from anon;

-- ============================================================
-- RPC: create_production_release passa a exigir rota ativa (T03/D02) e aceita
-- liberacao a partir de um Plano V3 (origin = 'PLANO')
-- ============================================================
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

  select * into v_product from public.products where id = p_product_id and active = true;
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

revoke execute on function public.create_production_release(uuid, integer, text, text, uuid, text, uuid) from anon;
;
