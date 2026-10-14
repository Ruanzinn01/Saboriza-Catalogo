-- Separa Confere / Inventário: sessões oficiais, lista congelada, fotografia de saldo e contagem cega.
-- Contar NÃO ajusta saldo: nenhuma função aqui altera products.current_stock nem raw_materials.current_stock.

insert into public.permissions (key, name, description, sensitivity)
values ('estoque.inventario.gerenciar', 'Gerenciar inventário', 'Programar, iniciar, recontar e encerrar sessões de inventário', 'SENSITIVE')
on conflict (key) do nothing;

insert into public.role_permissions (company_id, role_id, permission_key)
select r.company_id, r.id, 'estoque.inventario.gerenciar'
from public.roles r
where r.key = 'OWNER'
on conflict do nothing;

create or replace function private.inventory_can_manage(p_company_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select (select private.is_active_company_member(p_company_id))
     and (select private.has_permission(p_company_id, 'estoque.inventario.gerenciar'))
$$;

create table public.inventory_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  unit_id uuid not null references public.units(id),
  modality text not null check (modality in ('SCHEDULED', 'EXTRAORDINARY')),
  scope_kind text not null default 'ALL' check (scope_kind in ('ALL', 'PRODUCTS', 'RAW_MATERIALS')),
  competence date not null,
  location_label text not null default '',
  reason text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED', 'OPEN', 'CLOSED', 'CLOSED_INCOMPLETE')),
  opened_by uuid default auth.uid(),
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index inventory_sessions_company_status_idx on public.inventory_sessions (company_id, status);

create table public.inventory_session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.inventory_sessions(id) on delete cascade,
  company_id uuid not null,
  item_type text not null check (item_type in ('PRODUCT', 'RAW_MATERIAL')),
  item_id uuid not null,
  group_no smallint not null check (group_no in (1, 2)),
  recount_requested boolean not null default false,
  assigned_to uuid,
  assigned_until timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, item_type, item_id)
);
create index inventory_session_items_session_idx on public.inventory_session_items (session_id, group_no);

create table public.inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_item_id uuid not null references public.inventory_session_items(id) on delete cascade,
  company_id uuid not null,
  balance numeric not null,
  taken_at timestamptz not null default now(),
  taken_by uuid not null default auth.uid(),
  consumed_at timestamptz
);

create table public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.inventory_sessions(id) on delete cascade,
  session_item_id uuid not null references public.inventory_session_items(id) on delete cascade,
  company_id uuid not null,
  unit_id uuid not null,
  round smallint not null default 1,
  recount_of uuid references public.inventory_counts(id),
  entered_quantity numeric not null check (entered_quantity >= 0),
  entered_unit text not null check (entered_unit in ('BASE', 'PACK')),
  conversion_factor numeric not null check (conversion_factor > 0),
  base_quantity numeric not null check (base_quantity >= 0),
  zero_confirmed boolean not null default false,
  expected_balance numeric not null,
  snapshot_id uuid not null references public.inventory_snapshots(id),
  difference numeric not null,
  counted_by uuid not null,
  counted_by_name text not null default '',
  counted_at timestamptz not null default now(),
  command_id uuid not null,
  unique (session_item_id, round),
  unique (company_id, command_id)
);
create index inventory_counts_session_idx on public.inventory_counts (session_id);

alter table public.inventory_sessions enable row level security;
alter table public.inventory_session_items enable row level security;
alter table public.inventory_snapshots enable row level security;
alter table public.inventory_counts enable row level security;

-- Sessão e lista (sem saldo) legíveis por membros ativos; snapshots e contagens (têm saldo esperado) só por gestor.
create policy inventory_sessions_select on public.inventory_sessions
  for select using ((select private.is_active_company_member(company_id)));
create policy inventory_session_items_select on public.inventory_session_items
  for select using ((select private.is_active_company_member(company_id)));
create policy inventory_snapshots_select_manager on public.inventory_snapshots
  for select using ((select private.inventory_can_manage(company_id)));
create policy inventory_counts_select_manager on public.inventory_counts
  for select using ((select private.inventory_can_manage(company_id)));

create or replace function private.inventory_freeze_items(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  s public.inventory_sessions;
begin
  select * into s from public.inventory_sessions where id = p_session_id;

  if s.scope_kind in ('ALL', 'PRODUCTS') then
    insert into public.inventory_session_items (session_id, company_id, item_type, item_id, group_no)
    select s.id, s.company_id, 'PRODUCT', p.id, 1
    from public.products p
    where p.company_id = s.company_id
      and ((p.is_active and p.current_stock >= 0) or (not p.is_active and p.current_stock > 0))
    on conflict do nothing;
  end if;

  if s.scope_kind in ('ALL', 'RAW_MATERIALS') then
    insert into public.inventory_session_items (session_id, company_id, item_type, item_id, group_no)
    select s.id, s.company_id, 'RAW_MATERIAL', r.id, 2
    from public.raw_materials r
    where r.company_id = s.company_id
      and ((r.is_active and r.current_stock >= 0) or (not r.is_active and r.current_stock > 0))
    on conflict do nothing;
  end if;
end;
$$;

-- Abre sessões programadas cujo início já passou e encerra incompletas as vencidas (sem marcar itens).
create or replace function private.inventory_sync_sessions(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  s record;
begin
  for s in
    select id from public.inventory_sessions
    where company_id = p_company_id and status = 'SCHEDULED' and starts_at <= now()
    for update skip locked
  loop
    update public.inventory_sessions set status = 'OPEN' where id = s.id;
    perform private.inventory_freeze_items(s.id);
  end loop;

  update public.inventory_sessions
    set status = 'CLOSED_INCOMPLETE', closed_at = now()
    where company_id = p_company_id and status = 'OPEN' and ends_at < now()
      and exists (
        select 1 from public.inventory_session_items i
        where i.session_id = inventory_sessions.id
          and not exists (select 1 from public.inventory_counts c where c.session_item_id = i.id)
      );
  update public.inventory_sessions
    set status = 'CLOSED', closed_at = now()
    where company_id = p_company_id and status = 'OPEN' and ends_at < now();
end;
$$;

-- Dados do cadastro oficial de cada item (nunca copiados para um segundo cadastro).
create or replace function private.inventory_item_info(p_item_type text, p_item_id uuid)
returns table (
  name text, presentation text, kind_label text, sku text, image_url text,
  base_unit text, pack_label text, pack_factor numeric, divisible boolean, balance numeric, is_active boolean
)
language plpgsql
stable security definer
set search_path to ''
as $$
begin
  if p_item_type = 'PRODUCT' then
    return query
    select p.name, trim(p.presentation || ' ' || p.weight_volume), 'Produto'::text,
           coalesce(p.code, p.gtin), p.image_url,
           'unidade'::text,
           case when p.pack_quantity > 1 then 'pack de ' || p.pack_quantity::text else null end,
           case when p.pack_quantity > 1 then p.pack_quantity::numeric else null end,
           false, p.current_stock::numeric, p.is_active
    from public.products p where p.id = p_item_id;
  else
    return query
    select r.name, r.description, coalesce(nullif(r.category, ''), 'Matéria-prima'),
           r.code, r.image_url,
           r.control_unit,
           case when r.purchase_unit_factor > 1 then r.purchase_unit_label || ' de ' || r.purchase_unit_factor::text || ' ' || r.control_unit else null end,
           case when r.purchase_unit_factor > 1 then r.purchase_unit_factor::numeric else null end,
           lower(r.control_unit) not in ('un', 'und', 'unid', 'unidade', 'pç', 'pc', 'rolo', 'saco', 'cx', 'caixa'),
           r.current_stock::numeric, r.is_active
    from public.raw_materials r where r.id = p_item_id;
  end if;
end;
$$;

create or replace function public.inventory_create_session(
  p_unit_id uuid,
  p_modality text,
  p_scope_kind text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text,
  p_location_label text default ''
) returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_start timestamptz;
  v_id uuid;
  v_tz text;
begin
  select u.company_id, u.timezone into v_company, v_tz from public.units u where u.id = p_unit_id;
  if v_company is null then raise exception 'Unidade não encontrada'; end if;
  if not (select private.inventory_can_manage(v_company)) then raise exception 'Sem permissão para gerenciar inventário'; end if;
  if not (select private.can_access_unit(v_company, p_unit_id)) then raise exception 'Sem acesso a esta unidade'; end if;
  if p_modality not in ('SCHEDULED', 'EXTRAORDINARY') then raise exception 'Modalidade inválida'; end if;
  if p_modality = 'EXTRAORDINARY' and coalesce(trim(p_reason), '') = '' then raise exception 'Informe o motivo do inventário'; end if;

  v_start := case when p_modality = 'EXTRAORDINARY' then now() else p_starts_at end;
  if p_ends_at <= v_start then raise exception 'O término deve ser depois do início'; end if;

  if exists (
    select 1 from public.inventory_sessions s
    where s.company_id = v_company and s.unit_id = p_unit_id
      and s.status in ('SCHEDULED', 'OPEN')
      and tstzrange(s.starts_at, s.ends_at) && tstzrange(v_start, p_ends_at)
      and (s.scope_kind = 'ALL' or p_scope_kind = 'ALL' or s.scope_kind = p_scope_kind)
  ) then
    raise exception 'Já existe inventário aberto ou programado com escopo sobreposto neste local. Continue o inventário existente.';
  end if;

  insert into public.inventory_sessions (company_id, unit_id, modality, scope_kind, competence, location_label, reason, starts_at, ends_at, status)
  values (v_company, p_unit_id, p_modality, p_scope_kind,
          date_trunc('month', v_start at time zone coalesce(v_tz, 'America/Bahia'))::date,
          coalesce(p_location_label, ''), coalesce(p_reason, ''), v_start, p_ends_at,
          case when v_start <= now() then 'OPEN' else 'SCHEDULED' end)
  returning id into v_id;

  if v_start <= now() then perform private.inventory_freeze_items(v_id); end if;

  perform private.record_audit_event('inventory.session_created', v_company, 'inventory_session', v_id::text,
    jsonb_build_object('modality', p_modality, 'scope', p_scope_kind, 'reason', p_reason));
  return v_id;
end;
$$;

create or replace function public.inventory_list_sessions()
returns table (
  id uuid, unit_id uuid, unit_name text, modality text, scope_kind text, competence date,
  location_label text, reason text, starts_at timestamptz, ends_at timestamptz, status text,
  total int, counted int, divergences int, pending int, recount int,
  group1_total int, group1_counted int, group2_total int, group2_counted int, can_manage boolean
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
begin
  if v_company is null then return; end if;
  perform private.inventory_sync_sessions(v_company);

  return query
  select s.id, s.unit_id, u.name, s.modality, s.scope_kind, s.competence, s.location_label, s.reason,
         s.starts_at, s.ends_at, s.status,
         count(i.id)::int,
         count(c1.id)::int,
         (count(c1.id) filter (where c1.difference <> 0))::int,
         (count(i.id) - count(c1.id))::int,
         (count(i.id) filter (where i.recount_requested))::int,
         (count(i.id) filter (where i.group_no = 1))::int,
         (count(c1.id) filter (where i.group_no = 1))::int,
         (count(i.id) filter (where i.group_no = 2))::int,
         (count(c1.id) filter (where i.group_no = 2))::int,
         (select private.inventory_can_manage(s.company_id))
  from public.inventory_sessions s
  join public.units u on u.id = s.unit_id
  left join public.inventory_session_items i on i.session_id = s.id
  left join public.inventory_counts c1 on c1.session_item_id = i.id and c1.round = 1
  where s.company_id = v_company
    and (select private.can_access_unit(s.company_id, s.unit_id))
    and (s.status in ('SCHEDULED', 'OPEN') or s.closed_at > now() - interval '30 days')
  group by s.id, u.name
  order by (s.status = 'OPEN') desc, s.starts_at desc;
end;
$$;

-- Lista da sessão SEM saldo esperado (contagem cega). Estado do item vem da última rodada.
create or replace function public.inventory_session_items(p_session_id uuid)
returns table (
  id uuid, item_type text, item_id uuid, group_no smallint, name text, presentation text, kind_label text,
  sku text, image_url text, base_unit text, pack_label text, state text
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_unit uuid;
begin
  select s.company_id, s.unit_id into v_company, v_unit from public.inventory_sessions s where s.id = p_session_id;
  if v_company is null or not (select private.is_active_company_member(v_company))
     or not (select private.can_access_unit(v_company, v_unit)) then
    raise exception 'Sessão não encontrada';
  end if;

  return query
  select i.id, i.item_type, i.item_id, i.group_no, info.name, info.presentation, info.kind_label, info.sku,
         info.image_url, info.base_unit, info.pack_label,
         case
           when i.recount_requested then 'RECOUNT'
           when c1.id is null then 'PENDING'
           when c1.difference <> 0 then 'DIVERGENCE'
           else 'COUNTED'
         end
  from public.inventory_session_items i
  cross join lateral private.inventory_item_info(i.item_type, i.item_id) info
  left join public.inventory_counts c1 on c1.session_item_id = i.id and c1.round = 1
  where i.session_id = p_session_id
  order by i.group_no, info.name;
end;
$$;

-- Detalhe de um item + fotografia do saldo (token). O saldo NUNCA volta aqui.
create or replace function public.inventory_begin_count(p_session_item_id uuid)
returns table (
  token uuid, name text, presentation text, kind_label text, sku text, image_url text,
  base_unit text, pack_label text, pack_factor numeric, divisible boolean
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  i public.inventory_session_items;
  s public.inventory_sessions;
  info record;
  v_token uuid;
begin
  select * into i from public.inventory_session_items where id = p_session_item_id for update;
  if not found then raise exception 'Item não encontrado'; end if;
  select * into s from public.inventory_sessions where id = i.session_id;
  if not (select private.is_active_company_member(s.company_id)) or not (select private.can_access_unit(s.company_id, s.unit_id)) then
    raise exception 'Item não encontrado';
  end if;
  if s.status <> 'OPEN' then raise exception 'Inventário não está aberto'; end if;
  if exists (select 1 from public.inventory_counts c where c.session_item_id = i.id)
     and not i.recount_requested then
    raise exception 'Item já contado';
  end if;
  if i.assigned_to is not null and i.assigned_to <> auth.uid() and i.assigned_until > now() then
    raise exception 'Este item está sendo contado por outro operador';
  end if;

  select * into info from private.inventory_item_info(i.item_type, i.item_id);

  insert into public.inventory_snapshots (session_item_id, company_id, balance)
  values (i.id, i.company_id, info.balance)
  returning id into v_token;

  update public.inventory_session_items
    set assigned_to = auth.uid(), assigned_until = now() + interval '15 minutes'
    where id = i.id;

  return query select v_token, info.name, info.presentation, info.kind_label, info.sku, info.image_url,
                      info.base_unit, info.pack_label, info.pack_factor, info.divisible;
end;
$$;

create or replace function public.inventory_register_count(
  p_command_id uuid,
  p_token uuid,
  p_quantity numeric,
  p_unit_mode text,
  p_zero_confirmed boolean default false
) returns table (
  count_id uuid, round_no smallint, base_quantity numeric, expected_balance numeric, difference numeric, replayed boolean
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  snap public.inventory_snapshots;
  i public.inventory_session_items;
  s public.inventory_sessions;
  info record;
  existing public.inventory_counts;
  v_factor numeric := 1;
  v_base numeric;
  v_round smallint;
  v_prev uuid;
  v_name text;
  v_new uuid;
  v_current numeric;
begin
  select * into snap from public.inventory_snapshots where id = p_token;
  if not found then raise exception 'Fotografia de saldo inválida. Abra o item novamente.'; end if;
  select * into i from public.inventory_session_items where id = snap.session_item_id for update;
  select * into s from public.inventory_sessions where id = i.session_id;

  if not (select private.is_active_company_member(s.company_id)) or not (select private.can_access_unit(s.company_id, s.unit_id)) then
    raise exception 'Item não encontrado';
  end if;

  -- Idempotência: mesmo command_id repete o resultado; conteúdo diferente é conflito.
  select * into existing from public.inventory_counts where company_id = s.company_id and command_id = p_command_id;
  if found then
    if existing.session_item_id <> i.id or existing.entered_quantity <> p_quantity or existing.entered_unit <> p_unit_mode then
      raise exception 'COMMAND_CONFLITO: este comando já foi usado com outro conteúdo';
    end if;
    return query select existing.id, existing.round, existing.base_quantity, existing.expected_balance, existing.difference, true;
    return;
  end if;

  if s.status <> 'OPEN' then raise exception 'Inventário encerrado: não é possível registrar contagem'; end if;
  if snap.taken_by <> auth.uid() then raise exception 'Fotografia pertence a outro operador'; end if;
  if snap.consumed_at is not null then raise exception 'Fotografia já utilizada. Abra o item novamente.'; end if;
  if i.assigned_to is distinct from auth.uid() and i.assigned_until > now() then
    raise exception 'Este item está sendo contado por outro operador';
  end if;

  if p_quantity is null or p_quantity < 0 then raise exception 'Quantidade inválida'; end if;
  if p_unit_mode not in ('BASE', 'PACK') then raise exception 'Unidade inválida'; end if;
  if p_quantity = 0 and not coalesce(p_zero_confirmed, false) then
    raise exception 'Confirme explicitamente que o produto não foi encontrado (zero)';
  end if;

  select * into info from private.inventory_item_info(i.item_type, i.item_id);
  if p_unit_mode = 'PACK' then
    if info.pack_factor is null then raise exception 'Este item não tem pack cadastrado'; end if;
    v_factor := info.pack_factor;
  end if;
  if (p_unit_mode = 'PACK' or not info.divisible) and p_quantity <> trunc(p_quantity) then
    raise exception 'Esta unidade só aceita quantidade inteira';
  end if;
  if p_quantity <> round(p_quantity, 3) then raise exception 'Precisão incompatível com a unidade'; end if;
  v_base := p_quantity * v_factor;

  -- Movimentação entre a fotografia e a confirmação invalida a medição (não gera divergência falsa).
  v_current := info.balance;
  if v_current is distinct from snap.balance
     or (i.item_type = 'PRODUCT' and exists (
           select 1 from public.stock_movements m where m.product_id = i.item_id and m.created_at > snap.taken_at)) then
    raise exception 'MOVIMENTACAO_DURANTE_CONTAGEM: houve movimentação deste item. Confira novamente e abra o item para nova fotografia.';
  end if;

  select c.id, c.round into v_prev, v_round
    from public.inventory_counts c where c.session_item_id = i.id order by c.round desc limit 1;
  if v_round is null then v_round := 1; v_prev := null; else v_round := v_round + 1; end if;

  v_name := coalesce((select au.raw_user_meta_data ->> 'name' from auth.users au where au.id = auth.uid()),
                     (select au.email from auth.users au where au.id = auth.uid()), 'Operador');

  insert into public.inventory_counts (
    session_id, session_item_id, company_id, unit_id, round, recount_of, entered_quantity, entered_unit,
    conversion_factor, base_quantity, zero_confirmed, expected_balance, snapshot_id, difference,
    counted_by, counted_by_name, command_id
  ) values (
    s.id, i.id, s.company_id, s.unit_id, v_round, v_prev, p_quantity, p_unit_mode,
    v_factor, v_base, p_quantity = 0, snap.balance, snap.id, v_base - snap.balance,
    auth.uid(), v_name, p_command_id
  ) returning id into v_new;

  update public.inventory_snapshots set consumed_at = now() where id = snap.id;
  update public.inventory_session_items set recount_requested = false, assigned_to = null, assigned_until = null where id = i.id;

  perform private.record_audit_event('inventory.count_registered', s.company_id, 'inventory_count', v_new::text,
    jsonb_build_object('session_id', s.id, 'item_id', i.item_id, 'round', v_round, 'base_quantity', v_base, 'difference', v_base - snap.balance));

  return query select v_new, v_round, v_base, snap.balance, v_base - snap.balance, false;
end;
$$;

create or replace function public.inventory_release_item(p_session_item_id uuid)
returns void
language sql
security definer
set search_path to ''
as $$
  update public.inventory_session_items
    set assigned_to = null, assigned_until = null
    where id = p_session_item_id and assigned_to = auth.uid();
$$;

create or replace function public.inventory_request_recount(p_session_item_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  i public.inventory_session_items;
  s public.inventory_sessions;
begin
  select * into i from public.inventory_session_items where id = p_session_item_id for update;
  if not found then raise exception 'Item não encontrado'; end if;
  select * into s from public.inventory_sessions where id = i.session_id;
  if not (select private.inventory_can_manage(s.company_id)) then raise exception 'Sem permissão para solicitar recontagem'; end if;
  if s.status <> 'OPEN' then raise exception 'Inventário não está aberto'; end if;
  if not exists (select 1 from public.inventory_counts c where c.session_item_id = i.id) then
    raise exception 'Item ainda não foi contado';
  end if;
  update public.inventory_session_items set recount_requested = true where id = i.id;
  perform private.record_audit_event('inventory.recount_requested', s.company_id, 'inventory_session_item', i.id::text, '{}'::jsonb);
end;
$$;

create or replace function public.inventory_close_session(p_session_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  s public.inventory_sessions;
  v_pending int;
  v_status text;
begin
  select * into s from public.inventory_sessions where id = p_session_id for update;
  if not found then raise exception 'Sessão não encontrada'; end if;
  if not (select private.inventory_can_manage(s.company_id)) then raise exception 'Sem permissão para encerrar inventário'; end if;
  if s.status <> 'OPEN' then raise exception 'Inventário não está aberto'; end if;

  select count(*) into v_pending from public.inventory_session_items i
    where i.session_id = s.id and not exists (select 1 from public.inventory_counts c where c.session_item_id = i.id);
  v_status := case when v_pending > 0 then 'CLOSED_INCOMPLETE' else 'CLOSED' end;

  update public.inventory_sessions set status = v_status, closed_by = auth.uid(), closed_at = now() where id = s.id;
  perform private.record_audit_event('inventory.session_closed', s.company_id, 'inventory_session', s.id::text,
    jsonb_build_object('status', v_status, 'pending', v_pending));
  return v_status;
end;
$$;

-- Resultado completo (com saldo fotografado) só para gestor.
create or replace function public.inventory_session_results(p_session_id uuid)
returns table (
  session_item_id uuid, name text, sku text, round_no smallint, base_quantity numeric,
  expected_balance numeric, difference numeric, counted_by_name text, counted_at timestamptz
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.inventory_sessions where id = p_session_id;
  if v_company is null or not (select private.inventory_can_manage(v_company)) then
    raise exception 'Sem permissão para consultar resultados';
  end if;
  return query
  select c.session_item_id, info.name, info.sku, c.round, c.base_quantity, c.expected_balance, c.difference,
         c.counted_by_name, c.counted_at
  from public.inventory_counts c
  join public.inventory_session_items i on i.id = c.session_item_id
  cross join lateral private.inventory_item_info(i.item_type, i.item_id) info
  where c.session_id = p_session_id
  order by (c.difference = 0), info.name, c.round;
end;
$$;

revoke all on function public.inventory_create_session(uuid, text, text, timestamptz, timestamptz, text, text) from public, anon;
revoke all on function public.inventory_list_sessions() from public, anon;
revoke all on function public.inventory_session_items(uuid) from public, anon;
revoke all on function public.inventory_begin_count(uuid) from public, anon;
revoke all on function public.inventory_register_count(uuid, uuid, numeric, text, boolean) from public, anon;
revoke all on function public.inventory_release_item(uuid) from public, anon;
revoke all on function public.inventory_request_recount(uuid) from public, anon;
revoke all on function public.inventory_close_session(uuid) from public, anon;
revoke all on function public.inventory_session_results(uuid) from public, anon;
grant execute on function public.inventory_create_session(uuid, text, text, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.inventory_list_sessions() to authenticated;
grant execute on function public.inventory_session_items(uuid) to authenticated;
grant execute on function public.inventory_begin_count(uuid) to authenticated;
grant execute on function public.inventory_register_count(uuid, uuid, numeric, text, boolean) to authenticated;
grant execute on function public.inventory_release_item(uuid) to authenticated;
grant execute on function public.inventory_request_recount(uuid) to authenticated;
grant execute on function public.inventory_close_session(uuid) to authenticated;
grant execute on function public.inventory_session_results(uuid) to authenticated;

alter publication supabase_realtime add table public.inventory_session_items;
alter publication supabase_realtime add table public.inventory_sessions;
