-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260910001917 · md5 normalizado 7684d74dd5edeff4962cb288c8420fa9 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  factory_name text not null default '',
  whatsapp_number text not null default '',
  whatsapp_display text not null default '',
  business_hours text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function set_updated_at();

create policy settings_admin_select on public.settings
  for select to authenticated using (true);

create policy settings_admin_update on public.settings
  for update to authenticated using (true) with check (true);

insert into public.settings (factory_name, whatsapp_number, whatsapp_display, business_hours)
values ('Saboriza', '559491385788', '(94) 9138-5788', 'Segunda a sexta, 8h às 18h');
;
