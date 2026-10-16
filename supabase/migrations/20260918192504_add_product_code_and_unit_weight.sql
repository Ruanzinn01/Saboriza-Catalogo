-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260918192504 · md5 normalizado 9ea3b30dc13a16ccffb7e4042b404285 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Código sequencial do produto, mesmo padrão de MTP das matérias-primas
alter table public.products add column if not exists code text unique;
alter table public.products add column if not exists unit_weight_grams numeric check (unit_weight_grams is null or unit_weight_grams > 0);

create sequence if not exists products_code_seq;

create or replace function public.set_product_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'PRD-' || lpad(nextval('products_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_product_code on public.products;
create trigger trg_set_product_code
  before insert on public.products
  for each row
  execute function public.set_product_code();

-- Backfill dos produtos existentes, na ordem de criação
update public.products
set code = 'PRD-' || lpad(nextval('products_code_seq')::text, 4, '0')
where code is null;

-- Peso por unidade: parse conservador do texto livre existente (g/kg/ml/L), deixa nulo quando ambíguo
update public.products
set unit_weight_grams = case
  when weight_volume ~* '^\s*([0-9]+([.,][0-9]+)?)\s*kg\s*$'
    then replace(substring(weight_volume from '([0-9]+([.,][0-9]+)?)'), ',', '.')::numeric * 1000
  when weight_volume ~* '^\s*([0-9]+([.,][0-9]+)?)\s*g\s*$'
    then replace(substring(weight_volume from '([0-9]+([.,][0-9]+)?)'), ',', '.')::numeric
  when weight_volume ~* '^\s*([0-9]+([.,][0-9]+)?)\s*(ml|l)\s*$'
    then replace(substring(weight_volume from '([0-9]+([.,][0-9]+)?)'), ',', '.')::numeric *
      case when weight_volume ~* 'l$' and weight_volume !~* 'ml$' then 1000 else 1 end
  else null
end
where unit_weight_grams is null;
;
