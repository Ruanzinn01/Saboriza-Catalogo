-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260910134648 · md5 normalizado 6464ce338cc7a1b0c0f102407d7901b8 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
alter table public.customers enable row level security;

create policy customers_admin_select_all on public.customers
  for select to authenticated using (true);

create policy customers_admin_insert on public.customers
  for insert to authenticated with check (true);

create policy customers_admin_update on public.customers
  for update to authenticated using (true) with check (true);

create policy customers_admin_delete on public.customers
  for delete to authenticated using (true);
;
