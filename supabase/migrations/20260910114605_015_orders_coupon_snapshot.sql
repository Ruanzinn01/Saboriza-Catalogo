-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260910114605 · md5 normalizado 3509f0ddeebeeb10d1dad0f32652ab91 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
alter table public.orders
  add column subtotal_amount numeric(10,2) not null default 0,
  add column discount_amount numeric(10,2) not null default 0,
  add column coupon_code text not null default '',
  add column coupon_type text not null default '',
  add column coupon_value numeric(10,2) not null default 0;
;
