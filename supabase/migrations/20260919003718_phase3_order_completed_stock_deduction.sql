-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260919003718 · md5 normalizado b78d2bd9f3b30885e112eba26706816a · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Tarefa 3.7: pedido concluido (COMPLETED) gera baixa automatica em unidades fisicas.
-- Fisico ja saiu da fabrica: baixa sempre integral, pode deixar saldo negativo
-- (sinaliza deficit a repor), nunca bloqueia a conclusao do pedido.
create or replace function public.handle_order_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_product public.products;
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

    update public.products
      set current_stock = current_stock - v_item.total_units
      where id = v_item.product_id;

    insert into public.stock_movements (
      product_id, variation, origin, reference_id, previous_balance, new_balance, observation
    ) values (
      v_item.product_id, -v_item.total_units, 'order', new.id,
      v_product.current_stock, v_product.current_stock - v_item.total_units, 'Pedido ' || new.order_number
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_order_completed_stock on public.orders;
create trigger trg_order_completed_stock
  after update on public.orders
  for each row
  execute function public.handle_order_completed();
;
