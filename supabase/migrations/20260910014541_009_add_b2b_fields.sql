-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260910014541 · md5 normalizado 3f817c05534e731ff86e704ec53909ca · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
alter table public.orders
  add column customer_trade_name text not null default '',
  add column customer_cnpj text not null default '',
  add column customer_ie text not null default '',
  add column customer_email text not null default '',
  add column customer_address text not null default '',
  add column customer_neighborhood text not null default '',
  add column customer_cep text not null default '',
  add column customer_city text not null default '',
  add column customer_state text not null default '',
  add column payment_terms text not null default '';

alter table public.settings
  add column legal_name text not null default '',
  add column cnpj text not null default '';
;
