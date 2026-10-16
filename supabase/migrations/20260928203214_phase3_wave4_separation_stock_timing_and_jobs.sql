-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260928203214 · md5 normalizado ebdab94c480e32b109fec90c7c16b8eb · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- ÓRIS360 — Onda 3 — decisão 4.2 aplicada: baixa física de estoque passa a ocorrer quando a
-- Separação termina (separation_finished_at: null -> not null), não mais quando orders.status
-- vira COMPLETED (Faturar). Faturar deixa de ter efeito colateral em estoque.
-- + estorno automático se o pedido for cancelado depois de já ter baixado.
-- + separation_jobs / loading_jobs como entidades próprias (espelho, somente leitura por ora —
--   frontend continua lendo/escrevendo os campos de orders como já faz; nenhuma tela muda).
-- Verificado antes de aplicar: os 8 pedidos reais com separation_finished_at preenchido já
-- tinham baixado estoque (nenhum caso órfão precisando de baixa retroativa manual).

begin;

-- 0) novo motivo de movimentação, pro estorno ficar rastreável e distinto de ajuste manual
alter table public.stock_movements drop constraint if exists stock_movements_origin_check;
alter table public.stock_movements add constraint stock_movements_origin_check
  check (origin = any (array['production','entry','order','adjustment','order_cancel_reversal']));

-- 1) baixa de estoque migra de status=COMPLETED para separation_finished_at (null -> not null)
create or replace function public.handle_separation_finished()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_item record;
  v_product public.products%rowtype;
begin
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
      product_id, variation, origin, reference_id, previous_balance, new_balance, observation
    ) values (
      v_item.product_id, -v_item.total_units, 'order', new.id,
      v_product.current_stock, greatest(v_product.current_stock - v_item.total_units, 0),
      'Baixa por separação finalizada — pedido ' || new.order_number
    );
  end loop;
  return new;
end;
$function$;

drop trigger if exists trg_separation_finished_stock on public.orders;
create trigger trg_separation_finished_stock
  after update on public.orders
  for each row
  when (old.separation_finished_at is null and new.separation_finished_at is not null)
  execute function public.handle_separation_finished();

-- Desativa o gatilho antigo (status=COMPLETED) SEM apagar — nunca os dois ativos ao mesmo tempo.
alter table public.orders disable trigger trg_order_completed_stock;

-- 2) estorno automático: cancelamento após separação já ter baixado
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
begin
  select exists(
    select 1 from public.stock_movements
    where origin = 'order_cancel_reversal' and reference_id = new.id
  ) into v_already_reversed;

  if v_already_reversed then
    return new;
  end if;

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
      product_id, variation, origin, reference_id, previous_balance, new_balance, observation
    ) values (
      v_move.product_id, -v_move.total_variation, 'order_cancel_reversal', new.id,
      v_product.current_stock, greatest(v_product.current_stock - v_move.total_variation, 0),
      'Estorno automático — pedido ' || new.order_number || ' cancelado após separação'
    );
  end loop;
  return new;
end;
$function$;

drop trigger if exists trg_order_cancelled_reversal on public.orders;
create trigger trg_order_cancelled_reversal
  after update on public.orders
  for each row
  when (new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED' and old.separation_finished_at is not null)
  execute function public.handle_order_cancelled_reversal();

-- 3) separation_jobs / loading_jobs — entidade própria (espelho de orders, company/unit-aware).
-- Frontend continua lendo/escrevendo os campos de orders normalmente; nada muda na UI agora.
-- Isso só formaliza o domínio (ADR-005) sem forçar reescrita de separation-store/fulfillment-store.

create table if not exists public.separation_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  status text not null default 'NA_FILA' check (status in ('NA_FILA','EM_SEPARACAO','FINALIZADA','CANCELADA')),
  queued_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  responsible text,
  started_by text,
  completed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id),
  foreign key (company_id, unit_id) references public.units(company_id, id),
  foreign key (company_id, order_id) references public.orders(company_id, id)
);
create index if not exists separation_jobs_company_idx on public.separation_jobs(company_id, status);

create table if not exists public.loading_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  status text not null default 'NA_FILA' check (status in ('NA_FILA','EM_CARREGAMENTO','FINALIZADA','CANCELADA')),
  queued_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  responsible text,
  started_by text,
  completed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id),
  foreign key (company_id, unit_id) references public.units(company_id, id),
  foreign key (company_id, order_id) references public.orders(company_id, id)
);
create index if not exists loading_jobs_company_idx on public.loading_jobs(company_id, status);

create or replace function private.sync_separation_job()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_unit_id uuid;
  v_status text;
begin
  select id into v_unit_id from public.units where company_id = new.company_id and name = 'Matriz' limit 1;

  v_status := case
    when new.status = 'CANCELLED' then 'CANCELADA'
    when new.separation_finished_at is not null then 'FINALIZADA'
    when new.separation_responsible is not null then 'EM_SEPARACAO'
    else 'NA_FILA'
  end;

  if new.separation_queued_at is null then
    return new;
  end if;

  insert into public.separation_jobs (
    company_id, unit_id, order_id, status, queued_at, started_at, finished_at,
    responsible, started_by, completed_by, updated_at
  ) values (
    new.company_id, v_unit_id, new.id, v_status, new.separation_queued_at, new.separation_started_at,
    new.separation_finished_at, new.separation_responsible, new.separation_started_by,
    new.separation_completed_by, now()
  )
  on conflict (order_id) do update set
    status = excluded.status,
    queued_at = excluded.queued_at,
    started_at = excluded.started_at,
    finished_at = excluded.finished_at,
    responsible = excluded.responsible,
    started_by = excluded.started_by,
    completed_by = excluded.completed_by,
    updated_at = now();
  return new;
end;
$$;

create or replace function private.sync_loading_job()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_unit_id uuid;
  v_status text;
begin
  select id into v_unit_id from public.units where company_id = new.company_id and name = 'Matriz' limit 1;

  v_status := case
    when new.status = 'CANCELLED' then 'CANCELADA'
    when new.loading_finished_at is not null then 'FINALIZADA'
    when new.loading_responsible is not null then 'EM_CARREGAMENTO'
    else 'NA_FILA'
  end;

  if new.loading_queued_at is null then
    return new;
  end if;

  insert into public.loading_jobs (
    company_id, unit_id, order_id, status, queued_at, started_at, finished_at,
    responsible, started_by, completed_by, updated_at
  ) values (
    new.company_id, v_unit_id, new.id, v_status, new.loading_queued_at, new.loading_started_at,
    new.loading_finished_at, new.loading_responsible, new.loading_started_by,
    new.loading_completed_by, now()
  )
  on conflict (order_id) do update set
    status = excluded.status,
    queued_at = excluded.queued_at,
    started_at = excluded.started_at,
    finished_at = excluded.finished_at,
    responsible = excluded.responsible,
    started_by = excluded.started_by,
    completed_by = excluded.completed_by,
    updated_at = now();
  return new;
end;
$$;

revoke all on function private.sync_separation_job() from public,anon,authenticated;
revoke all on function private.sync_loading_job() from public,anon,authenticated;

drop trigger if exists orders_sync_separation_job on public.orders;
create trigger orders_sync_separation_job
  after insert or update on public.orders
  for each row execute function private.sync_separation_job();

drop trigger if exists orders_sync_loading_job on public.orders;
create trigger orders_sync_loading_job
  after insert or update on public.orders
  for each row execute function private.sync_loading_job();

alter table public.separation_jobs enable row level security;
alter table public.loading_jobs enable row level security;
revoke all on public.separation_jobs from anon,authenticated;
revoke all on public.loading_jobs from anon,authenticated;
grant select on public.separation_jobs to authenticated;
grant select on public.loading_jobs to authenticated;

create policy separation_jobs_select on public.separation_jobs for select to authenticated
  using ((select private.is_active_company_member(company_id)));
create policy loading_jobs_select on public.loading_jobs for select to authenticated
  using ((select private.is_active_company_member(company_id)));

-- Backfill: popula separation_jobs/loading_jobs pra todos os pedidos reais já existentes,
-- disparando os triggers via UPDATE inofensivo (toca updated_at, não muda regra de negócio).
update public.orders set updated_at = updated_at;

commit;
;
