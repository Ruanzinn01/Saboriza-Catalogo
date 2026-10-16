-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260910171156 · md5 normalizado 5f723db445019a397176c2d26596766c · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create or replace function public.create_order(
  p_customer_name text,
  p_company_name text,
  p_phone text,
  p_items jsonb,
  p_customer_trade_name text default ''::text,
  p_customer_cnpj text default ''::text,
  p_customer_ie text default ''::text,
  p_customer_email text default ''::text,
  p_customer_address text default ''::text,
  p_customer_neighborhood text default ''::text,
  p_customer_cep text default ''::text,
  p_customer_city text default ''::text,
  p_customer_state text default ''::text,
  p_coupon_code text default ''::text,
  p_customer_id uuid default null
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
  v_customer public.customers%rowtype;
  v_customer_id uuid := p_customer_id;
  v_trade_name text := coalesce(p_customer_trade_name, '');
  v_cnpj text := coalesce(p_customer_cnpj, '');
  v_ie text := coalesce(p_customer_ie, '');
  v_email text := coalesce(p_customer_email, '');
  v_address text := coalesce(p_customer_address, '');
  v_neighborhood text := coalesce(p_customer_neighborhood, '');
  v_cep text := coalesce(p_customer_cep, '');
  v_city text := coalesce(p_customer_city, '');
  v_state text := coalesce(p_customer_state, '');
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

  -- Reconhecimento automático de empresa ja cadastrada pelo nome (checkout publico
  -- nao envia customer_id; o Admin, ao selecionar cliente existente, ja envia).
  if v_customer_id is null and coalesce(trim(p_company_name), '') <> '' then
    select id into v_customer_id
      from public.customers
      where lower(trim(company_name)) = lower(trim(p_company_name))
      limit 1;
  end if;

  if v_customer_id is not null then
    select * into v_customer from public.customers where id = v_customer_id;
    if found then
      v_trade_name := coalesce(nullif(trim(v_trade_name), ''), v_customer.trade_name);
      v_cnpj := coalesce(nullif(trim(v_cnpj), ''), v_customer.cnpj);
      v_ie := coalesce(nullif(trim(v_ie), ''), v_customer.ie);
      v_email := coalesce(nullif(trim(v_email), ''), v_customer.email);
      v_address := coalesce(nullif(trim(v_address), ''), v_customer.address);
      v_neighborhood := coalesce(nullif(trim(v_neighborhood), ''), v_customer.neighborhood);
      v_cep := coalesce(nullif(trim(v_cep), ''), v_customer.cep);
      v_city := coalesce(nullif(trim(v_city), ''), v_customer.city);
      v_state := coalesce(nullif(trim(v_state), ''), v_customer.state);
    else
      v_customer_id := null;
    end if;
  end if;

  insert into public.orders (
    customer_name, company_name, phone, status, customer_id,
    customer_trade_name, customer_cnpj, customer_ie, customer_email,
    customer_address, customer_neighborhood, customer_cep, customer_city, customer_state
  )
  values (
    p_customer_name, coalesce(p_company_name, ''), p_phone, 'NEW', v_customer_id,
    v_trade_name, v_cnpj, v_ie, v_email,
    v_address, v_neighborhood, v_cep, v_city, v_state
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
$function$;
