-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260909232125 · md5 normalizado 42504a71d14f737e8cf9f662533ebbde · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- ===== categories =====
create policy "categories_public_select_active"
  on public.categories for select
  to anon
  using (is_active = true);

create policy "categories_admin_select_all"
  on public.categories for select
  to authenticated
  using (true);

create policy "categories_admin_insert"
  on public.categories for insert
  to authenticated
  with check (true);

create policy "categories_admin_update"
  on public.categories for update
  to authenticated
  using (true)
  with check (true);

create policy "categories_admin_delete"
  on public.categories for delete
  to authenticated
  using (true);

-- ===== products =====
create policy "products_public_select_active"
  on public.products for select
  to anon
  using (is_active = true);

create policy "products_admin_select_all"
  on public.products for select
  to authenticated
  using (true);

create policy "products_admin_insert"
  on public.products for insert
  to authenticated
  with check (true);

create policy "products_admin_update"
  on public.products for update
  to authenticated
  using (true)
  with check (true);

create policy "products_admin_delete"
  on public.products for delete
  to authenticated
  using (true);

-- ===== orders =====
create policy "orders_admin_select_all"
  on public.orders for select
  to authenticated
  using (true);

create policy "orders_admin_update_status"
  on public.orders for update
  to authenticated
  using (true)
  with check (true);

-- ===== order_items =====
create policy "order_items_admin_select_all"
  on public.order_items for select
  to authenticated
  using (true);

-- ===== Storage: bucket product-images =====
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'product-images');

create policy "product_images_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

create policy "product_images_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

create policy "product_images_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');
;
