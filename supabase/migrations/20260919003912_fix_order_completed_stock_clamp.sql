-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260919003912 · md5 normalizado 86af89061fe07b7d0ce7eed93a94f82a · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Corrige handle_order_completed: current_stock tem check >= 0 (regra geral,
-- Principio #8). Baixa por pedido clampa em zero igual a producao, nunca bloqueia
-- a conclusao do pedido. O deficit fica visivel comparando total_units pedido
-- com a variacao efetivamente registrada no movimento.
create or replace function public.handle_order_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_product public.products;
  v_deducted numeric;
begin
  if new.status <> 'COMPLETED' or old.status is not distinct from 'COMPLETED' then
    return new;
  end if;

  for v_item in
    select product_id, total_units from public.order_items
    where order_id = new.id and product_id is not null
  loop
    select * into v_product from public.products where id = v_item.product_id for update;
    if not found then
      continue;
    end if;

    v_deducted := least(v_item.total_units, v_product.current_stock);

    update public.products
      set current_stock = v_product.current_stock - v_deducted
      where id = v_item.product_id;

    insert into public.stock_movements (
      product_id, variation, origin, reference_id, previous_balance, new_balance, observation
    ) values (
      v_item.product_id, -v_deducted, 'order', new.id,
      v_product.current_stock, v_product.current_stock - v_deducted,
      case
        when v_deducted < v_item.total_units then 'Pedido ' || new.order_number || ' — estoque insuficiente, baixou até zero (pedido de ' || v_item.total_units || ' un)'
        else 'Pedido ' || new.order_number
      end
    );
  end loop;

  return new;
end;
$$;
;
