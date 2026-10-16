-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260922220930 · md5 normalizado 408c79d7123407a196f0198b9e24e89d · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create policy order_items_admin_update
  on public.order_items for update
  to authenticated
  using (true)
  with check (true);
