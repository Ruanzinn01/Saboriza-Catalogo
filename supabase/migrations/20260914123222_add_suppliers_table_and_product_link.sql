-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260914123222 · md5 normalizado c0f329702cfadd202cec0b7867e4932c · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text not null,
  phone text not null,
  trade_name text not null default '',
  cnpj text not null default '',
  ie text not null default '',
  email text not null default '',
  address text not null default '',
  neighborhood text not null default '',
  cep text not null default '',
  city text not null default '',
  state text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;

create policy suppliers_admin_select_all on public.suppliers
  for select to authenticated using (true);

create policy suppliers_admin_insert on public.suppliers
  for insert to authenticated with check (true);

create policy suppliers_admin_update on public.suppliers
  for update to authenticated using (true) with check (true);

create policy suppliers_admin_delete on public.suppliers
  for delete to authenticated using (true);

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function set_updated_at();

alter table public.products
  add column supplier_id uuid references public.suppliers(id) on delete set null;
;
