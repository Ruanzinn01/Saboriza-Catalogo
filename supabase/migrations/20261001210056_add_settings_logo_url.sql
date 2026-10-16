-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001210056 · md5 normalizado 7df24e57dc3c7cbf1e9e6d120d9749aa · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
alter table public.settings add column if not exists logo_url text;

update public.settings
set logo_url = '/brand/logo-saboriza-transparente.png'
where company_id = 'b01b40dc-e3e4-424a-826d-7bebe78589f7' and logo_url is null;
;
