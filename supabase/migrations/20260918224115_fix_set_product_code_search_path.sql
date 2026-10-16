-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260918224115 · md5 normalizado ba568fabc2c42232c46ebb02081ddc1c · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

create or replace function public.set_product_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'PRD-' || lpad(nextval('public.products_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;
;
