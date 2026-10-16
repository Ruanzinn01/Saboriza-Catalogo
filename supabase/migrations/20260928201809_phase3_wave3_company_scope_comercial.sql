-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260928201809 · md5 normalizado 1056a9f368a05b0ded1eedb8a0e55554 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- ÓRIS360 — Onda 2 (comercial) — company_id em customers/orders/order_items/coupons/
-- order_adjustment_requests/order_deliveries/order_delivery_items/delivery_er_reservations.
-- Checkout público (anon) continua funcionando sem login: resolve_write_company_id() cai pro
-- default único do storefront (Saboriza) quando não há membership (anon). Trocar por resolução
-- por domínio/subdomínio quando existir 2º tenant no storefront público.

begin;

create or replace function private.public_storefront_company_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.companies where display_name = 'Saboriza' limit 1
$$;
comment on function private.public_storefront_company_id() is
  'Placeholder single-tenant: retorna a única empresa do storefront público hoje. Substituir por resolução de domínio/subdomínio quando existir 2º tenant com loja pública.';

create or replace function private.resolve_write_company_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select private.default_company_id()),
    (select private.public_storefront_company_id())
  )
$$;
revoke all on function private.public_storefront_company_id() from public;
revoke all on function private.resolve_write_company_id() from public;
grant execute on function private.public_storefront_company_id() to anon, authenticated;
grant execute on function private.resolve_write_company_id() to anon, authenticated;

create or replace function private.set_company_from_order()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  select company_id into new.company_id from public.orders where id = new.order_id;
  return new;
end
$$;

create or replace function private.set_company_from_delivery()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  select company_id into new.company_id from public.order_deliveries where id = new.delivery_id;
  return new;
end
$$;

revoke all on function private.set_company_from_order() from public,anon,authenticated;
revoke all on function private.set_company_from_delivery() from public,anon,authenticated;

do $$
declare
  v_company_id uuid;
begin
  select id into v_company_id from public.companies where display_name = 'Saboriza' limit 1;
  if v_company_id is null then
    raise exception 'Empresa Saboriza não encontrada';
  end if;

  -- 1) customers
  alter table public.customers add column if not exists company_id uuid references public.companies(id) default private.resolve_write_company_id();
  update public.customers set company_id = v_company_id where company_id is null;
  alter table public.customers alter column company_id set not null;
  alter table public.customers add constraint customers_company_id_unique unique (company_id, id);
  create index if not exists customers_company_idx on public.customers(company_id);

  -- 2) coupons
  alter table public.coupons add column if not exists company_id uuid references public.companies(id) default private.resolve_write_company_id();
  update public.coupons set company_id = v_company_id where company_id is null;
  alter table public.coupons alter column company_id set not null;
  create index if not exists coupons_company_idx on public.coupons(company_id);
  alter table public.coupons drop constraint if exists coupons_code_key;
  alter table public.coupons add constraint coupons_company_code_key unique (company_id, code);

  -- 3) orders (depende de customers)
  alter table public.orders add column if not exists company_id uuid references public.companies(id) default private.resolve_write_company_id();
  update public.orders set company_id = v_company_id where company_id is null;
  alter table public.orders alter column company_id set not null;
  alter table public.orders add constraint orders_company_id_unique unique (company_id, id);
  create index if not exists orders_company_idx on public.orders(company_id);
  alter table public.orders
    add constraint orders_customer_company_fkey foreign key (company_id, customer_id)
      references public.customers(company_id, id);

  -- 4) order_items (deriva de orders via trigger)
  alter table public.order_items add column if not exists company_id uuid references public.companies(id);
  update public.order_items oi set company_id = o.company_id from public.orders o where o.id = oi.order_id and oi.company_id is null;
  alter table public.order_items alter column company_id set not null;
  create index if not exists order_items_company_idx on public.order_items(company_id);
  alter table public.order_items
    add constraint order_items_order_company_fkey foreign key (company_id, order_id)
      references public.orders(company_id, id);
  alter table public.order_items
    add constraint order_items_product_company_fkey foreign key (company_id, product_id)
      references public.products(company_id, id);
  create trigger order_items_set_company before insert on public.order_items
    for each row execute function private.set_company_from_order();

  -- 5) order_adjustment_requests (deriva de orders)
  alter table public.order_adjustment_requests add column if not exists company_id uuid references public.companies(id);
  update public.order_adjustment_requests oar set company_id = o.company_id from public.orders o where o.id = oar.order_id and oar.company_id is null;
  alter table public.order_adjustment_requests alter column company_id set not null;
  create index if not exists order_adjustment_requests_company_idx on public.order_adjustment_requests(company_id);
  alter table public.order_adjustment_requests
    add constraint order_adjustment_requests_order_company_fkey foreign key (company_id, order_id)
      references public.orders(company_id, id);
  create trigger order_adjustment_requests_set_company before insert on public.order_adjustment_requests
    for each row execute function private.set_company_from_order();

  -- 6) delivery_er_reservations (deriva de orders)
  alter table public.delivery_er_reservations add column if not exists company_id uuid references public.companies(id);
  update public.delivery_er_reservations der set company_id = o.company_id from public.orders o where o.id = der.order_id and der.company_id is null;
  alter table public.delivery_er_reservations alter column company_id set not null;
  create index if not exists delivery_er_reservations_company_idx on public.delivery_er_reservations(company_id);
  alter table public.delivery_er_reservations
    add constraint delivery_er_reservations_order_company_fkey foreign key (company_id, order_id)
      references public.orders(company_id, id);
  create trigger delivery_er_reservations_set_company before insert on public.delivery_er_reservations
    for each row execute function private.set_company_from_order();

  -- 7) order_deliveries (deriva de orders)
  alter table public.order_deliveries add column if not exists company_id uuid references public.companies(id);
  update public.order_deliveries od set company_id = o.company_id from public.orders o where o.id = od.order_id and od.company_id is null;
  alter table public.order_deliveries alter column company_id set not null;
  alter table public.order_deliveries add constraint order_deliveries_company_id_unique unique (company_id, id);
  create index if not exists order_deliveries_company_idx on public.order_deliveries(company_id);
  alter table public.order_deliveries
    add constraint order_deliveries_order_company_fkey foreign key (company_id, order_id)
      references public.orders(company_id, id);
  create trigger order_deliveries_set_company before insert on public.order_deliveries
    for each row execute function private.set_company_from_order();

  -- 8) order_delivery_items (deriva de order_deliveries)
  alter table public.order_delivery_items add column if not exists company_id uuid references public.companies(id);
  update public.order_delivery_items odi set company_id = od.company_id from public.order_deliveries od where od.id = odi.delivery_id and odi.company_id is null;
  alter table public.order_delivery_items alter column company_id set not null;
  create index if not exists order_delivery_items_company_idx on public.order_delivery_items(company_id);
  alter table public.order_delivery_items
    add constraint order_delivery_items_delivery_company_fkey foreign key (company_id, delivery_id)
      references public.order_deliveries(company_id, id);
  create trigger order_delivery_items_set_company before insert on public.order_delivery_items
    for each row execute function private.set_company_from_delivery();
end $$;

-- Imutabilidade de company_id nas tabelas raiz (as derivadas já são protegidas pelo trigger de derivação,
-- que sempre recalcula a partir do pai; não recebem UPDATE de company_id no fluxo atual).
create trigger customers_company_immutable before update on public.customers
for each row execute function private.guard_company_id_immutable();
create trigger coupons_company_immutable before update on public.coupons
for each row execute function private.guard_company_id_immutable();
create trigger orders_company_immutable before update on public.orders
for each row execute function private.guard_company_id_immutable();

-- RLS: escopo por empresa nas policies administrativas (mesmo padrão da Onda 1/2-fatia).
-- Policies públicas/anon (create_order, update_order_items, coupons_public_select_active) não mudam.

drop policy if exists customers_admin_select_all on public.customers;
drop policy if exists customers_admin_insert on public.customers;
drop policy if exists customers_admin_update on public.customers;
drop policy if exists customers_admin_delete on public.customers;
create policy customers_admin_select_all on public.customers for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy customers_admin_insert on public.customers for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));
create policy customers_admin_update on public.customers for update to authenticated
  using ((select private.is_active_company_member(company_id)))
  with check ((select private.is_active_company_member(company_id)));
create policy customers_admin_delete on public.customers for delete to authenticated
  using ((select private.is_active_company_member(company_id)));

drop policy if exists coupons_admin_select_all on public.coupons;
drop policy if exists coupons_admin_insert on public.coupons;
drop policy if exists coupons_admin_update on public.coupons;
drop policy if exists coupons_admin_delete on public.coupons;
create policy coupons_admin_select_all on public.coupons for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy coupons_admin_insert on public.coupons for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));
create policy coupons_admin_update on public.coupons for update to authenticated
  using ((select private.is_active_company_member(company_id)))
  with check ((select private.is_active_company_member(company_id)));
create policy coupons_admin_delete on public.coupons for delete to authenticated
  using ((select private.is_active_company_member(company_id)));

drop policy if exists orders_admin_select_all on public.orders;
drop policy if exists orders_admin_update_status on public.orders;
drop policy if exists orders_admin_delete on public.orders;
create policy orders_admin_select_all on public.orders for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy orders_admin_update_status on public.orders for update to authenticated
  using ((select private.is_active_company_member(company_id)))
  with check ((select private.is_active_company_member(company_id)));
create policy orders_admin_delete on public.orders for delete to authenticated
  using ((select private.is_active_company_member(company_id)));

drop policy if exists order_items_admin_select_all on public.order_items;
drop policy if exists order_items_admin_update on public.order_items;
create policy order_items_admin_select_all on public.order_items for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy order_items_admin_update on public.order_items for update to authenticated
  using ((select private.is_active_company_member(company_id)))
  with check ((select private.is_active_company_member(company_id)));

drop policy if exists order_adjustment_requests_admin_select_all on public.order_adjustment_requests;
drop policy if exists order_adjustment_requests_admin_insert on public.order_adjustment_requests;
drop policy if exists order_adjustment_requests_admin_update on public.order_adjustment_requests;
create policy order_adjustment_requests_admin_select_all on public.order_adjustment_requests for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy order_adjustment_requests_admin_insert on public.order_adjustment_requests for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));
create policy order_adjustment_requests_admin_update on public.order_adjustment_requests for update to authenticated
  using ((select private.is_active_company_member(company_id)))
  with check ((select private.is_active_company_member(company_id)));

drop policy if exists delivery_er_reservations_select on public.delivery_er_reservations;
create policy delivery_er_reservations_select on public.delivery_er_reservations for select to authenticated
  using ((select private.is_active_company_member(company_id)));

drop policy if exists order_deliveries_select on public.order_deliveries;
create policy order_deliveries_select on public.order_deliveries for select to authenticated
  using ((select private.is_active_company_member(company_id)));

drop policy if exists order_delivery_items_select on public.order_delivery_items;
create policy order_delivery_items_select on public.order_delivery_items for select to authenticated
  using ((select private.is_active_company_member(company_id)));

commit;
;
