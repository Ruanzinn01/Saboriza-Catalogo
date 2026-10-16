-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260910134643 · md5 normalizado d7e9830b161d89b06d8580c8ff97f386 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create table public.customers (
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

create index customers_phone_idx on public.customers (phone);
create index customers_cnpj_idx on public.customers (cnpj);
;
