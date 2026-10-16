-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260911023040 · md5 normalizado 68673d238f3d8aa016230c7ee8fdb942 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create or replace function public.update_order_items(
  p_order_id uuid,
  p_items jsonb,
  p_coupon_code text default ''::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  delete from public.order_items where order_id = p_order_id;

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
      p_order_id, v_product.id, v_product.name, v_product.presentation, v_product.weight_volume,
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
        total_units = v_total_units,
        updated_at = now()
    where id = p_order_id
    returning * into v_order;

  return to_jsonb(v_order) || jsonb_build_object('items', v_items);
end;
$function$;
