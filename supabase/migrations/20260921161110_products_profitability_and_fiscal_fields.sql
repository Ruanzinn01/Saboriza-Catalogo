-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260921161110 · md5 normalizado b684d89cd09fd21c327a4ffee0b0e7c8 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS target_margin_pct numeric NOT NULL DEFAULT 40 CHECK (target_margin_pct >= 0 AND target_margin_pct <= 100),
  ADD COLUMN IF NOT EXISTS gtin  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ncm   text NOT NULL DEFAULT '';
