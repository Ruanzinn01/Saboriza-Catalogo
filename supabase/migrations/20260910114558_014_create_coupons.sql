-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260910114558 · md5 normalizado 30e19588549f6bf918f3e79c0690a508 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coupons enable row level security;

create policy coupons_admin_select_all on public.coupons
  for select to authenticated using (true);

create policy coupons_admin_insert on public.coupons
  for insert to authenticated with check (true);

create policy coupons_admin_update on public.coupons
  for update to authenticated using (true) with check (true);

create policy coupons_admin_delete on public.coupons
  for delete to authenticated using (true);

create policy coupons_public_select_active on public.coupons
  for select to anon using (is_active = true);

create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function set_updated_at();
;
