-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261014020529 · md5 normalizado b921c8204b02b392862ad857ed983496 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create or replace function private.expect_return_from_delivery_item()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_order uuid;
  v_product uuid;
  v_ref text;
begin
  if coalesce(new.packs_not_delivered, 0) <= 0 then return new; end if;
  -- só espera retorno quando a mercadoria realmente volta: faltante na carga e entrega por engano não geram retorno
  if new.reason in ('missing', 'delivered_by_mistake') then return new; end if;
  begin
    select d.order_id, coalesce(d.er_code, '') into v_order, v_ref from public.order_deliveries d where d.id = new.delivery_id;
    select oi.product_id into v_product from public.order_items oi where oi.id = new.order_item_id;
    if v_product is null or v_order is null then return new; end if;
    insert into public.stock_returns (company_id, unit_id, source, source_ref, order_id, delivery_item_id, product_id, expected_units)
    values (new.company_id, (select u.id from public.units u where u.company_id = new.company_id and u.status = 'ACTIVE' order by u.created_at limit 1),
            'PARTIAL_DELIVERY', 'Entrega ' || v_ref, v_order, new.id, v_product, new.packs_not_delivered * greatest(new.pack_quantity, 1))
    on conflict do nothing;
  exception when others then
    raise warning 'retorno esperado não registrado: %', sqlerrm;
  end;
  return new;
end;
$$;
