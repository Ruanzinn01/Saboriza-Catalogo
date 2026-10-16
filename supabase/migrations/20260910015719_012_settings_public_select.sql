-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260910015719 · md5 normalizado 70f9665e4adc0f650241deaebbe112de · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create policy settings_public_select on public.settings
  for select to anon using (true);
;
