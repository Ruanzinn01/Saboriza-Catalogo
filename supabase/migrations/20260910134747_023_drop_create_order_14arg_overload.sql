-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260910134747 · md5 normalizado 50a6c8073996013f5f509a19d811cb52 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
drop function public.create_order(
  p_customer_name text,
  p_company_name text,
  p_phone text,
  p_items jsonb,
  p_customer_trade_name text,
  p_customer_cnpj text,
  p_customer_ie text,
  p_customer_email text,
  p_customer_address text,
  p_customer_neighborhood text,
  p_customer_cep text,
  p_customer_city text,
  p_customer_state text,
  p_coupon_code text
);
;
