-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001204618 · md5 normalizado e9ddc0eb0689ff93dc8153b2b8857940 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create unique index if not exists companies_single_default on public.companies ((true)) where is_default = true;
