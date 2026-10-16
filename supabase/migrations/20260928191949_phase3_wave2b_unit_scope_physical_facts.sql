-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260928191949 · md5 normalizado ccebc6b0fa7384c83748d6da1477be53 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- ÓRIS360 — Complemento 2 (extensibilidade): ancora Empresa -> Unidade -> Local nos fatos físicos
-- (entrada de insumo, produção, movimentação de estoque), sem construir WMS agora.
-- Aditivo: nullable -> backfill p/ unidade Matriz -> not null -> FK composta anti-vazamento.

begin;

create or replace function private.default_unit_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select u.id
  from public.units u
  join public.memberships m on m.company_id = u.company_id
  where m.user_id = (select auth.uid())
    and m.status = 'ACTIVE'
    and u.status = 'ACTIVE'
  order by m.created_at asc, u.created_at asc
  limit 1
$$;
revoke all on function private.default_unit_id() from public,anon;
grant execute on function private.default_unit_id() to authenticated;

do $$
declare
  v_company_id uuid;
  v_unit_id uuid;
begin
  select id into v_company_id from public.companies where display_name = 'Saboriza' limit 1;
  select id into v_unit_id from public.units where company_id = v_company_id and name = 'Matriz' limit 1;
  if v_company_id is null or v_unit_id is null then
    raise exception 'Empresa Saboriza ou unidade Matriz não encontradas';
  end if;

  alter table public.raw_material_entries add column if not exists unit_id uuid references public.units(id) default private.default_unit_id();
  update public.raw_material_entries set unit_id = v_unit_id where unit_id is null;
  alter table public.raw_material_entries alter column unit_id set not null;
  alter table public.raw_material_entries
    add constraint raw_material_entries_unit_company_fkey foreign key (company_id, unit_id)
      references public.units(company_id, id);
  create index if not exists raw_material_entries_unit_idx on public.raw_material_entries(unit_id);

  alter table public.production_records add column if not exists unit_id uuid references public.units(id) default private.default_unit_id();
  update public.production_records set unit_id = v_unit_id where unit_id is null;
  alter table public.production_records alter column unit_id set not null;
  alter table public.production_records
    add constraint production_records_unit_company_fkey foreign key (company_id, unit_id)
      references public.units(company_id, id);
  create index if not exists production_records_unit_idx on public.production_records(unit_id);

  alter table public.stock_movements add column if not exists unit_id uuid references public.units(id) default private.default_unit_id();
  update public.stock_movements set unit_id = v_unit_id where unit_id is null;
  alter table public.stock_movements alter column unit_id set not null;
  alter table public.stock_movements
    add constraint stock_movements_unit_company_fkey foreign key (company_id, unit_id)
      references public.units(company_id, id);
  create index if not exists stock_movements_unit_idx on public.stock_movements(unit_id);
end $$;

commit;
;
