-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260909232137 · md5 normalizado 4f296a440a5c96edfbeee2c1ae8c17cc · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create or replace function public.create_order(
  p_customer_name text,
  p_company_name text,
  p_phone text,
  p_items jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_product public.products%rowtype;
  v_total_amount numeric(10,2) := 0;
  v_total_units integer := 0;
  v_line_units integer;
  v_line_total numeric(10,2);
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrinho vazio';
  end if;
  if coalesce(trim(p_customer_name), '') = '' then
    raise exception 'Nome do cliente é obrigatório';
  end if;
  if coalesce(trim(p_phone), '') = '' then
    raise exception 'Telefone é obrigatório';
  end if;

  insert into public.orders (customer_name, company_name, phone, status)
  values (p_customer_name, coalesce(p_company_name, ''), p_phone, 'NEW')
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid
        and is_active = true;

    if not found then
      raise exception 'Produto % não encontrado ou indisponível', (v_item->>'product_id');
    end if;

    v_line_units := v_product.pack_quantity * (v_item->>'packs_quantity')::integer;
    v_line_total := v_product.unit_price * v_line_units;

    insert into public.order_items (
      order_id, product_id, product_name, presentation, weight_volume,
      unit_price, pack_quantity, packs_quantity, total_units, total_price
    ) values (
      v_order.id, v_product.id, v_product.name, v_product.presentation, v_product.weight_volume,
      v_product.unit_price, v_product.pack_quantity, (v_item->>'packs_quantity')::integer,
      v_line_units, v_line_total
    );

    v_total_amount := v_total_amount + v_line_total;
    v_total_units := v_total_units + v_line_units;
  end loop;

  update public.orders
    set total_amount = v_total_amount, total_units = v_total_units
    where id = v_order.id
    returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.create_order(text, text, text, jsonb) from public;
grant execute on function public.create_order(text, text, text, jsonb) to anon, authenticated;
;
