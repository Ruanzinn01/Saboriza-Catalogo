-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260910114627 · md5 normalizado afdbab621985f615fca2112b68d4e508 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_name text,
  p_company_name text,
  p_phone text,
  p_items jsonb,
  p_customer_trade_name text DEFAULT '',
  p_customer_cnpj text DEFAULT '',
  p_customer_ie text DEFAULT '',
  p_customer_email text DEFAULT '',
  p_customer_address text DEFAULT '',
  p_customer_neighborhood text DEFAULT '',
  p_customer_cep text DEFAULT '',
  p_customer_city text DEFAULT '',
  p_customer_state text DEFAULT '',
  p_coupon_code text DEFAULT ''
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order public.orders;
  v_item jsonb;
  v_product public.products%rowtype;
  v_coupon public.coupons%rowtype;
  v_subtotal numeric(10,2) := 0;
  v_discount numeric(10,2) := 0;
  v_coupon_code text := '';
  v_coupon_type text := '';
  v_coupon_value numeric(10,2) := 0;
  v_total_units integer := 0;
  v_line_units integer;
  v_line_total numeric(10,2);
  v_items jsonb := '[]'::jsonb;
  v_item_row public.order_items;
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

  insert into public.orders (
    customer_name, company_name, phone, status,
    customer_trade_name, customer_cnpj, customer_ie, customer_email,
    customer_address, customer_neighborhood, customer_cep, customer_city, customer_state
  )
  values (
    p_customer_name, coalesce(p_company_name, ''), p_phone, 'NEW',
    coalesce(p_customer_trade_name, ''), coalesce(p_customer_cnpj, ''), coalesce(p_customer_ie, ''), coalesce(p_customer_email, ''),
    coalesce(p_customer_address, ''), coalesce(p_customer_neighborhood, ''), coalesce(p_customer_cep, ''), coalesce(p_customer_city, ''), coalesce(p_customer_state, '')
  )
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
    )
    returning * into v_item_row;

    v_items := v_items || to_jsonb(v_item_row);

    v_subtotal := v_subtotal + v_line_total;
    v_total_units := v_total_units + v_line_units;
  end loop;

  if coalesce(trim(p_coupon_code), '') <> '' then
    select * into v_coupon
      from public.coupons
      where code = upper(trim(p_coupon_code))
        and is_active = true;

    if found then
      v_coupon_code := v_coupon.code;
      v_coupon_type := v_coupon.discount_type;
      v_coupon_value := v_coupon.discount_value;

      if v_coupon.discount_type = 'percentage' then
        v_discount := round(v_subtotal * v_coupon.discount_value / 100, 2);
      else
        v_discount := v_coupon.discount_value;
      end if;

      if v_discount > v_subtotal then
        v_discount := v_subtotal;
      end if;
    end if;
  end if;

  update public.orders
    set subtotal_amount = v_subtotal,
        discount_amount = v_discount,
        coupon_code = v_coupon_code,
        coupon_type = v_coupon_type,
        coupon_value = v_coupon_value,
        total_amount = v_subtotal - v_discount,
        total_units = v_total_units
    where id = v_order.id
    returning * into v_order;

  return to_jsonb(v_order) || jsonb_build_object('items', v_items);
end;
$function$
;
