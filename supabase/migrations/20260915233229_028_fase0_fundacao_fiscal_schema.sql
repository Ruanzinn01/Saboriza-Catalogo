-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260915233229 · md5 normalizado 7ab5c7dbbf325aad221989a418fcaa6e · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- Fase 0: Fundação fiscal
-- Migration aditiva. Nenhuma coluna existente de settings é alterada ou removida.

alter table public.settings
  add column if not exists fantasy_name text not null default '',
  add column if not exists cnae_code text not null default '',
  add column if not exists cnae_description text not null default '',
  add column if not exists tax_regime text not null default '',
  add column if not exists municipal_registration text not null default '',
  add column if not exists cep text not null default '',
  add column if not exists street text not null default '',
  add column if not exists number text not null default '',
  add column if not exists complement text not null default '',
  add column if not exists neighborhood text not null default '',
  add column if not exists state_code text not null default '',
  add column if not exists state_name text not null default '',
  add column if not exists city_code text not null default '',
  add column if not exists city_name text not null default '',
  add column if not exists ibge_code text not null default '',
  add column if not exists country text not null default 'Brasil',
  add column if not exists rbt12 numeric not null default 0,
  add column if not exists effective_rate numeric not null default 0,
  add column if not exists schedule_annex text not null default '',
  add column if not exists reference_competence text not null default '';

create table if not exists public.ibge_cities (
  city_code text primary key,
  city_name text not null,
  state_code text not null,
  state_name text not null
);

create index if not exists ibge_cities_state_code_idx on public.ibge_cities (state_code);

alter table public.ibge_cities enable row level security;

create policy ibge_cities_public_select
  on public.ibge_cities for select
  to anon
  using (true);

create policy ibge_cities_admin_select
  on public.ibge_cities for select
  to authenticated
  using (true);
;
