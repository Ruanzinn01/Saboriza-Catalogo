-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260921184713 · md5 normalizado cd83f41652be425178776d312c42eff6 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS max_stock numeric NOT NULL DEFAULT 0 CHECK (max_stock >= 0);
