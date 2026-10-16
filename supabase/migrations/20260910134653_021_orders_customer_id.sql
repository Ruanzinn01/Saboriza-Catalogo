-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260910134653 · md5 normalizado ec0f973eb33e82cbb262bbe289014e83 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
alter table public.orders
  add column customer_id uuid references public.customers (id) on delete restrict;

create index orders_customer_id_idx on public.orders (customer_id);
;
