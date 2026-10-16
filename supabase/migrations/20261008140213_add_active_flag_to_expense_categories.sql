-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261008140213 · md5 normalizado 6aeec780522f3d228ae2c155b3960c45 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
ALTER TABLE public.expense_categories ADD COLUMN active boolean NOT NULL DEFAULT true;
