-- Separa Confere V3 — dados mínimos do operador (PROPOSTA).
-- STATUS: VERSIONADO, NÃO APLICADO. Depende de refatorar src/store/separation-store.ts para usar estas funções
-- (hoje o app lê orders/products direto) — aplicar o banco antes do frontend QUEBRARIA a separação do operador confinado.
-- Ordem segura: homologação -> frontend novo (usa as funções para todos) -> só então esta migration em produção.
--
-- Problema medido (ver docs/separa-confere-v3): o operador confinado lê as 44 colunas de orders (telefone, CNPJ, valores,
-- cupom, endereço), 15 de order_items (preço) e 32 de products (preço, custo médio, margem, fornecedor).
-- A separação usa 13 colunas de orders, 10 de order_items, 4 de products e 7 de order_adjustment_requests.
--
-- Solução: o operador "só Separa Confere" perde a leitura/escrita DIRETA dessas 4 tabelas e passa a usar funções
-- SECURITY DEFINER que devolvem apenas o necessário. Quem tem producao.operar/entrega.operar continua com o acesso
-- direto que esses apps exigem (políticas deles).
--
-- Efeito colateral conhecido: o realtime de postgres_changes respeita a política de leitura, então o operador
-- confinado deixa de receber o evento de "pedido novo"; o frontend deve fazer polling (ex.: 15 s) e ao focar a aba.

create or replace function private.is_separa_only_operator(p_company_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select (select private.is_restricted_operator(p_company_id))
     and not (private.user_permission_keys(p_company_id) && array['producao.operar', 'entrega.operar'])
$$;

revoke all on function private.is_separa_only_operator(uuid) from public, anon;
grant execute on function private.is_separa_only_operator(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['orders', 'order_items', 'order_adjustment_requests', 'products'] loop
    execute format('drop policy if exists %I on public.%I', t || '_no_separa_direct', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (not (select private.is_separa_only_operator(company_id))) with check (not (select private.is_separa_only_operator(company_id)))',
      t || '_no_separa_direct', t);
  end loop;
end $$;

create or replace function private.separation_actor_name()
returns text
language sql
stable security definer
set search_path to ''
as $$
  select coalesce(
    (select nullif(trim(au.raw_user_meta_data ->> 'name'), '') from auth.users au where au.id = (select auth.uid())),
    (select au.email from auth.users au where au.id = (select auth.uid())),
    'Operador')
$$;

revoke all on function private.separation_actor_name() from public, anon;
grant execute on function private.separation_actor_name() to authenticated;

-- Leitura: p_scope = 'queue' | 'history' | 'order'. Mesmo formato que o frontend monta hoje.
create or replace function public.separation_snapshot(p_scope text, p_order_id uuid default null)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
  v_orders jsonb;
  v_ids uuid[];
begin
  if (select auth.uid()) is null or v_company is null then raise exception 'Não autenticado'; end if;
  if p_scope not in ('queue', 'history', 'order') then raise exception 'Escopo inválido'; end if;
  if p_scope = 'order' and p_order_id is null then raise exception 'Informe o pedido'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb), coalesce(array_agg(x.id), '{}')
    into v_orders, v_ids
  from (
    select o.id, o.order_number, o.created_at, o.customer_name, o.company_name, o.total_units, o.status::text as status,
           o.separation_queued_at, o.separation_started_at, o.separation_finished_at, o.separation_responsible,
           o.separation_started_by, o.separation_completed_by
    from public.orders o
    where o.company_id = v_company
      and case p_scope
            when 'queue' then o.status = 'CONFIRMED' and o.separation_finished_at is null
            when 'history' then o.status in ('COMPLETED', 'CANCELLED')
            else o.id = p_order_id
          end
    order by o.created_at desc
    limit case p_scope when 'history' then 100 else 500 end
  ) x;

  return jsonb_build_object(
    'orders', v_orders,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'order_id', i.order_id, 'product_id', i.product_id, 'product_name', i.product_name,
        'presentation', i.presentation, 'weight_volume', i.weight_volume, 'total_units', i.total_units,
        'packs_quantity', i.packs_quantity, 'pack_quantity', i.pack_quantity, 'separated_at', i.separated_at)), '[]'::jsonb)
      from public.order_items i where i.order_id = any (v_ids)),
    'products', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'image_url', p.image_url, 'code', p.code, 'gtin', p.gtin)), '[]'::jsonb)
      from public.products p
      where p.company_id = v_company
        and p.id in (select i.product_id from public.order_items i where i.order_id = any (v_ids) and i.product_id is not null)),
    'adjustments', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'order_id', a.order_id, 'order_item_id', a.order_item_id, 'message', a.message,
        'status', a.status, 'created_by', a.created_by, 'created_at', a.created_at)), '[]'::jsonb)
      from public.order_adjustment_requests a where a.order_id = any (v_ids))
  );
end;
$$;

create or replace function public.separation_accept_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_name text := private.separation_actor_name();
  v_company uuid := (select private.default_company_id());
  n int;
begin
  update public.orders
     set separation_responsible = v_name,
         separation_started_at = coalesce(separation_started_at, now()),
         separation_started_by = coalesce(separation_started_by, v_name)
   where id = p_order_id and company_id = v_company and status = 'CONFIRMED'
     and separation_finished_at is null and separation_responsible is null;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

create or replace function public.separation_release_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_name text := private.separation_actor_name();
  v_company uuid := (select private.default_company_id());
  n int;
begin
  update public.orders set separation_responsible = null
   where id = p_order_id and company_id = v_company and separation_finished_at is null
     and (separation_responsible = v_name or not (select private.is_restricted_operator(company_id)));
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Marca/desfaz um item. Ao marcar o último item sem ajuste pendente, a separação termina (mesma regra de hoje).
create or replace function public.separation_set_item(p_item_id uuid, p_separated boolean)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_name text := private.separation_actor_name();
  v_company uuid := (select private.default_company_id());
  i public.order_items;
  n int;
begin
  select * into i from public.order_items where id = p_item_id and company_id = v_company for update;
  if not found then return false; end if;
  if p_separated then
    update public.order_items set separated_at = now() where id = i.id and separated_at is null;
    get diagnostics n = row_count;
    if n = 0 then return false; end if;
    if not exists (select 1 from public.order_items r where r.order_id = i.order_id and r.separated_at is null)
       and not exists (select 1 from public.order_adjustment_requests a where a.order_id = i.order_id and a.status = 'pending') then
      update public.orders set separation_finished_at = now(), separation_completed_by = v_name
       where id = i.order_id and separation_finished_at is null;
    end if;
  else
    update public.order_items set separated_at = null where id = i.id;
  end if;
  return true;
end;
$$;

create or replace function public.separation_request_adjustment(p_order_id uuid, p_item_id uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
  v_id uuid;
begin
  if coalesce(trim(p_message), '') = '' then raise exception 'Descreva o ajuste'; end if;
  if not exists (select 1 from public.orders o where o.id = p_order_id and o.company_id = v_company) then raise exception 'Pedido não encontrado'; end if;
  insert into public.order_adjustment_requests (order_id, order_item_id, message, created_by)
  values (p_order_id, p_item_id, trim(p_message), private.separation_actor_name())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.separation_resolve_adjustment(p_adjustment_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
  n int;
begin
  update public.order_adjustment_requests set status = 'resolved', resolved_by = private.separation_actor_name(), resolved_at = now()
   where id = p_adjustment_id and company_id = v_company and status = 'pending';
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.separation_snapshot(text, uuid)', 'public.separation_accept_order(uuid)', 'public.separation_release_order(uuid)',
    'public.separation_set_item(uuid, boolean)', 'public.separation_request_adjustment(uuid, uuid, text)',
    'public.separation_resolve_adjustment(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
