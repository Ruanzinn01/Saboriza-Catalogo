-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261001203003 · md5 normalizado abec0a2ec3a0505521001d14cd6b1e3e · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- 1) Slug publico por empresa + flag de empresa padrao (compat com rotas legadas sem slug)
alter table public.companies add column if not exists slug text;
alter table public.companies add column if not exists is_default boolean not null default false;

update public.companies
set slug = lower(regexp_replace(regexp_replace(display_name, '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'))
where slug is null;

update public.companies set is_default = true where display_name = 'Saboriza';

alter table public.companies alter column slug set not null;
create unique index if not exists companies_slug_key on public.companies (slug);

-- 2) create_platform_company passa a gerar slug unico + criar linha inicial de settings pra empresa nova
create or replace function public.create_platform_company(p_display_name text, p_legal_name text DEFAULT NULL::text, p_document text DEFAULT NULL::text, p_segment text DEFAULT 'GERAL'::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  new_id uuid;
  base_slug text;
  final_slug text;
  suffix int := 1;
begin
  if not exists (select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  if p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'nome da empresa é obrigatório';
  end if;

  base_slug := lower(regexp_replace(regexp_replace(trim(p_display_name), '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'));
  final_slug := base_slug;
  while exists (select 1 from companies where slug = final_slug) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix::text;
  end loop;

  insert into companies (display_name, legal_name, document, segment, status, slug)
  values (p_display_name, nullif(p_legal_name, ''), nullif(p_document, ''), coalesce(nullif(p_segment, ''), 'GERAL'), 'ACTIVE', final_slug)
  returning id into new_id;

  insert into settings (company_id, fantasy_name, factory_name)
  values (new_id, p_display_name, p_display_name);

  return new_id;
end;
$function$;

-- 3) companies legivel publicamente (so pra resolver slug -> empresa no site publico), mesmo nivel de
--    exposicao que settings_public_select ja tinha (qual = true) nesse projeto.
drop policy if exists companies_public_select on public.companies;
create policy companies_public_select on public.companies
  for select
  using (status = 'ACTIVE');

-- 4) create_order passa a exigir p_company_id e escopar produto/cupom/cliente pela empresa,
--    em vez de depender de default_company_id() (que so funciona pra usuario logado com membership).
create or replace function public.create_order(
  p_company_id uuid,
  p_customer_name text,
  p_company_name text,
  p_phone text,
  p_items jsonb,
  p_customer_trade_name text DEFAULT ''::text,
  p_customer_cnpj text DEFAULT ''::text,
  p_customer_ie text DEFAULT ''::text,
  p_customer_email text DEFAULT ''::text,
  p_customer_address text DEFAULT ''::text,
  p_customer_neighborhood text DEFAULT ''::text,
  p_customer_cep text DEFAULT ''::text,
  p_customer_city text DEFAULT ''::text,
  p_customer_state text DEFAULT ''::text,
  p_coupon_code text DEFAULT ''::text,
  p_customer_id uuid DEFAULT NULL::uuid
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
  if p_company_id is null or not exists (select 1 from public.companies where id = p_company_id and status = 'ACTIVE') then
    raise exception 'Empresa inválida';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrinho vazio';
  end if;
  if coalesce(trim(p_customer_name), '') = '' then
    raise exception 'Nome do cliente é obrigatório';
  end if;
  if coalesce(trim(p_phone), '') = '' then
    raise exception 'Telefone é obrigatório';
  end if;

  if v_customer_id is not null then
    select * into v_customer from public.customers where id = v_customer_id and company_id = p_company_id;
    if not found then
      v_customer_id := null;
    end if;
  end if;

  if v_customer_id is null and coalesce(trim(p_company_name), '') <> '' then
    select id into v_customer_id
      from public.customers
      where company_id = p_company_id
        and lower(trim(company_name)) = lower(trim(p_company_name))
      limit 1;
  end if;

  if v_customer_id is not null then
    select * into v_customer from public.customers where id = v_customer_id and company_id = p_company_id;
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
    company_id, order_number, customer_name, company_name, phone, status, customer_id,
    customer_trade_name, customer_cnpj, customer_ie, customer_email,
    customer_address, customer_neighborhood, customer_cep, customer_city, customer_state
  )
  values (
    p_company_id, '', p_customer_name, coalesce(p_company_name, ''), p_phone, 'NEW', v_customer_id,
    v_trade_name, v_cnpj, v_ie, v_email,
    v_address, v_neighborhood, v_cep, v_city, v_state
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid
        and company_id = p_company_id
        and is_active = true;

    if not found then
      raise exception 'Produto % não encontrado ou indisponível', (v_item->>'product_id');
    end if;

    v_line_units := v_product.pack_quantity * (v_item->>'packs_quantity')::integer;
    v_line_total := v_product.unit_price * v_line_units;

    insert into public.order_items (
      company_id, order_id, product_id, product_name, presentation, weight_volume,
      unit_price, pack_quantity, packs_quantity, total_units, total_price
    ) values (
      p_company_id, v_order.id, v_product.id, v_product.name, v_product.presentation, v_product.weight_volume,
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
      where company_id = p_company_id
        and code = upper(trim(p_coupon_code))
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
    set order_number = '#' || lpad(nextval('order_number_seq')::text, 4, '0'),
        subtotal_amount = v_subtotal,
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
;
