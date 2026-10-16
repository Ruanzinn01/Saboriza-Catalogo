-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930185955 · md5 normalizado b4724e865545f0b3237981cb0fc4df00 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create or replace function public.create_production_release(
  p_product_id uuid,
  p_packs_quantity integer,
  p_reason text default null,
  p_note text default null,
  p_urgent_demand_id uuid default null,
  p_idempotency_key text default null
) returns public.production_releases
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_product public.products;
  v_units integer;
  v_release public.production_releases;
  v_company uuid := private.default_company_id();
begin
  if p_idempotency_key is not null then
    select * into v_release from public.production_releases
      where company_id = v_company and idempotency_key = p_idempotency_key;
    if found then
      return v_release;
    end if;
  end if;

  if p_packs_quantity is null or p_packs_quantity <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
  end if;

  select * into v_product from public.products where id = p_product_id and active = true;
  if not found then
    raise exception 'Produto nao encontrado ou inativo';
  end if;

  v_units := p_packs_quantity * v_product.pack_quantity;

  insert into public.production_releases (
    product_id, requested_packs, requested_units, reason, note, urgent_demand_id, idempotency_key
  ) values (
    p_product_id, p_packs_quantity, v_units, p_reason, nullif(p_note, ''), p_urgent_demand_id, coalesce(p_idempotency_key, gen_random_uuid()::text)
  ) returning * into v_release;

  insert into public.floor_executions (
    product_id, production_release_id, target_quantity
  ) values (
    p_product_id, v_release.id, v_units
  );

  return v_release;
end;
$$;

revoke execute on function public.create_production_release(uuid, integer, text, text, uuid, text) from anon;
