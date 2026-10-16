-- Clientes V1 (pacote mestre): colunas novas em customers, contatos adicionais, mídia, comando de gravação
-- idempotente com revisão, inativação, lista paginada com situação financeira, leitura de títulos/pagamentos
-- e resumo comercial. NÃO aplicada em banco algum. Depende de 20261015120000_credito_cliente_fonte_unica.sql
-- (receivable_payments, private.company_today, oris360_credit_*). Reversão: 20261016140000_clientes_v1_mestre_REVERSAO.sql
-- Premissas assumidas (ver docs/clientes/CONFORMIDADE_PACOTE.md): compra "faturada" = pedido não cancelado com
-- faturamento CONFIRMADO, reconhecida em billings.confirmed_at; devoluções ainda não entram (fonte não definida).

-- 1) Colunas novas em customers (todas aditivas, com default) ---------------------------------

alter table public.customers
  add column if not exists display_number integer,
  add column if not exists person_type text not null default 'PJ',
  add column if not exists registration_status text not null default 'ATIVO',
  add column if not exists inactivated_at timestamptz,
  add column if not exists inactivated_by uuid,
  add column if not exists inactivation_reason text,
  add column if not exists revision integer not null default 1,
  add column if not exists ie_exempt boolean not null default false,
  add column if not exists tax_profile text,
  add column if not exists contact_role text,
  add column if not exists whatsapp_enabled boolean not null default false,
  add column if not exists address_number text not null default '',
  add column if not exists address_complement text not null default '',
  add column if not exists delivery_reference text not null default '',
  add column if not exists ibge_code text,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists location_source text,
  add column if not exists location_accuracy_m numeric,
  add column if not exists location_captured_at timestamptz,
  add column if not exists location_confirmed_at timestamptz,
  add column if not exists location_confirmed_by uuid,
  add column if not exists segment text,
  add column if not exists origin text,
  add column if not exists seller_employee_id uuid references public.employees(id),
  add column if not exists promoter_employee_id uuid references public.employees(id),
  add column if not exists service_notes text not null default '',
  add column if not exists proposed_credit_limit numeric not null default 0,
  add column if not exists preferred_payment_days text,
  add column if not exists preferred_payment_method text,
  add column if not exists credit_analysis_state text not null default 'NAO_ANALISADO',
  add column if not exists credit_notes text not null default '';

alter table public.customers
  add constraint customers_person_type_chk check (person_type in ('PF', 'PJ')),
  add constraint customers_registration_status_chk check (registration_status in ('ATIVO', 'INATIVO')),
  add constraint customers_ibge_code_chk check (ibge_code is null or ibge_code ~ '^[0-9]{7}$'),
  add constraint customers_coordinates_pair_chk check ((latitude is null) = (longitude is null)),
  add constraint customers_coordinates_range_chk check ((latitude is null or latitude between -90 and 90) and (longitude is null or longitude between -180 and 180)),
  add constraint customers_location_confirmed_chk check (location_confirmed_at is null or latitude is not null),
  add constraint customers_proposed_limit_chk check (proposed_credit_limit >= 0 and proposed_credit_limit <= 999999999),
  add constraint customers_credit_state_chk check (credit_analysis_state in ('NAO_ANALISADO', 'EM_ANALISE', 'CONFERIDO'));

-- número de exibição por empresa (separado do UUID); legado numerado por data de criação
with numbered as (
  select id, row_number() over (partition by company_id order by created_at, id) as n from public.customers where display_number is null
)
update public.customers c set display_number = numbered.n from numbered where numbered.id = c.id;
create unique index customers_company_display_number_uidx on public.customers (company_id, display_number);
create index customers_company_status_idx on public.customers (company_id, registration_status);
create index customers_seller_idx on public.customers (seller_employee_id) where seller_employee_id is not null;
create index customers_promoter_idx on public.customers (promoter_employee_id) where promoter_employee_id is not null;

-- 2) Normalização de texto para busca sem acento ---------------------------------------------

create or replace function private.cust_norm(p_text text)
returns text
language sql
immutable
set search_path to ''
as $$
  select lower(translate(coalesce(p_text, ''),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
    'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'))
$$;
revoke all on function private.cust_norm(text) from public, anon;
grant execute on function private.cust_norm(text) to authenticated;

create or replace function private.company_date(p_company_id uuid, p_ts timestamptz)
returns date
language sql
stable
security definer
set search_path to ''
as $$
  select (p_ts at time zone coalesce(
    (select u.timezone from public.units u where u.company_id = p_company_id order by (u.name = 'Matriz') desc, u.created_at limit 1),
    'America/Belem'))::date
$$;
revoke all on function private.company_date(uuid, timestamptz) from public, anon;
grant execute on function private.company_date(uuid, timestamptz) to authenticated;

-- 3) Guarda no servidor: revisão, número, equipe da mesma empresa, proposta de crédito, ponto ---

create or replace function private.customers_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_proposal_changed boolean;
  v_address_changed boolean;
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('customers_display_number:' || new.company_id::text, 0));
    new.display_number := coalesce(new.display_number, (select coalesce(max(c.display_number), 0) + 1 from public.customers c where c.company_id = new.company_id));
    new.revision := 1;
    v_proposal_changed := new.proposed_credit_limit <> 0 or new.preferred_payment_days is not null
      or new.preferred_payment_method is not null or new.credit_analysis_state <> 'NAO_ANALISADO' or new.credit_notes <> '';
  else
    new.display_number := old.display_number;
    new.revision := old.revision + 1;
    v_proposal_changed := new.proposed_credit_limit is distinct from old.proposed_credit_limit
      or new.preferred_payment_days is distinct from old.preferred_payment_days
      or new.preferred_payment_method is distinct from old.preferred_payment_method
      or new.credit_analysis_state is distinct from old.credit_analysis_state
      or new.credit_notes is distinct from old.credit_notes;
    v_address_changed := new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude
      or new.cep is distinct from old.cep or new.address is distinct from old.address
      or new.address_number is distinct from old.address_number or new.city is distinct from old.city
      or new.state is distinct from old.state or new.ibge_code is distinct from old.ibge_code;
    if v_address_changed and new.location_confirmed_at is not distinct from old.location_confirmed_at then
      new.location_confirmed_at := null;
      new.location_confirmed_by := null;
    end if;
    if new.registration_status is distinct from old.registration_status then
      if new.registration_status = 'INATIVO' then
        new.inactivated_at := coalesce(new.inactivated_at, now());
        new.inactivated_by := coalesce(new.inactivated_by, auth.uid());
      else
        new.inactivated_at := null;
        new.inactivated_by := null;
        new.inactivation_reason := null;
      end if;
    end if;
  end if;

  if new.seller_employee_id is not null and not exists (select 1 from public.employees e where e.id = new.seller_employee_id and e.company_id = new.company_id) then
    raise exception 'vendedor de outra empresa' using errcode = '23514';
  end if;
  if new.promoter_employee_id is not null and not exists (select 1 from public.employees e where e.id = new.promoter_employee_id and e.company_id = new.company_id) then
    raise exception 'promotor de outra empresa' using errcode = '23514';
  end if;

  if v_proposal_changed and auth.uid() is not null and not private.has_permission(new.company_id, 'customer_credit.change_permanent_limit') then
    raise exception 'sem permissao para propor condicoes comerciais' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.customers_guard() from public, anon, authenticated;
create trigger customers_guard before insert or update on public.customers
  for each row execute function private.customers_guard();

create or replace function private.customers_no_delete_with_history()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if exists (select 1 from public.orders where customer_id = old.id)
     or exists (select 1 from public.billings where customer_id = old.id)
     or exists (select 1 from public.receivables where customer_id = old.id) then
    raise exception 'CLIENTE_COM_HISTORICO: inative o cliente em vez de excluir' using errcode = '23503';
  end if;
  return old;
end;
$$;
revoke all on function private.customers_no_delete_with_history() from public, anon, authenticated;
create trigger customers_no_delete_with_history before delete on public.customers
  for each row execute function private.customers_no_delete_with_history();

-- 4) Contatos adicionais e mídia ----------------------------------------------------------------

create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  role text,
  phone text not null default '',
  whatsapp_enabled boolean not null default false,
  email text not null default '',
  created_at timestamptz not null default now()
);
create index customer_contacts_customer_idx on public.customer_contacts (customer_id);

create table public.customer_media (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  customer_id uuid not null references public.customers(id) on delete cascade,
  category text not null check (category in ('FACHADA', 'INTERIOR', 'OUTRA')),
  caption text not null default '',
  primary_front boolean not null default false,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 8388608),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (not primary_front or category = 'FACHADA')
);
create unique index customer_media_one_primary on public.customer_media (customer_id) where primary_front;
create index customer_media_customer_idx on public.customer_media (customer_id);

create or replace function private.customer_child_company()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  select c.company_id into new.company_id from public.customers c where c.id = new.customer_id;
  if new.company_id is null then raise exception 'cliente inexistente' using errcode = '23503'; end if;
  return new;
end;
$$;
revoke all on function private.customer_child_company() from public, anon, authenticated;
create trigger customer_contacts_company before insert or update of customer_id on public.customer_contacts
  for each row execute function private.customer_child_company();
create trigger customer_media_company before insert or update of customer_id on public.customer_media
  for each row execute function private.customer_child_company();

alter table public.customer_contacts enable row level security;
alter table public.customer_media enable row level security;
revoke all on public.customer_contacts, public.customer_media from anon;
create policy customer_contacts_all on public.customer_contacts for all to authenticated
  using (private.is_active_company_member(company_id) and not private.is_restricted_operator(company_id))
  with check (private.is_active_company_member(company_id) and not private.is_restricted_operator(company_id));
create policy customer_media_all on public.customer_media for all to authenticated
  using (private.is_active_company_member(company_id) and not private.is_restricted_operator(company_id))
  with check (private.is_active_company_member(company_id) and not private.is_restricted_operator(company_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('customer-media', 'customer-media', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
-- caminho: <customer_id>/<arquivo>; a empresa vem do cliente dono da pasta
create policy customer_media_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'customer-media' and exists (
    select 1 from public.customers c
    where c.id::text = (storage.foldername(objects.name))[1]
      and private.is_active_company_member(c.company_id) and not private.is_restricted_operator(c.company_id)));
create policy customer_media_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'customer-media' and exists (
    select 1 from public.customers c
    where c.id::text = (storage.foldername(objects.name))[1]
      and private.is_active_company_member(c.company_id) and not private.is_restricted_operator(c.company_id)));
create policy customer_media_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'customer-media' and exists (
    select 1 from public.customers c
    where c.id::text = (storage.foldername(objects.name))[1]
      and private.is_active_company_member(c.company_id) and not private.is_restricted_operator(c.company_id)));

create or replace function public.oris360_customer_media_set_primary(p_media_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_m public.customer_media;
begin
  select * into v_m from public.customer_media where id = p_media_id;
  if v_m.id is null or not private.is_active_company_member(v_m.company_id) or private.is_restricted_operator(v_m.company_id) then
    raise exception 'sem acesso a esta foto' using errcode = '42501';
  end if;
  if v_m.category <> 'FACHADA' then raise exception 'somente foto de fachada pode ser principal' using errcode = '23514'; end if;
  update public.customer_media set primary_front = false where customer_id = v_m.customer_id and primary_front and id <> p_media_id;
  update public.customer_media set primary_front = true where id = p_media_id;
end;
$$;

-- 5) Comandos idempotentes e gravação -------------------------------------------------------------

create table public.customer_commands (
  company_id uuid not null references public.companies(id),
  command_id uuid not null,
  command_type text not null,
  request jsonb not null,
  result jsonb not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (company_id, command_id)
);
alter table public.customer_commands enable row level security;
revoke all on public.customer_commands from anon, authenticated;

create or replace function private.customer_command_replay(p_company uuid, p_command uuid, p_type text, p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_row public.customer_commands;
begin
  select * into v_row from public.customer_commands where company_id = p_company and command_id = p_command;
  if v_row.command_id is null then return null; end if;
  if v_row.command_type <> p_type or v_row.request is distinct from p_request then
    raise exception 'COMANDO_REUSADO: command_id ja usado com outros parametros' using errcode = '22023';
  end if;
  return v_row.result || jsonb_build_object('replayed', true);
end;
$$;
revoke all on function private.customer_command_replay(uuid, uuid, text, jsonb) from public, anon, authenticated;

create or replace function private.customer_command_done(p_company uuid, p_command uuid, p_type text, p_request jsonb, p_result jsonb, p_event text, p_entity uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.customer_commands (company_id, command_id, command_type, request, result) values (p_company, p_command, p_type, p_request, p_result);
  insert into public.audit_events (event_type, company_id, actor_type, actor_user_id, entity_type, entity_id, idempotency_key, payload)
  values (p_event, p_company, 'USER', auth.uid(), 'customer', p_entity::text, p_command::text, p_payload);
  return p_result || jsonb_build_object('replayed', false);
end;
$$;
revoke all on function private.customer_command_done(uuid, uuid, text, jsonb, jsonb, text, uuid, jsonb) from public, anon, authenticated;

create or replace function public.oris360_customer_save(p_command_id uuid, p_company_id uuid, p_customer_id uuid, p_expected_revision integer, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_cur public.customers;
  v_company uuid;
  v_id uuid;
  v_req jsonb := jsonb_build_object('company_id', p_company_id, 'customer_id', p_customer_id, 'expected_revision', p_expected_revision, 'data', p_data);
  v_prev jsonb;
  v_type text;
  v_doc text;
  v_uf text;
  v_ibge text;
  v_lat numeric;
  v_lon numeric;
  v_confirm boolean;
  v_result jsonb;
  v_rev integer;
  v_has_ibge boolean;
begin
  if p_command_id is null then raise exception 'command_id obrigatorio' using errcode = '22023'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'dados invalidos' using errcode = '22023'; end if;

  if p_customer_id is not null then
    select * into v_cur from public.customers where id = p_customer_id;
    if v_cur.id is null then raise exception 'CLIENTE_NAO_ENCONTRADO' using errcode = 'P0002'; end if;
    v_company := v_cur.company_id;
  else
    v_company := p_company_id;
  end if;
  if v_company is null or not private.is_active_company_member(v_company) or private.is_restricted_operator(v_company) then
    raise exception 'sem acesso a empresa' using errcode = '42501';
  end if;

  v_prev := private.customer_command_replay(v_company, p_command_id, 'customer_save', v_req);
  if v_prev is not null then return v_prev; end if;

  if p_customer_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 1));
    select * into v_cur from public.customers where id = p_customer_id;
    if p_expected_revision is null or v_cur.revision <> p_expected_revision then
      raise exception 'CONFLITO_REVISAO: o cadastro foi alterado por outra pessoa; recarregue' using errcode = '40001';
    end if;
  end if;

  v_type := coalesce(p_data ->> 'person_type', v_cur.person_type, 'PJ');
  if v_type not in ('PF', 'PJ') then raise exception 'tipo de pessoa invalido' using errcode = '22023'; end if;

  if p_customer_id is null then
    if coalesce(trim(p_data ->> 'trade_name'), '') = '' then raise exception 'informe o nome do comercio' using errcode = '22023'; end if;
    if coalesce(trim(p_data ->> 'company_name'), '') = '' then raise exception 'informe a razao social ou nome completo' using errcode = '22023'; end if;
    if coalesce(trim(p_data ->> 'phone'), '') = '' and coalesce(trim(p_data ->> 'email'), '') = '' then raise exception 'informe telefone ou e-mail' using errcode = '22023'; end if;
  end if;

  if p_data ? 'cnpj' then
    v_doc := upper(regexp_replace(coalesce(p_data ->> 'cnpj', ''), '[^A-Za-z0-9]', '', 'g'));
    if p_customer_id is null and v_doc = '' then raise exception 'informe o documento' using errcode = '22023'; end if;
    if v_doc <> '' and v_type = 'PJ' and v_doc !~ '^[A-Z0-9]{12}[0-9]{2}$' then raise exception 'CNPJ invalido: 14 posicoes, as duas ultimas numericas' using errcode = '22023'; end if;
    if v_doc <> '' and v_type = 'PF' and v_doc !~ '^[0-9]{11}$' then raise exception 'CPF invalido: 11 numeros' using errcode = '22023'; end if;
    if v_doc <> '' and v_doc is distinct from upper(regexp_replace(coalesce(v_cur.cnpj, ''), '[^A-Za-z0-9]', '', 'g'))
       and exists (select 1 from public.customers c where c.company_id = v_company and c.id is distinct from p_customer_id
                   and upper(regexp_replace(c.cnpj, '[^A-Za-z0-9]', '', 'g')) = v_doc) then
      raise exception 'DOCUMENTO_DUPLICADO: ja existe cliente com este documento' using errcode = '23505';
    end if;
  else
    v_doc := v_cur.cnpj;
  end if;

  v_uf := upper(coalesce(p_data ->> 'state', v_cur.state, ''));
  v_has_ibge := p_data ? 'ibge_code';
  v_ibge := case when v_has_ibge then nullif(trim(p_data ->> 'ibge_code'), '') else v_cur.ibge_code end;
  if v_ibge is not null and (v_has_ibge or p_data ? 'state') then
    if not exists (select 1 from public.ibge_cities ic where ic.city_code = v_ibge and ic.state_code = v_uf) then
      raise exception 'IBGE_INVALIDO: codigo do municipio nao confere com a UF' using errcode = '22023';
    end if;
  end if;

  if p_data ? 'latitude' or p_data ? 'longitude' then
    v_lat := nullif(p_data ->> 'latitude', '')::numeric;
    v_lon := nullif(p_data ->> 'longitude', '')::numeric;
  else
    v_lat := v_cur.latitude; v_lon := v_cur.longitude;
  end if;
  if (v_lat is null) <> (v_lon is null) then raise exception 'latitude e longitude devem ser informadas juntas' using errcode = '22023'; end if;
  v_confirm := coalesce((p_data ->> 'location_confirmed')::boolean, false);
  if v_confirm and v_lat is null then raise exception 'nao ha ponto para confirmar' using errcode = '22023'; end if;

  if p_customer_id is null then
    insert into public.customers (company_id, name, company_name, trade_name, phone, email, cnpj, ie, cep, city, state, address, neighborhood,
      person_type, ie_exempt, tax_profile, contact_role, whatsapp_enabled, address_number, address_complement, delivery_reference, ibge_code,
      latitude, longitude, location_source, location_accuracy_m, location_captured_at,
      segment, origin, seller_employee_id, promoter_employee_id, service_notes,
      location_confirmed_at, location_confirmed_by,
      proposed_credit_limit, preferred_payment_days, preferred_payment_method, credit_analysis_state, credit_notes)
    values (v_company, coalesce(p_data ->> 'name', ''), p_data ->> 'company_name', coalesce(p_data ->> 'trade_name', ''), coalesce(p_data ->> 'phone', ''),
      coalesce(p_data ->> 'email', ''), coalesce(v_doc, ''), coalesce(p_data ->> 'ie', ''), regexp_replace(coalesce(p_data ->> 'cep', ''), '\D', '', 'g'),
      coalesce(p_data ->> 'city', ''), v_uf, coalesce(p_data ->> 'address', ''), coalesce(p_data ->> 'neighborhood', ''),
      v_type, coalesce((p_data ->> 'ie_exempt')::boolean, false), nullif(p_data ->> 'tax_profile', ''), nullif(p_data ->> 'contact_role', ''),
      coalesce((p_data ->> 'whatsapp_enabled')::boolean, false), coalesce(p_data ->> 'address_number', ''), coalesce(p_data ->> 'address_complement', ''),
      coalesce(p_data ->> 'delivery_reference', ''), v_ibge, v_lat, v_lon, nullif(p_data ->> 'location_source', ''),
      nullif(p_data ->> 'location_accuracy_m', '')::numeric, nullif(p_data ->> 'location_captured_at', '')::timestamptz,
      nullif(p_data ->> 'segment', ''), nullif(p_data ->> 'origin', ''), nullif(p_data ->> 'seller_employee_id', '')::uuid,
      nullif(p_data ->> 'promoter_employee_id', '')::uuid, coalesce(p_data ->> 'service_notes', ''),
      case when v_confirm then now() end, case when v_confirm then auth.uid() end,
      coalesce((p_data ->> 'proposed_credit_limit')::numeric, 0), nullif(p_data ->> 'preferred_payment_days', ''), nullif(p_data ->> 'preferred_payment_method', ''),
      coalesce(nullif(p_data ->> 'credit_analysis_state', ''), 'NAO_ANALISADO'), coalesce(p_data ->> 'credit_notes', ''))
    returning id into v_id;
  else
    v_id := p_customer_id;
    update public.customers c set
      name = coalesce(p_data ->> 'name', c.name),
      company_name = coalesce(p_data ->> 'company_name', c.company_name),
      trade_name = coalesce(p_data ->> 'trade_name', c.trade_name),
      phone = coalesce(p_data ->> 'phone', c.phone),
      email = coalesce(p_data ->> 'email', c.email),
      cnpj = coalesce(v_doc, ''),
      ie = coalesce(p_data ->> 'ie', c.ie),
      cep = case when p_data ? 'cep' then regexp_replace(coalesce(p_data ->> 'cep', ''), '\D', '', 'g') else c.cep end,
      city = coalesce(p_data ->> 'city', c.city),
      state = v_uf,
      address = coalesce(p_data ->> 'address', c.address),
      neighborhood = coalesce(p_data ->> 'neighborhood', c.neighborhood),
      person_type = v_type,
      ie_exempt = coalesce((p_data ->> 'ie_exempt')::boolean, c.ie_exempt),
      tax_profile = case when p_data ? 'tax_profile' then nullif(p_data ->> 'tax_profile', '') else c.tax_profile end,
      contact_role = case when p_data ? 'contact_role' then nullif(p_data ->> 'contact_role', '') else c.contact_role end,
      whatsapp_enabled = coalesce((p_data ->> 'whatsapp_enabled')::boolean, c.whatsapp_enabled),
      address_number = coalesce(p_data ->> 'address_number', c.address_number),
      address_complement = coalesce(p_data ->> 'address_complement', c.address_complement),
      delivery_reference = coalesce(p_data ->> 'delivery_reference', c.delivery_reference),
      ibge_code = v_ibge,
      latitude = v_lat,
      longitude = v_lon,
      location_source = case when p_data ? 'location_source' then nullif(p_data ->> 'location_source', '') else c.location_source end,
      location_accuracy_m = case when p_data ? 'location_accuracy_m' then nullif(p_data ->> 'location_accuracy_m', '')::numeric else c.location_accuracy_m end,
      location_captured_at = case when p_data ? 'location_captured_at' then nullif(p_data ->> 'location_captured_at', '')::timestamptz else c.location_captured_at end,
      segment = case when p_data ? 'segment' then nullif(p_data ->> 'segment', '') else c.segment end,
      origin = case when p_data ? 'origin' then nullif(p_data ->> 'origin', '') else c.origin end,
      seller_employee_id = case when p_data ? 'seller_employee_id' then nullif(p_data ->> 'seller_employee_id', '')::uuid else c.seller_employee_id end,
      promoter_employee_id = case when p_data ? 'promoter_employee_id' then nullif(p_data ->> 'promoter_employee_id', '')::uuid else c.promoter_employee_id end,
      service_notes = coalesce(p_data ->> 'service_notes', c.service_notes),
      proposed_credit_limit = case when p_data ? 'proposed_credit_limit' then coalesce((p_data ->> 'proposed_credit_limit')::numeric, 0) else c.proposed_credit_limit end,
      preferred_payment_days = case when p_data ? 'preferred_payment_days' then nullif(p_data ->> 'preferred_payment_days', '') else c.preferred_payment_days end,
      preferred_payment_method = case when p_data ? 'preferred_payment_method' then nullif(p_data ->> 'preferred_payment_method', '') else c.preferred_payment_method end,
      credit_analysis_state = case when p_data ? 'credit_analysis_state' then coalesce(nullif(p_data ->> 'credit_analysis_state', ''), 'NAO_ANALISADO') else c.credit_analysis_state end,
      credit_notes = coalesce(p_data ->> 'credit_notes', c.credit_notes),
      location_confirmed_at = case when v_confirm then now() else c.location_confirmed_at end,
      location_confirmed_by = case when v_confirm then auth.uid() else c.location_confirmed_by end
    where c.id = v_id;
  end if;

  if p_data ? 'extra_contacts' and jsonb_typeof(p_data -> 'extra_contacts') = 'array' then
    delete from public.customer_contacts where customer_id = v_id;
    insert into public.customer_contacts (customer_id, name, role, phone, whatsapp_enabled, email)
    select v_id, trim(x ->> 'name'), nullif(x ->> 'role', ''), coalesce(x ->> 'phone', ''), coalesce((x ->> 'whatsapp_enabled')::boolean, false), coalesce(x ->> 'email', '')
    from jsonb_array_elements(p_data -> 'extra_contacts') x
    where coalesce(trim(x ->> 'name'), '') <> '';
  end if;

  select revision into v_rev from public.customers where id = v_id;
  v_result := jsonb_build_object('customer_id', v_id, 'revision', v_rev);
  return private.customer_command_done(v_company, p_command_id, 'customer_save', v_req, v_result,
    case when p_customer_id is null then 'customer.created' else 'customer.updated' end, v_id,
    jsonb_build_object('revision', v_rev, 'fields', (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(p_data) k)));
end;
$$;

create or replace function public.oris360_customer_set_status(p_command_id uuid, p_customer_id uuid, p_status text, p_reason text, p_expected_revision integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_cur public.customers;
  v_req jsonb := jsonb_build_object('customer_id', p_customer_id, 'status', p_status, 'reason', p_reason, 'expected_revision', p_expected_revision);
  v_prev jsonb;
  v_rev integer;
begin
  if p_command_id is null then raise exception 'command_id obrigatorio' using errcode = '22023'; end if;
  if p_status not in ('ATIVO', 'INATIVO') then raise exception 'situacao invalida' using errcode = '22023'; end if;
  select * into v_cur from public.customers where id = p_customer_id;
  if v_cur.id is null then raise exception 'CLIENTE_NAO_ENCONTRADO' using errcode = 'P0002'; end if;
  if not private.is_active_company_member(v_cur.company_id) or private.is_restricted_operator(v_cur.company_id) then
    raise exception 'sem acesso a empresa' using errcode = '42501';
  end if;
  v_prev := private.customer_command_replay(v_cur.company_id, p_command_id, 'customer_status', v_req);
  if v_prev is not null then return v_prev; end if;
  if p_reason is null or length(trim(p_reason)) < 5 then raise exception 'motivo obrigatorio' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 1));
  select * into v_cur from public.customers where id = p_customer_id;
  if p_expected_revision is null or v_cur.revision <> p_expected_revision then
    raise exception 'CONFLITO_REVISAO: o cadastro foi alterado por outra pessoa; recarregue' using errcode = '40001';
  end if;

  update public.customers set registration_status = p_status,
    inactivation_reason = case when p_status = 'INATIVO' then trim(p_reason) else null end
  where id = p_customer_id;
  select revision into v_rev from public.customers where id = p_customer_id;
  return private.customer_command_done(v_cur.company_id, p_command_id, 'customer_status', v_req,
    jsonb_build_object('customer_id', p_customer_id, 'revision', v_rev, 'status', p_status),
    case when p_status = 'INATIVO' then 'customer.inactivated' else 'customer.reactivated' end, p_customer_id,
    jsonb_build_object('reason', trim(p_reason), 'revision', v_rev));
end;
$$;

-- 6) Lista paginada com situação financeira ----------------------------------------------------------

create or replace function public.oris360_customers_list(
  p_company_id uuid,
  p_search text default null,
  p_city text default null,
  p_uf text default null,
  p_neighborhood text default null,
  p_seller uuid default null,
  p_promoter uuid default null,
  p_finance text default 'all',
  p_registration text default 'all',
  p_category text default 'all',
  p_sort text default 'purchase',
  p_page integer default 1,
  p_page_size integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_today date;
  v_fin boolean;
  v_size integer := case when p_page_size in (10, 20, 30, 50) then p_page_size else 10 end;
  v_sort text := case when p_sort in ('purchase', 'name', 'debt') then p_sort else 'purchase' end;
  v_q text := private.cust_norm(trim(coalesce(p_search, '')));
  v_qdoc text := upper(regexp_replace(coalesce(p_search, ''), '[^A-Za-z0-9]', '', 'g'));
  v_active_days constant integer := 30;
  v_recent_days constant integer := 90;
  v_result jsonb;
begin
  if p_company_id is null or not private.is_active_company_member(p_company_id) or private.is_restricted_operator(p_company_id) then
    raise exception 'sem acesso a empresa' using errcode = '42501';
  end if;
  v_today := private.company_today(p_company_id);
  v_fin := private.has_permission(p_company_id, 'billing.view_receivables');

  with base as (
    select c.id, c.display_number, c.trade_name, c.company_name, c.name as contact_name, c.cnpj, c.person_type, c.phone, c.city, c.state,
           c.neighborhood, c.registration_status, c.revision, (c.latitude is not null) as has_location,
           c.seller_employee_id, c.promoter_employee_id,
           (select count(*)::int from public.customer_media m where m.customer_id = c.id) as photo_count,
           (select max(private.company_date(c.company_id, b.confirmed_at)) from public.billings b
              join public.orders o on o.id = b.order_id
             where b.customer_id = c.id and b.status = 'CONFIRMADO' and o.status <> 'CANCELLED') as last_purchase,
           fin.open_balance, fin.overdue_balance, fin.overdue_count
    from public.customers c
    left join lateral (
      select coalesce(sum(x.bal), 0) as open_balance,
             coalesce(sum(x.bal) filter (where x.due_date < v_today), 0) as overdue_balance,
             (count(*) filter (where x.due_date < v_today))::int as overdue_count
      from (select r.due_date, r.amount - coalesce((select sum(case p.kind when 'BAIXA' then p.amount else -p.amount end)
                                                    from public.receivable_payments p where p.receivable_id = r.id), 0) as bal
            from public.receivables r where v_fin and r.customer_id = c.id and r.status in ('ABERTO', 'VENCIDO')) x
      where x.bal > 0
    ) fin on true
    where c.company_id = p_company_id
  ), filtered as (
    select b.* from base b
    where (v_q = '' or private.cust_norm(b.trade_name || ' ' || b.company_name || ' ' || b.contact_name || ' ' || b.phone) like '%' || v_q || '%'
           or (length(v_qdoc) >= 3 and upper(regexp_replace(b.cnpj, '[^A-Za-z0-9]', '', 'g')) like '%' || v_qdoc || '%'))
      and (coalesce(p_city, '') = '' or b.city = p_city)
      and (coalesce(p_uf, '') = '' or b.state = upper(p_uf))
      and (coalesce(trim(p_neighborhood), '') = '' or private.cust_norm(b.neighborhood) like '%' || private.cust_norm(trim(p_neighborhood)) || '%')
      and (p_seller is null or b.seller_employee_id = p_seller)
      and (p_promoter is null or b.promoter_employee_id = p_promoter)
      and (not v_fin or p_finance not in ('debt', 'clear') or (p_finance = 'debt' and b.overdue_count > 0) or (p_finance = 'clear' and b.overdue_count = 0))
      and (p_registration not in ('active', 'inactive') or (p_registration = 'active' and b.registration_status = 'ATIVO') or (p_registration = 'inactive' and b.registration_status = 'INATIVO'))
  ), ranked as (
    select f.*, case when f.last_purchase is null then 'prospect'
                     when v_today - f.last_purchase <= v_active_days then 'active'
                     when v_today - f.last_purchase <= v_recent_days then 'recent'
                     else 'old' end as category
    from filtered f
  ), sel as (
    select r.* from ranked r where p_category not in ('active', 'recent', 'old', 'prospect') or r.category = p_category
  ), pg as (
    select (select count(*) from sel)::int as total,
           greatest(1, ceil((select count(*) from sel)::numeric / v_size))::int as pages
  ), cur as (
    select pg.total, pg.pages, least(greatest(coalesce(p_page, 1), 1), pg.pages) as page from pg
  ), rows_page as (
    select s.* from sel s, cur
    order by (case when v_sort = 'name' then private.cust_norm(coalesce(nullif(s.trade_name, ''), s.company_name)) end) asc nulls last,
             (case when v_sort = 'debt' then s.overdue_balance end) desc nulls last,
             (case when v_sort = 'purchase' then s.last_purchase end) desc nulls last,
             private.cust_norm(coalesce(nullif(s.trade_name, ''), s.company_name)), s.id
    offset (select (cur.page - 1) * v_size from cur) limit v_size
  )
  select jsonb_build_object(
    'as_of', v_today,
    'finance_available', v_fin,
    'total', (select total from cur),
    'page', (select page from cur),
    'pages', (select pages from cur),
    'page_size', v_size,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', rp.id, 'display_number', rp.display_number, 'trade_name', rp.trade_name, 'legal_name', rp.company_name,
        'contact_name', rp.contact_name, 'document', rp.cnpj, 'person_type', rp.person_type, 'phone', rp.phone,
        'city', rp.city, 'state', rp.state, 'registration_status', rp.registration_status, 'revision', rp.revision,
        'has_location', rp.has_location, 'photo_count', rp.photo_count, 'category', rp.category, 'last_purchase', rp.last_purchase,
        'seller', (select jsonb_build_object('id', e.id, 'name', e.name) from public.employees e where e.id = rp.seller_employee_id),
        'promoter', (select jsonb_build_object('id', e.id, 'name', e.name) from public.employees e where e.id = rp.promoter_employee_id),
        'open_balance', case when v_fin then rp.open_balance end,
        'overdue_balance', case when v_fin then rp.overdue_balance end,
        'overdue_count', case when v_fin then rp.overdue_count end)
      order by (case when v_sort = 'name' then private.cust_norm(coalesce(nullif(rp.trade_name, ''), rp.company_name)) end) asc nulls last,
               (case when v_sort = 'debt' then rp.overdue_balance end) desc nulls last,
               (case when v_sort = 'purchase' then rp.last_purchase end) desc nulls last,
               private.cust_norm(coalesce(nullif(rp.trade_name, ''), rp.company_name)), rp.id)
      from rows_page rp), '[]'::jsonb),
    'summary', jsonb_build_object(
      'total', (select count(*) from ranked),
      'active', (select count(*) from ranked where category = 'active'),
      'recent', (select count(*) from ranked where category = 'recent'),
      'old', (select count(*) from ranked where category = 'old'),
      'prospect', (select count(*) from ranked where category = 'prospect'),
      'with_debt', case when v_fin then (select count(*) from ranked where overdue_count > 0) end),
    'kpis', jsonb_build_object(
      'total', (select count(*) from base),
      'active', (select count(*) from base where last_purchase is not null and v_today - last_purchase <= v_active_days),
      'prospect', (select count(*) from base where last_purchase is null),
      'with_debt', case when v_fin then (select count(*) from base where overdue_count > 0) end),
    'options', jsonb_build_object(
      'cities', coalesce((select jsonb_agg(distinct city order by city) from base where city <> ''), '[]'::jsonb),
      'states', coalesce((select jsonb_agg(distinct state order by state) from base where state <> ''), '[]'::jsonb),
      'sellers', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name) order by e.name) from public.employees e
                           where e.id in (select seller_employee_id from base where seller_employee_id is not null)), '[]'::jsonb),
      'promoters', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name) order by e.name) from public.employees e
                             where e.id in (select promoter_employee_id from base where promoter_employee_id is not null)), '[]'::jsonb))
  ) into v_result;
  return v_result;
end;
$$;

-- 7) Títulos e histórico de pagamentos (somente leitura) -----------------------------------------------

create or replace function public.oris360_customer_receivables(p_customer_id uuid, p_months integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_today date;
  v_since date;
  v_open jsonb;
  v_paid jsonb;
  v_on_time integer;
  v_late integer;
begin
  select company_id into v_company from public.customers where id = p_customer_id;
  if v_company is null or not private.has_permission(v_company, 'billing.view_receivables') or private.is_restricted_operator(v_company) then
    return null;
  end if;
  v_today := private.company_today(v_company);
  v_since := (v_today - (greatest(1, least(coalesce(p_months, 12), 60)) || ' months')::interval)::date;

  with recs as (
    select r.id, r.amount, r.due_date, r.status, r.paid_at, r.billing_id,
           r.amount - coalesce((select sum(case p.kind when 'BAIXA' then p.amount else -p.amount end) from public.receivable_payments p where p.receivable_id = r.id), 0) as balance,
           (select pm.type from public.installments i join public.payment_methods pm on pm.id = i.payment_method_id where i.id = r.installment_id) as method,
           (select o.order_number from public.billings b join public.orders o on o.id = b.order_id where b.id = r.billing_id) as order_number,
           (select max(p.created_at) from public.receivable_payments p
             where p.receivable_id = r.id and p.kind = 'BAIXA'
               and not exists (select 1 from public.receivable_payments e where e.reverses_payment_id = p.id)) as last_payment_at
    from public.receivables r
    where r.customer_id = p_customer_id and r.status <> 'CANCELADO'
  ), openrows as (
    select * from recs where status in ('ABERTO', 'VENCIDO') and balance > 0
  ), paidrows as (
    select recs.*, private.company_date(v_company, coalesce(last_payment_at, paid_at)) as paid_date
    from recs where status = 'PAGO' and balance <= 0 and coalesce(last_payment_at, paid_at) is not null
  ), paidwin as (
    select *, greatest(0, paid_date - due_date) as days_late from paidrows where paid_date >= v_since
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object('id', id, 'order_number', order_number, 'amount', amount, 'balance', balance,
              'partial', balance < amount, 'due_date', due_date, 'days_late', greatest(0, v_today - due_date), 'overdue', due_date < v_today,
              'method', method) order by due_date, id) from openrows), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', id, 'order_number', order_number, 'amount', amount, 'due_date', due_date,
              'paid_date', paid_date, 'days_late', days_late, 'on_time', days_late = 0, 'method', method) order by paid_date desc, id) from paidwin), '[]'::jsonb),
    (select count(*) filter (where days_late = 0) from paidwin)::int,
    (select count(*) filter (where days_late > 0) from paidwin)::int
  into v_open, v_paid, v_on_time, v_late;

  return jsonb_build_object(
    'as_of', v_today, 'since', v_since,
    'open', v_open,
    'paid', v_paid,
    'summary', jsonb_build_object('paid_count', v_on_time + v_late, 'on_time_count', v_on_time, 'late_count', v_late,
      'on_time_percent', case when v_on_time + v_late = 0 then null else round(100.0 * v_on_time / (v_on_time + v_late)) end),
    'open_summary', jsonb_build_object(
      'overdue_count', (select count(*) from jsonb_array_elements(v_open) x where (x ->> 'overdue')::boolean),
      'overdue_amount', (select coalesce(sum((x ->> 'balance')::numeric), 0) from jsonb_array_elements(v_open) x where (x ->> 'overdue')::boolean),
      'oldest_days', (select coalesce(max((x ->> 'days_late')::int), 0) from jsonb_array_elements(v_open) x),
      'upcoming_count', (select count(*) from jsonb_array_elements(v_open) x where not (x ->> 'overdue')::boolean),
      'upcoming_amount', (select coalesce(sum((x ->> 'balance')::numeric), 0) from jsonb_array_elements(v_open) x where not (x ->> 'overdue')::boolean)));
end;
$$;

-- 8) Resumo comercial: compras mensais, ranking, último pedido/compra, produtos ---------------------------

create or replace function private.customer_sales(p_company uuid)
returns table (customer_id uuid, order_id uuid, day date, amount numeric)
language sql
stable
security definer
set search_path to ''
as $$
  select b.customer_id, o.id, private.company_date(p_company, b.confirmed_at), o.total_amount
  from public.billings b join public.orders o on o.id = b.order_id
  where b.company_id = p_company and b.status = 'CONFIRMADO' and o.status <> 'CANCELLED'
$$;
revoke all on function private.customer_sales(uuid) from public, anon;
grant execute on function private.customer_sales(uuid) to authenticated;

create or replace function public.oris360_customer_commercial_summary(p_customer_id uuid, p_period text default 'six', p_products_limit integer default 10, p_products_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid;
  v_today date;
  v_from date;
  v_months integer;
  v_series jsonb;
  v_rank jsonb;
  v_products jsonb;
  v_total numeric;
  v_count integer;
  v_prod_total integer;
begin
  select company_id into v_company from public.customers where id = p_customer_id;
  if v_company is null or not private.is_active_company_member(v_company) or private.is_restricted_operator(v_company) then
    return null;
  end if;
  v_today := private.company_today(v_company);
  v_months := case p_period when 'month' then 1 when 'year' then 12 else 6 end;
  v_from := case when v_months = 1 then date_trunc('month', v_today)::date
                 else (date_trunc('month', v_today) - ((v_months - 1) || ' months')::interval)::date end;

  select coalesce(sum(amount), 0), count(*) into v_total, v_count from private.customer_sales(v_company) where customer_id = p_customer_id and day >= v_from and day <= v_today;

  select jsonb_agg(jsonb_build_object('key', k, 'value', coalesce(s.value, 0), 'count', coalesce(s.cnt, 0)) order by k) into v_series
  from (
    select case when v_months = 1 then to_char(d, 'YYYY-MM-DD') else to_char(d, 'YYYY-MM') end as k, d
    from generate_series(v_from, v_today, case when v_months = 1 then interval '1 day' else interval '1 month' end) d
  ) g
  left join lateral (
    select sum(amount) as value, count(*) as cnt from private.customer_sales(v_company) cs
    where cs.customer_id = p_customer_id and cs.day >= v_from and cs.day <= v_today
      and (case when v_months = 1 then to_char(cs.day, 'YYYY-MM-DD') else to_char(cs.day, 'YYYY-MM') end) = g.k
  ) s on true;

  with per as (
    select c.id, coalesce((select sum(amount) from private.customer_sales(v_company) cs where cs.customer_id = c.id and cs.day >= v_from and cs.day <= v_today), 0) as v
    from public.customers c where c.company_id = v_company and c.registration_status = 'ATIVO'
  ), ranked as (select id, v, dense_rank() over (order by v desc) as pos from per)
  select jsonb_build_object('position', (select pos from ranked where id = p_customer_id),
                            'universe', (select count(*) from ranked),
                            'criterion', 'dense_rank por valor faturado liquido no periodo; universo = clientes ativos da empresa')
  into v_rank;

  with prod as (
    select coalesce(oi.product_id::text, oi.product_name) as pkey, max(oi.product_name) as name, max(oi.product_id::text) as product_id,
           sum(oi.total_price) as value, sum(oi.total_units) as units
    from public.order_items oi
    join private.customer_sales(v_company) cs on cs.order_id = oi.order_id and cs.customer_id = p_customer_id and cs.day >= v_from and cs.day <= v_today
    group by 1
  ), r as (select *, row_number() over (order by value desc, name, pkey) as pos from prod)
  select (select count(*) from r)::int,
         coalesce(jsonb_agg(jsonb_build_object('position', r.pos, 'product_id', r.product_id, 'name', r.name, 'value', r.value, 'units', r.units,
                  'image_url', (select p.image_url from public.products p where p.id::text = r.product_id), 'share', case when v_total > 0 then round(100.0 * r.value / v_total, 1) end)
                  order by r.pos), '[]'::jsonb)
  into v_prod_total, v_products
  from r where r.pos > greatest(0, coalesce(p_products_offset, 0)) and r.pos <= greatest(0, coalesce(p_products_offset, 0)) + greatest(1, least(coalesce(p_products_limit, 10), 50));

  return jsonb_build_object(
    'as_of', v_today, 'period', p_period, 'from', v_from,
    'total', v_total, 'count', v_count, 'series', coalesce(v_series, '[]'::jsonb),
    'last_order_at', (select max(o.created_at) from public.orders o where o.customer_id = p_customer_id and o.status <> 'CANCELLED'),
    'last_billed_purchase', (select max(day) from private.customer_sales(v_company) where customer_id = p_customer_id),
    'rank', v_rank, 'products_total', v_prod_total, 'products', v_products);
end;
$$;

-- 9) Permissões de execução -----------------------------------------------------------------------------

revoke all on function public.oris360_customer_media_set_primary(uuid) from public, anon;
revoke all on function public.oris360_customer_save(uuid, uuid, uuid, integer, jsonb) from public, anon;
revoke all on function public.oris360_customer_set_status(uuid, uuid, text, text, integer) from public, anon;
revoke all on function public.oris360_customers_list(uuid, text, text, text, text, uuid, uuid, text, text, text, text, integer, integer) from public, anon;
revoke all on function public.oris360_customer_receivables(uuid, integer) from public, anon;
revoke all on function public.oris360_customer_commercial_summary(uuid, text, integer, integer) from public, anon;
grant execute on function public.oris360_customer_media_set_primary(uuid) to authenticated;
grant execute on function public.oris360_customer_save(uuid, uuid, uuid, integer, jsonb) to authenticated;
grant execute on function public.oris360_customer_set_status(uuid, uuid, text, text, integer) to authenticated;
grant execute on function public.oris360_customers_list(uuid, text, text, text, text, uuid, uuid, text, text, text, text, integer, integer) to authenticated;
grant execute on function public.oris360_customer_receivables(uuid, integer) to authenticated;
grant execute on function public.oris360_customer_commercial_summary(uuid, text, integer, integer) to authenticated;
