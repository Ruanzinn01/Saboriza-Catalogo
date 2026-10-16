-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260928203439 · md5 normalizado ee31d141ab1be0648b4099e667b47810 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- Correção: handle_separation_finished()/handle_order_cancelled_reversal() dependiam
-- implicitamente de auth.uid() (via DEFAULT da coluna) pra preencher company_id/unit_id do
-- stock_movements. Isso é frágil dentro de uma trigger SECURITY DEFINER (não deveria depender
-- de sessão/JWT). Corrigido pra usar explicitamente new.company_id do próprio pedido, e resolver
-- unit_id direto da unidade ativa da empresa — sem depender de contexto de sessão.

begin;

create or replace function public.handle_separation_finished()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_item record;
  v_product public.products%rowtype;
  v_unit_id uuid;
begin
  select id into v_unit_id from public.units where company_id = new.company_id and status = 'ACTIVE' order by created_at asc limit 1;

  for v_item in select * from public.order_items where order_id = new.id
  loop
    select * into v_product from public.products where id = v_item.product_id for update;
    if not found then
      continue;
    end if;

    update public.products
      set current_stock = greatest(current_stock - v_item.total_units, 0)
      where id = v_item.product_id;

    insert into public.stock_movements (
      product_id, variation, origin, reference_id, previous_balance, new_balance, observation,
      company_id, unit_id
    ) values (
      v_item.product_id, -v_item.total_units, 'order', new.id,
      v_product.current_stock, greatest(v_product.current_stock - v_item.total_units, 0),
      'Baixa por separação finalizada — pedido ' || new.order_number,
      new.company_id, v_unit_id
    );
  end loop;
  return new;
end;
$function$;

create or replace function public.handle_order_cancelled_reversal()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_move record;
  v_product public.products%rowtype;
  v_already_reversed boolean;
  v_unit_id uuid;
begin
  select exists(
    select 1 from public.stock_movements
    where origin = 'order_cancel_reversal' and reference_id = new.id
  ) into v_already_reversed;

  if v_already_reversed then
    return new;
  end if;

  select id into v_unit_id from public.units where company_id = new.company_id and status = 'ACTIVE' order by created_at asc limit 1;

  for v_move in
    select product_id, sum(variation) as total_variation
    from public.stock_movements
    where origin = 'order' and reference_id = new.id
    group by product_id
    having sum(variation) <> 0
  loop
    select * into v_product from public.products where id = v_move.product_id for update;
    if not found then
      continue;
    end if;

    update public.products
      set current_stock = greatest(current_stock - v_move.total_variation, 0)
      where id = v_move.product_id;

    insert into public.stock_movements (
      product_id, variation, origin, reference_id, previous_balance, new_balance, observation,
      company_id, unit_id
    ) values (
      v_move.product_id, -v_move.total_variation, 'order_cancel_reversal', new.id,
      v_product.current_stock, greatest(v_product.current_stock - v_move.total_variation, 0),
      'Estorno automático — pedido ' || new.order_number || ' cancelado após separação',
      new.company_id, v_unit_id
    );
  end loop;
  return new;
end;
$function$;

commit;
;
