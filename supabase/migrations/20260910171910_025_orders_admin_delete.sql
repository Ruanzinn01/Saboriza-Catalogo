-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260910171910 · md5 normalizado 0639c5fa924245d431f49e21c0bcf031 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create policy orders_admin_delete on public.orders
  for delete to authenticated using (true);
