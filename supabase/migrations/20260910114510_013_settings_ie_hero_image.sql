-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260910114510 · md5 normalizado 72e9ee90426d09e6977220d99ff71353 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
alter table public.settings
  add column ie text not null default '',
  add column hero_image_url text not null default '';
;
