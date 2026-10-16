-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260928152940 · md5 normalizado 624dc98c1c2db2e0d8edb747a507b5d6 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- ÓRIS360 — Fase 3 / Onda 2 (fatia) — company_id nas estruturas das Fases 0-4 do guia Saboriza
-- (fiscal, insumos, produção, estoque; indicadores herda automaticamente via RLS).
-- Expand + backfill + not null, tudo na mesma transação, uma única empresa existente (Saboriza).
-- Fora de escopo aqui: orders, order_items, customers, coupons, order_deliveries e afins
-- (pertencem ao domínio Comercial/Entrega, tratado em onda separada antes da Fase 5).

begin;

do $$
declare
  v_company_id uuid;
begin
  select id into v_company_id from public.companies where display_name = 'Saboriza' limit 1;
  if v_company_id is null then
    raise exception 'Empresa Saboriza não encontrada — a Onda 1 (Fundação SaaS) precisa rodar antes desta migration';
  end if;

  -- 1) suppliers (usado por products e raw_materials)
  alter table public.suppliers add column if not exists company_id uuid references public.companies(id);
  update public.suppliers set company_id = v_company_id where company_id is null;
  alter table public.suppliers alter column company_id set not null;
  alter table public.suppliers add constraint suppliers_company_id_unique unique (company_id, id);
  create index if not exists suppliers_company_idx on public.suppliers(company_id);

  -- 2) categories
  alter table public.categories add column if not exists company_id uuid references public.companies(id);
  update public.categories set company_id = v_company_id where company_id is null;
  alter table public.categories alter column company_id set not null;
  alter table public.categories add constraint categories_company_id_unique unique (company_id, id);
  create index if not exists categories_company_idx on public.categories(company_id);
  alter table public.categories drop constraint if exists categories_slug_key;
  alter table public.categories add constraint categories_company_slug_key unique (company_id, slug);

  -- 3) products (depende de categories, suppliers)
  alter table public.products add column if not exists company_id uuid references public.companies(id);
  update public.products set company_id = v_company_id where company_id is null;
  alter table public.products alter column company_id set not null;
  alter table public.products add constraint products_company_id_unique unique (company_id, id);
  create index if not exists products_company_idx on public.products(company_id);
  alter table public.products drop constraint if exists products_code_key;
  alter table public.products add constraint products_company_code_key unique (company_id, code);
  alter table public.products
    add constraint products_category_company_fkey foreign key (company_id, category_id)
      references public.categories(company_id, id);
  alter table public.products
    add constraint products_supplier_company_fkey foreign key (company_id, supplier_id)
      references public.suppliers(company_id, id);

  -- 4) raw_materials (depende de suppliers)
  alter table public.raw_materials add column if not exists company_id uuid references public.companies(id);
  update public.raw_materials set company_id = v_company_id where company_id is null;
  alter table public.raw_materials alter column company_id set not null;
  alter table public.raw_materials add constraint raw_materials_company_id_unique unique (company_id, id);
  create index if not exists raw_materials_company_idx on public.raw_materials(company_id);
  alter table public.raw_materials drop constraint if exists raw_materials_code_key;
  alter table public.raw_materials add constraint raw_materials_company_code_key unique (company_id, code);
  alter table public.raw_materials
    add constraint raw_materials_supplier_company_fkey foreign key (company_id, primary_supplier_id)
      references public.suppliers(company_id, id);

  -- 5) raw_material_categories
  alter table public.raw_material_categories add column if not exists company_id uuid references public.companies(id);
  update public.raw_material_categories set company_id = v_company_id where company_id is null;
  alter table public.raw_material_categories alter column company_id set not null;
  create index if not exists raw_material_categories_company_idx on public.raw_material_categories(company_id);

  -- 6) raw_material_entries (depende de raw_materials, suppliers)
  alter table public.raw_material_entries add column if not exists company_id uuid references public.companies(id) default private.default_company_id();
  update public.raw_material_entries set company_id = v_company_id where company_id is null;
  alter table public.raw_material_entries alter column company_id set not null;
  create index if not exists raw_material_entries_company_idx on public.raw_material_entries(company_id);
  alter table public.raw_material_entries
    add constraint raw_material_entries_material_company_fkey foreign key (company_id, raw_material_id)
      references public.raw_materials(company_id, id);
  alter table public.raw_material_entries
    add constraint raw_material_entries_supplier_company_fkey foreign key (company_id, supplier_id)
      references public.suppliers(company_id, id);

  -- 7) product_recipe (depende de products, raw_materials)
  alter table public.product_recipe add column if not exists company_id uuid references public.companies(id) default private.default_company_id();
  update public.product_recipe set company_id = v_company_id where company_id is null;
  alter table public.product_recipe alter column company_id set not null;
  create index if not exists product_recipe_company_idx on public.product_recipe(company_id);
  alter table public.product_recipe
    add constraint product_recipe_product_company_fkey foreign key (company_id, product_id)
      references public.products(company_id, id);
  alter table public.product_recipe
    add constraint product_recipe_material_company_fkey foreign key (company_id, raw_material_id)
      references public.raw_materials(company_id, id);

  -- 8) production_records (depende de products)
  alter table public.production_records add column if not exists company_id uuid references public.companies(id) default private.default_company_id();
  update public.production_records set company_id = v_company_id where company_id is null;
  alter table public.production_records alter column company_id set not null;
  alter table public.production_records add constraint production_records_company_id_unique unique (company_id, id);
  create index if not exists production_records_company_idx on public.production_records(company_id);
  alter table public.production_records
    add constraint production_records_product_company_fkey foreign key (company_id, product_id)
      references public.products(company_id, id);

  -- 9) production_consumptions (depende de production_records, raw_materials)
  alter table public.production_consumptions add column if not exists company_id uuid references public.companies(id) default private.default_company_id();
  update public.production_consumptions set company_id = v_company_id where company_id is null;
  alter table public.production_consumptions alter column company_id set not null;
  create index if not exists production_consumptions_company_idx on public.production_consumptions(company_id);
  alter table public.production_consumptions
    add constraint production_consumptions_record_company_fkey foreign key (company_id, production_record_id)
      references public.production_records(company_id, id);
  alter table public.production_consumptions
    add constraint production_consumptions_material_company_fkey foreign key (company_id, raw_material_id)
      references public.raw_materials(company_id, id);

  -- 10) stock_movements (depende de products)
  alter table public.stock_movements add column if not exists company_id uuid references public.companies(id) default private.default_company_id();
  update public.stock_movements set company_id = v_company_id where company_id is null;
  alter table public.stock_movements alter column company_id set not null;
  create index if not exists stock_movements_company_idx on public.stock_movements(company_id);
  alter table public.stock_movements
    add constraint stock_movements_product_company_fkey foreign key (company_id, product_id)
      references public.products(company_id, id);

  -- 11) settings (singleton por empresa)
  alter table public.settings add column if not exists company_id uuid references public.companies(id);
  update public.settings set company_id = v_company_id where company_id is null;
  alter table public.settings alter column company_id set not null;
  alter table public.settings add constraint settings_company_id_unique unique (company_id);
end $$;

-- Imutabilidade de company_id (reaproveita o trigger function da Onda 1)
create trigger suppliers_company_immutable before update on public.suppliers
for each row execute function private.guard_company_id_immutable();
create trigger categories_company_immutable before update on public.categories
for each row execute function private.guard_company_id_immutable();
create trigger products_company_immutable before update on public.products
for each row execute function private.guard_company_id_immutable();
create trigger raw_materials_company_immutable before update on public.raw_materials
for each row execute function private.guard_company_id_immutable();
create trigger raw_material_categories_company_immutable before update on public.raw_material_categories
for each row execute function private.guard_company_id_immutable();
create trigger raw_material_entries_company_immutable before update on public.raw_material_entries
for each row execute function private.guard_company_id_immutable();
create trigger product_recipe_company_immutable before update on public.product_recipe
for each row execute function private.guard_company_id_immutable();
create trigger production_records_company_immutable before update on public.production_records
for each row execute function private.guard_company_id_immutable();
create trigger production_consumptions_company_immutable before update on public.production_consumptions
for each row execute function private.guard_company_id_immutable();
create trigger stock_movements_company_immutable before update on public.stock_movements
for each row execute function private.guard_company_id_immutable();
create trigger settings_company_immutable before update on public.settings
for each row execute function private.guard_company_id_immutable();

-- RLS: substitui as policies "true" por escopo de empresa (mesmo nível de acesso de hoje, agora por tenant).
-- categories
drop policy if exists categories_admin_select_all on public.categories;
drop policy if exists categories_admin_insert on public.categories;
drop policy if exists categories_admin_update on public.categories;
drop policy if exists categories_admin_delete on public.categories;
create policy categories_admin_select_all on public.categories for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy categories_admin_insert on public.categories for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));
create policy categories_admin_update on public.categories for update to authenticated
  using ((select private.is_active_company_member(company_id)))
  with check ((select private.is_active_company_member(company_id)));
create policy categories_admin_delete on public.categories for delete to authenticated
  using ((select private.is_active_company_member(company_id)));

-- products
drop policy if exists products_admin_select_all on public.products;
drop policy if exists products_admin_insert on public.products;
drop policy if exists products_admin_update on public.products;
drop policy if exists products_admin_delete on public.products;
create policy products_admin_select_all on public.products for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy products_admin_insert on public.products for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));
create policy products_admin_update on public.products for update to authenticated
  using ((select private.is_active_company_member(company_id)))
  with check ((select private.is_active_company_member(company_id)));
create policy products_admin_delete on public.products for delete to authenticated
  using ((select private.is_active_company_member(company_id)));

-- raw_materials
drop policy if exists raw_materials_admin_select_all on public.raw_materials;
drop policy if exists raw_materials_admin_insert on public.raw_materials;
drop policy if exists raw_materials_admin_update on public.raw_materials;
drop policy if exists raw_materials_admin_delete on public.raw_materials;
create policy raw_materials_admin_select_all on public.raw_materials for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy raw_materials_admin_insert on public.raw_materials for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));
create policy raw_materials_admin_update on public.raw_materials for update to authenticated
  using ((select private.is_active_company_member(company_id)))
  with check ((select private.is_active_company_member(company_id)));
create policy raw_materials_admin_delete on public.raw_materials for delete to authenticated
  using ((select private.is_active_company_member(company_id)));

-- raw_material_categories
drop policy if exists raw_material_categories_admin_select_all on public.raw_material_categories;
drop policy if exists raw_material_categories_admin_insert on public.raw_material_categories;
drop policy if exists raw_material_categories_admin_update on public.raw_material_categories;
drop policy if exists raw_material_categories_admin_delete on public.raw_material_categories;
create policy raw_material_categories_admin_select_all on public.raw_material_categories for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy raw_material_categories_admin_insert on public.raw_material_categories for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));
create policy raw_material_categories_admin_update on public.raw_material_categories for update to authenticated
  using ((select private.is_active_company_member(company_id)))
  with check ((select private.is_active_company_member(company_id)));
create policy raw_material_categories_admin_delete on public.raw_material_categories for delete to authenticated
  using ((select private.is_active_company_member(company_id)));

-- raw_material_entries
drop policy if exists raw_material_entries_admin_select_all on public.raw_material_entries;
drop policy if exists raw_material_entries_admin_insert on public.raw_material_entries;
drop policy if exists raw_material_entries_admin_update on public.raw_material_entries;
create policy raw_material_entries_admin_select_all on public.raw_material_entries for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy raw_material_entries_admin_insert on public.raw_material_entries for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));
create policy raw_material_entries_admin_update on public.raw_material_entries for update to authenticated
  using ((select private.is_active_company_member(company_id)))
  with check ((select private.is_active_company_member(company_id)));

-- product_recipe
drop policy if exists product_recipe_admin_select_all on public.product_recipe;
drop policy if exists product_recipe_admin_insert on public.product_recipe;
drop policy if exists product_recipe_admin_update on public.product_recipe;
drop policy if exists product_recipe_admin_delete on public.product_recipe;
create policy product_recipe_admin_select_all on public.product_recipe for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy product_recipe_admin_insert on public.product_recipe for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));
create policy product_recipe_admin_update on public.product_recipe for update to authenticated
  using ((select private.is_active_company_member(company_id)))
  with check ((select private.is_active_company_member(company_id)));
create policy product_recipe_admin_delete on public.product_recipe for delete to authenticated
  using ((select private.is_active_company_member(company_id)));

-- production_records
drop policy if exists production_records_admin_select_all on public.production_records;
drop policy if exists production_records_admin_insert on public.production_records;
create policy production_records_admin_select_all on public.production_records for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy production_records_admin_insert on public.production_records for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));

-- production_consumptions
drop policy if exists production_consumptions_admin_select_all on public.production_consumptions;
drop policy if exists production_consumptions_admin_insert on public.production_consumptions;
create policy production_consumptions_admin_select_all on public.production_consumptions for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy production_consumptions_admin_insert on public.production_consumptions for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));

-- stock_movements
drop policy if exists stock_movements_select_authenticated on public.stock_movements;
drop policy if exists stock_movements_insert_authenticated on public.stock_movements;
create policy stock_movements_select_authenticated on public.stock_movements for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy stock_movements_insert_authenticated on public.stock_movements for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));

-- suppliers
drop policy if exists suppliers_admin_select_all on public.suppliers;
drop policy if exists suppliers_admin_insert on public.suppliers;
drop policy if exists suppliers_admin_update on public.suppliers;
drop policy if exists suppliers_admin_delete on public.suppliers;
create policy suppliers_admin_select_all on public.suppliers for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy suppliers_admin_insert on public.suppliers for insert to authenticated
  with check ((select private.is_active_company_member(company_id)));
create policy suppliers_admin_update on public.suppliers for update to authenticated
  using ((select private.is_active_company_member(company_id)))
  with check ((select private.is_active_company_member(company_id)));
create policy suppliers_admin_delete on public.suppliers for delete to authenticated
  using ((select private.is_active_company_member(company_id)));

-- settings (mantém settings_public_select para o storefront; só a via administrativa ganha escopo)
drop policy if exists settings_admin_select on public.settings;
drop policy if exists settings_admin_update on public.settings;
create policy settings_admin_select on public.settings for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy settings_admin_update on public.settings for update to authenticated
  using ((select private.is_active_company_member(company_id)))
  with check ((select private.is_active_company_member(company_id)));

commit;
;
