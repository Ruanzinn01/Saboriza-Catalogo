-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002171157 · md5 normalizado 7d7f08299c03790294e776955c63ab2e · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

alter table public.fiscal_documents drop constraint fiscal_documents_status_check;
alter table public.fiscal_documents add constraint fiscal_documents_status_check
  check (status = any (array['NAO_EMITIDO','PROCESSANDO','AUTORIZADA','REJEITADA','CANCELADA']));
;
