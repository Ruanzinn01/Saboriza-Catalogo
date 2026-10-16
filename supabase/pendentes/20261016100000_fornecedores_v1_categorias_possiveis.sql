-- ============================================================================================
-- FORNECEDORES V1 · etapa 6 — categorias opcionais (multi) e possíveis fornecedores
--
-- STATUS: VERSIONADA, NÃO APLICADA EM NENHUM BANCO. Fica em supabase/pendentes/ de propósito (nenhum `db push` pega).
-- Aplicar primeiro em homologação (projeto isolado); reversão em 20261016100000_fornecedores_v1_categorias_possiveis_REVERSAO.sql.
-- Escopo: só o que o pacote especifica sem ambiguidade (docs/fornecedores/LEVANTAMENTO_LACUNAS.md).
-- Aditiva: não altera public.suppliers nem nenhuma tabela existente. Categoria é OPCIONAL: nenhuma constraint exige uma.
-- Permissões: reaproveita despesas.read / despesas.manage (chaves existentes). Chaves próprias de Fornecedores: ver DECISOES_PENDENTES.
-- Escrita só por RPC SECURITY DEFINER; a empresa vem de private.default_company_id(), nunca do navegador.
-- ============================================================================================

-- 0. Normalização (caixa, acentos, espaços) para evitar duplicatas ----------------------------
create or replace function private.supplier_normalize_text(p_text text)
returns text
language sql
immutable
set search_path to ''
as $$
  select btrim(regexp_replace(lower(translate(coalesce(p_text, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g'))
$$;

-- 1. Catálogo de categorias do fornecedor (por ID, por empresa) -------------------------------
create table public.supplier_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  name text not null check (length(btrim(name)) between 1 and 60),
  name_key text not null,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name_key),
  unique (company_id, id)
);

create table public.supplier_category_links (
  company_id uuid not null,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  category_id uuid not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (supplier_id, category_id),
  foreign key (company_id, category_id) references public.supplier_categories (company_id, id)
);
create index supplier_category_links_category_idx on public.supplier_category_links (company_id, category_id);

-- O fornecedor precisa ser da mesma empresa do vínculo.
create or replace function private.supplier_category_link_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if not exists (select 1 from public.suppliers s where s.id = new.supplier_id and s.company_id = new.company_id) then
    raise exception 'Fornecedor de outra empresa';
  end if;
  return new;
end;
$$;
create trigger supplier_category_links_guard before insert on public.supplier_category_links
  for each row execute function private.supplier_category_link_guard();

-- 2. Possíveis fornecedores (separados dos formais) -------------------------------------------
create table public.supplier_candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.default_company_id(),
  trade_name text not null check (length(btrim(trade_name)) > 0),
  legal_name text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  city text not null default '',
  state text not null default '' check (state = '' or length(state) = 2),
  website text not null default '',
  owner_name text not null default '',
  origin text not null default '',
  notes text not null default '',
  stage text not null default 'EM_ESTUDO'
    check (stage in ('EM_ESTUDO', 'EM_CONTATO', 'EM_COTACAO', 'NAO_SELECIONADO', 'CADASTRADO')),
  first_registered_at timestamptz not null default now(),
  first_registered_by uuid default auth.uid(),
  last_contact_on date,
  next_contact_on date,
  linked_supplier_id uuid references public.suppliers(id),
  converted_at timestamptz,
  converted_by uuid,
  revision integer not null default 1,
  command_id uuid,
  command_hash text,
  search_key text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, command_id),
  check ((stage = 'CADASTRADO') = (linked_supplier_id is not null))
);
create index supplier_candidates_company_stage_idx on public.supplier_candidates (company_id, stage, first_registered_at desc);
create index supplier_candidates_linked_idx on public.supplier_candidates (linked_supplier_id) where linked_supplier_id is not null;

-- Produtos que o possível fornecedor oferece: informação declarada, NÃO cria SKU nem estoque.
create table public.supplier_candidate_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  candidate_id uuid not null,
  label text not null check (length(btrim(label)) between 1 and 80),
  label_key text not null,
  created_at timestamptz not null default now(),
  foreign key (company_id, candidate_id) references public.supplier_candidates (company_id, id) on delete cascade,
  unique (candidate_id, label_key)
);
create index supplier_candidate_products_key_idx on public.supplier_candidate_products (company_id, label_key);

create table public.supplier_candidate_categories (
  company_id uuid not null,
  candidate_id uuid not null,
  category_id uuid not null,
  primary key (candidate_id, category_id),
  foreign key (company_id, candidate_id) references public.supplier_candidates (company_id, id) on delete cascade,
  foreign key (company_id, category_id) references public.supplier_categories (company_id, id)
);

-- Histórico de contatos: a primeira data/autor ficam na própria avaliação e nunca são reescritos.
create table public.supplier_candidate_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  candidate_id uuid not null,
  kind text not null default 'CONTATO' check (kind in ('CONTATO', 'CONVERSAO')),
  contacted_on date not null default current_date,
  note text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (company_id, candidate_id) references public.supplier_candidates (company_id, id) on delete cascade
);
create index supplier_candidate_contacts_idx on public.supplier_candidate_contacts (candidate_id, contacted_on desc, created_at desc);

-- 3. RLS: leitura por permissão; nenhuma política de escrita (só RPC) -------------------------
alter table public.supplier_categories enable row level security;
alter table public.supplier_category_links enable row level security;
alter table public.supplier_candidates enable row level security;
alter table public.supplier_candidate_products enable row level security;
alter table public.supplier_candidate_categories enable row level security;
alter table public.supplier_candidate_contacts enable row level security;

create policy supplier_categories_select on public.supplier_categories
  for select using ((select private.has_permission(company_id, 'despesas.read')));
create policy supplier_category_links_select on public.supplier_category_links
  for select using ((select private.has_permission(company_id, 'despesas.read')));
create policy supplier_candidates_select on public.supplier_candidates
  for select using ((select private.has_permission(company_id, 'despesas.read')));
create policy supplier_candidate_products_select on public.supplier_candidate_products
  for select using ((select private.has_permission(company_id, 'despesas.read')));
create policy supplier_candidate_categories_select on public.supplier_candidate_categories
  for select using ((select private.has_permission(company_id, 'despesas.read')));
create policy supplier_candidate_contacts_select on public.supplier_candidate_contacts
  for select using ((select private.has_permission(company_id, 'despesas.read')));

revoke all on public.supplier_categories, public.supplier_category_links, public.supplier_candidates,
  public.supplier_candidate_products, public.supplier_candidate_categories, public.supplier_candidate_contacts from anon;
revoke insert, update, delete, truncate on public.supplier_categories, public.supplier_category_links, public.supplier_candidates,
  public.supplier_candidate_products, public.supplier_candidate_categories, public.supplier_candidate_contacts from authenticated;

-- 4. Guarda interna: empresa da sessão + permissão exigida -----------------------------------
create or replace function private.supplier_company_for(p_permission text)
returns uuid
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
begin
  if v_company is null or not (select private.has_permission(v_company, p_permission)) then
    raise exception 'Sem permissão para esta operação de fornecedores';
  end if;
  return v_company;
end;
$$;
revoke all on function private.supplier_company_for(text) from public, anon, authenticated;

-- 5. Categorias -----------------------------------------------------------------------------
-- Duas criações simultâneas do mesmo nome normalizado convergem para a mesma linha (created = false na segunda).
create or replace function public.create_supplier_category(p_name text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('despesas.manage');
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_key text := private.supplier_normalize_text(p_name);
  v_row public.supplier_categories;
  v_created boolean := true;
begin
  if length(v_name) < 1 or length(v_name) > 60 then
    raise exception 'Informe um nome de categoria com até 60 caracteres';
  end if;
  insert into public.supplier_categories (company_id, name, name_key)
    values (v_company, v_name, v_key)
    on conflict (company_id, name_key) do nothing
    returning * into v_row;
  if v_row.id is null then
    select * into v_row from public.supplier_categories where company_id = v_company and name_key = v_key;
    v_created := false;
  end if;
  return jsonb_build_object('id', v_row.id, 'name', v_row.name, 'active', v_row.active, 'created', v_created);
end;
$$;

create or replace function public.rename_supplier_category(p_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('despesas.manage');
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_row public.supplier_categories;
begin
  if length(v_name) < 1 or length(v_name) > 60 then
    raise exception 'Informe um nome de categoria com até 60 caracteres';
  end if;
  update public.supplier_categories
    set name = v_name, name_key = private.supplier_normalize_text(v_name), updated_at = now()
    where id = p_id and company_id = v_company
    returning * into v_row;
  if v_row.id is null then raise exception 'Categoria não encontrada'; end if;
  return jsonb_build_object('id', v_row.id, 'name', v_row.name, 'active', v_row.active);
exception when unique_violation then
  raise exception 'CATEGORIA_DUPLICADA: já existe uma categoria com esse nome';
end;
$$;

-- Inativar preserva todos os vínculos; só impede NOVAS associações.
create or replace function public.set_supplier_category_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('despesas.manage');
begin
  update public.supplier_categories set active = coalesce(p_active, true), updated_at = now()
    where id = p_id and company_id = v_company;
  if not found then raise exception 'Categoria não encontrada'; end if;
end;
$$;

-- As oito categorias iniciais confirmadas pelo usuário (14/10/2026). Ação explícita; idempotente.
create or replace function public.ensure_default_supplier_categories()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('despesas.manage');
  v_name text;
  v_count integer := 0;
  v_inserted integer;
begin
  foreach v_name in array array[
    'Temperos e ingredientes', 'Embalagens', 'Mercadorias para revenda', 'Transporte e logística',
    'Imóveis e aluguéis', 'Manutenção e assistência', 'Máquinas e equipamentos', 'Serviços administrativos'
  ] loop
    insert into public.supplier_categories (company_id, name, name_key)
      values (v_company, v_name, private.supplier_normalize_text(v_name))
      on conflict (company_id, name_key) do nothing;
    get diagnostics v_inserted = row_count;
    v_count := v_count + v_inserted;
  end loop;
  return v_count;
end;
$$;

-- Delta (adicionar/remover): uma alteração não apaga a seleção que outro usuário fez em paralelo.
create or replace function public.set_supplier_categories(p_supplier_id uuid, p_add uuid[], p_remove uuid[])
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('despesas.manage');
  v_cat uuid;
begin
  if not exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.company_id = v_company) then
    raise exception 'Fornecedor não encontrado';
  end if;
  foreach v_cat in array coalesce(p_add, '{}'::uuid[]) loop
    if not exists (select 1 from public.supplier_categories c where c.id = v_cat and c.company_id = v_company) then
      raise exception 'Categoria não encontrada';
    end if;
    if exists (select 1 from public.supplier_category_links l where l.supplier_id = p_supplier_id and l.category_id = v_cat) then
      continue;
    end if;
    if not exists (select 1 from public.supplier_categories c where c.id = v_cat and c.company_id = v_company and c.active) then
      raise exception 'Categoria inativa não aceita novas associações';
    end if;
    insert into public.supplier_category_links (company_id, supplier_id, category_id) values (v_company, p_supplier_id, v_cat);
  end loop;
  delete from public.supplier_category_links
    where supplier_id = p_supplier_id and company_id = v_company and category_id = any (coalesce(p_remove, '{}'::uuid[]));
end;
$$;

-- 6. Possíveis fornecedores ----------------------------------------------------------------
-- Substitui produtos e categorias da avaliação (no update, protegido por revisão esperada).
create or replace function private.supplier_candidate_sync_children(p_company uuid, p_candidate uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_label text;
  v_cat uuid;
  v_ids uuid[];
begin
  if p_payload ? 'products' then
    delete from public.supplier_candidate_products where candidate_id = p_candidate and company_id = p_company;
    for v_label in
      select btrim(regexp_replace(t.val, '\s+', ' ', 'g')) from jsonb_array_elements_text(coalesce(p_payload -> 'products', '[]'::jsonb)) as t(val)
    loop
      if length(v_label) > 0 then
        insert into public.supplier_candidate_products (company_id, candidate_id, label, label_key)
          values (p_company, p_candidate, left(v_label, 80), private.supplier_normalize_text(left(v_label, 80)))
          on conflict (candidate_id, label_key) do nothing;
      end if;
    end loop;
  end if;
  if p_payload ? 'category_ids' then
    select coalesce(array_agg(t.val::uuid), '{}'::uuid[]) into v_ids
      from jsonb_array_elements_text(coalesce(p_payload -> 'category_ids', '[]'::jsonb)) as t(val);
    delete from public.supplier_candidate_categories
      where candidate_id = p_candidate and company_id = p_company and not (category_id = any (v_ids));
    foreach v_cat in array v_ids loop
      if exists (select 1 from public.supplier_candidate_categories where candidate_id = p_candidate and category_id = v_cat) then
        continue;
      end if;
      if not exists (select 1 from public.supplier_categories c where c.id = v_cat and c.company_id = p_company and c.active) then
        raise exception 'Categoria inexistente ou inativa';
      end if;
      insert into public.supplier_candidate_categories (company_id, candidate_id, category_id) values (p_company, p_candidate, v_cat);
    end loop;
  end if;
end;
$$;
revoke all on function private.supplier_candidate_sync_children(uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function private.supplier_candidate_search_key(p_payload jsonb)
returns text
language sql
immutable
set search_path to ''
as $$
  select private.supplier_normalize_text(concat_ws(' ', p_payload ->> 'trade_name', p_payload ->> 'legal_name',
    p_payload ->> 'contact_name', p_payload ->> 'city', p_payload ->> 'owner_name'))
$$;
revoke all on function private.supplier_candidate_search_key(jsonb) from public, anon, authenticated;

-- Mesmo command_id + mesmo corpo = devolve o resultado; mesmo command_id + corpo diferente = conflito.
create or replace function public.register_supplier_candidate(p_command_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('despesas.manage');
  v_hash text := md5(coalesce(p_payload, '{}'::jsonb)::text);
  v_row public.supplier_candidates;
  v_stage text := coalesce(nullif(p_payload ->> 'stage', ''), 'EM_ESTUDO');
begin
  if p_command_id is null then raise exception 'command_id obrigatório'; end if;
  if length(btrim(coalesce(p_payload ->> 'trade_name', ''))) = 0 then raise exception 'Informe o nome da empresa'; end if;
  if v_stage not in ('EM_ESTUDO', 'EM_CONTATO', 'EM_COTACAO', 'NAO_SELECIONADO') then
    raise exception 'Situação inválida (o cadastro como fornecedor é feito pela conversão)';
  end if;

  select * into v_row from public.supplier_candidates where company_id = v_company and command_id = p_command_id;
  if found then
    if v_row.command_hash <> v_hash then raise exception 'CONFLITO_COMANDO: este command_id já foi usado com outro conteúdo'; end if;
    return jsonb_build_object('id', v_row.id, 'revision', v_row.revision, 'replayed', true);
  end if;

  insert into public.supplier_candidates (company_id, trade_name, legal_name, contact_name, phone, email, city, state, website,
      owner_name, origin, notes, stage, next_contact_on, command_id, command_hash, search_key)
    values (v_company, btrim(p_payload ->> 'trade_name'), btrim(coalesce(p_payload ->> 'legal_name', '')),
      btrim(coalesce(p_payload ->> 'contact_name', '')), btrim(coalesce(p_payload ->> 'phone', '')),
      btrim(coalesce(p_payload ->> 'email', '')), btrim(coalesce(p_payload ->> 'city', '')),
      upper(btrim(coalesce(p_payload ->> 'state', ''))), btrim(coalesce(p_payload ->> 'website', '')),
      btrim(coalesce(p_payload ->> 'owner_name', '')), btrim(coalesce(p_payload ->> 'origin', '')),
      btrim(coalesce(p_payload ->> 'notes', '')), v_stage, nullif(p_payload ->> 'next_contact_on', '')::date,
      p_command_id, v_hash, private.supplier_candidate_search_key(p_payload))
    returning * into v_row;
  perform private.supplier_candidate_sync_children(v_company, v_row.id, p_payload);
  return jsonb_build_object('id', v_row.id, 'revision', v_row.revision, 'replayed', false);
end;
$$;

create or replace function public.update_supplier_candidate(p_id uuid, p_expected_revision integer, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('despesas.manage');
  c public.supplier_candidates;
  v_stage text;
begin
  select * into c from public.supplier_candidates where id = p_id and company_id = v_company for update;
  if not found then raise exception 'Avaliação não encontrada'; end if;
  if c.stage = 'CADASTRADO' then raise exception 'Avaliação já cadastrada como fornecedor; edite o fornecedor'; end if;
  if c.revision <> p_expected_revision then
    raise exception 'CONFLITO_REVISAO: a avaliação foi alterada por outra pessoa (revisão atual %)', c.revision;
  end if;
  if length(btrim(coalesce(p_payload ->> 'trade_name', ''))) = 0 then raise exception 'Informe o nome da empresa'; end if;
  v_stage := coalesce(nullif(p_payload ->> 'stage', ''), c.stage);
  if v_stage not in ('EM_ESTUDO', 'EM_CONTATO', 'EM_COTACAO', 'NAO_SELECIONADO') then raise exception 'Situação inválida'; end if;

  update public.supplier_candidates set
      trade_name = btrim(p_payload ->> 'trade_name'), legal_name = btrim(coalesce(p_payload ->> 'legal_name', '')),
      contact_name = btrim(coalesce(p_payload ->> 'contact_name', '')), phone = btrim(coalesce(p_payload ->> 'phone', '')),
      email = btrim(coalesce(p_payload ->> 'email', '')), city = btrim(coalesce(p_payload ->> 'city', '')),
      state = upper(btrim(coalesce(p_payload ->> 'state', ''))), website = btrim(coalesce(p_payload ->> 'website', '')),
      owner_name = btrim(coalesce(p_payload ->> 'owner_name', '')), origin = btrim(coalesce(p_payload ->> 'origin', '')),
      notes = btrim(coalesce(p_payload ->> 'notes', '')), stage = v_stage,
      next_contact_on = nullif(p_payload ->> 'next_contact_on', '')::date,
      search_key = private.supplier_candidate_search_key(p_payload), revision = revision + 1, updated_at = now()
    where id = c.id
    returning * into c;
  perform private.supplier_candidate_sync_children(v_company, c.id, p_payload);
  return jsonb_build_object('id', c.id, 'revision', c.revision);
end;
$$;

-- Registrar contato acrescenta histórico; first_registered_at/by nunca mudam.
create or replace function public.record_candidate_contact(p_id uuid, p_note text, p_contacted_on date, p_next_contact_on date, p_stage text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('despesas.manage');
  c public.supplier_candidates;
  v_on date := coalesce(p_contacted_on, current_date);
begin
  select * into c from public.supplier_candidates where id = p_id and company_id = v_company for update;
  if not found then raise exception 'Avaliação não encontrada'; end if;
  if c.stage = 'CADASTRADO' then raise exception 'Avaliação já cadastrada como fornecedor'; end if;
  if p_stage is not null and p_stage not in ('EM_ESTUDO', 'EM_CONTATO', 'EM_COTACAO', 'NAO_SELECIONADO') then
    raise exception 'Situação inválida';
  end if;
  insert into public.supplier_candidate_contacts (company_id, candidate_id, kind, contacted_on, note)
    values (v_company, c.id, 'CONTATO', v_on, btrim(coalesce(p_note, '')));
  update public.supplier_candidates set
      last_contact_on = greatest(coalesce(last_contact_on, v_on), v_on),
      next_contact_on = p_next_contact_on,
      stage = coalesce(p_stage, stage), revision = revision + 1, updated_at = now()
    where id = c.id
    returning * into c;
  return jsonb_build_object('id', c.id, 'revision', c.revision);
end;
$$;

-- Busca no servidor: empresa, razão, contato, cidade, PRODUTOS declarados e categoria. Paginada.
create or replace function public.search_supplier_candidates(p_query text, p_stage text, p_category_id uuid, p_limit integer, p_offset integer)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('despesas.read');
  v_q text := private.supplier_normalize_text(p_query);
  v_pattern text := '%' || replace(replace(replace(private.supplier_normalize_text(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  with matched as (
    select c.* from public.supplier_candidates c
    where c.company_id = v_company
      and (p_stage is null or p_stage = '' or c.stage = p_stage)
      and (p_category_id is null or exists (
            select 1 from public.supplier_candidate_categories k where k.candidate_id = c.id and k.category_id = p_category_id))
      and (v_q = ''
        or c.search_key like v_pattern
        or exists (select 1 from public.supplier_candidate_products p where p.candidate_id = c.id and p.label_key like v_pattern)
        or exists (select 1 from public.supplier_candidate_categories k join public.supplier_categories sc on sc.id = k.category_id
                   where k.candidate_id = c.id and sc.name_key like v_pattern))
  ), page as (
    select * from matched order by first_registered_at desc, id limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from matched),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'trade_name', c.trade_name, 'legal_name', c.legal_name, 'contact_name', c.contact_name, 'phone', c.phone,
        'email', c.email, 'city', c.city, 'state', c.state, 'website', c.website, 'owner_name', c.owner_name, 'origin', c.origin,
        'notes', c.notes, 'stage', c.stage, 'first_registered_at', c.first_registered_at, 'last_contact_on', c.last_contact_on,
        'next_contact_on', c.next_contact_on, 'linked_supplier_id', c.linked_supplier_id, 'revision', c.revision,
        'products', coalesce((select jsonb_agg(p.label order by p.label) from public.supplier_candidate_products p where p.candidate_id = c.id), '[]'::jsonb),
        'category_ids', coalesce((select jsonb_agg(k.category_id) from public.supplier_candidate_categories k where k.candidate_id = c.id), '[]'::jsonb)
      ) order by c.first_registered_at desc, c.id) from page c), '[]'::jsonb))
  into v_result;
  return v_result;
end;
$$;

create or replace function public.list_candidate_contacts(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('despesas.read');
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', h.id, 'kind', h.kind, 'contacted_on', h.contacted_on, 'note', h.note, 'created_at', h.created_at)
                     order by h.contacted_on desc, h.created_at desc)
    from public.supplier_candidate_contacts h where h.candidate_id = p_id and h.company_id = v_company), '[]'::jsonb);
end;
$$;

-- 7. Promoção (idempotente): cria OU vincula a um fornecedor existente; nunca gera compra, dívida, limite ou pagamento.
-- Documento já cadastrado => exceção 'DUPLICADO:<supplier_id>' para a UI oferecer o vínculo. Retentativa devolve o mesmo fornecedor.
create or replace function public.convert_candidate_to_supplier(p_candidate_id uuid, p_existing_supplier_id uuid, p_supplier jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('despesas.manage');
  c public.supplier_candidates;
  v_supplier uuid;
  v_created boolean := false;
  v_doc text;
  v_dup uuid;
  v_cat uuid;
begin
  select * into c from public.supplier_candidates where id = p_candidate_id and company_id = v_company for update;
  if not found then raise exception 'Avaliação não encontrada'; end if;

  if c.linked_supplier_id is not null then
    return jsonb_build_object('supplier_id', c.linked_supplier_id, 'created', false, 'replayed', true);
  end if;

  if p_existing_supplier_id is not null then
    select s.id into v_supplier from public.suppliers s where s.id = p_existing_supplier_id and s.company_id = v_company;
    if v_supplier is null then raise exception 'Fornecedor existente não encontrado'; end if;
  else
    if length(btrim(coalesce(p_supplier ->> 'name', ''))) = 0
       or length(btrim(coalesce(p_supplier ->> 'company_name', ''))) = 0
       or length(btrim(coalesce(p_supplier ->> 'phone', ''))) = 0 then
      raise exception 'Informe nome do contato, empresa e telefone do fornecedor';
    end if;
    v_doc := upper(regexp_replace(coalesce(p_supplier ->> 'cnpj', ''), '[^0-9A-Za-z]', '', 'g'));
    if v_doc <> '' then
      perform pg_advisory_xact_lock(hashtext(v_company::text || ':' || v_doc));
      select s.id into v_dup from public.suppliers s
        where s.company_id = v_company and upper(regexp_replace(s.cnpj, '[^0-9A-Za-z]', '', 'g')) = v_doc limit 1;
      if v_dup is not null then
        raise exception 'DUPLICADO:%', v_dup;
      end if;
    end if;
    insert into public.suppliers (company_id, name, company_name, phone, trade_name, cnpj, ie, email, address, neighborhood, cep, city, state)
      values (v_company, btrim(p_supplier ->> 'name'), btrim(p_supplier ->> 'company_name'), btrim(p_supplier ->> 'phone'),
        btrim(coalesce(p_supplier ->> 'trade_name', '')), btrim(coalesce(p_supplier ->> 'cnpj', '')),
        btrim(coalesce(p_supplier ->> 'ie', '')), btrim(coalesce(p_supplier ->> 'email', '')),
        btrim(coalesce(p_supplier ->> 'address', '')), btrim(coalesce(p_supplier ->> 'neighborhood', '')),
        btrim(coalesce(p_supplier ->> 'cep', '')), btrim(coalesce(p_supplier ->> 'city', '')),
        upper(btrim(coalesce(p_supplier ->> 'state', ''))))
      returning id into v_supplier;
    v_created := true;
  end if;

  -- categorias da avaliação (somente ativas) + as escolhidas no formulário
  for v_cat in
    select k.category_id from public.supplier_candidate_categories k
      join public.supplier_categories sc on sc.id = k.category_id and sc.active
      where k.candidate_id = c.id
    union
    select sc.id from jsonb_array_elements_text(coalesce(p_supplier -> 'category_ids', '[]'::jsonb)) as t(val)
      join public.supplier_categories sc on sc.id = t.val::uuid and sc.company_id = v_company and sc.active
  loop
    insert into public.supplier_category_links (company_id, supplier_id, category_id)
      values (v_company, v_supplier, v_cat) on conflict do nothing;
  end loop;

  update public.supplier_candidates
    set stage = 'CADASTRADO', linked_supplier_id = v_supplier, converted_at = now(), converted_by = auth.uid(),
        revision = revision + 1, updated_at = now()
    where id = c.id;
  insert into public.supplier_candidate_contacts (company_id, candidate_id, kind, note)
    values (v_company, c.id, 'CONVERSAO', case when v_created then 'Cadastrado como novo fornecedor' else 'Vinculado a fornecedor existente' end);

  return jsonb_build_object('supplier_id', v_supplier, 'created', v_created, 'replayed', false);
end;
$$;

-- 8. GRANT EXECUTE: só usuários autenticados; anon e public fora ------------------------------
revoke all on function public.create_supplier_category(text) from public, anon;
revoke all on function public.rename_supplier_category(uuid, text) from public, anon;
revoke all on function public.set_supplier_category_active(uuid, boolean) from public, anon;
revoke all on function public.ensure_default_supplier_categories() from public, anon;
revoke all on function public.set_supplier_categories(uuid, uuid[], uuid[]) from public, anon;
revoke all on function public.register_supplier_candidate(uuid, jsonb) from public, anon;
revoke all on function public.update_supplier_candidate(uuid, integer, jsonb) from public, anon;
revoke all on function public.record_candidate_contact(uuid, text, date, date, text) from public, anon;
revoke all on function public.search_supplier_candidates(text, text, uuid, integer, integer) from public, anon;
revoke all on function public.list_candidate_contacts(uuid) from public, anon;
revoke all on function public.convert_candidate_to_supplier(uuid, uuid, jsonb) from public, anon;
grant execute on function public.create_supplier_category(text) to authenticated;
grant execute on function public.rename_supplier_category(uuid, text) to authenticated;
grant execute on function public.set_supplier_category_active(uuid, boolean) to authenticated;
grant execute on function public.ensure_default_supplier_categories() to authenticated;
grant execute on function public.set_supplier_categories(uuid, uuid[], uuid[]) to authenticated;
grant execute on function public.register_supplier_candidate(uuid, jsonb) to authenticated;
grant execute on function public.update_supplier_candidate(uuid, integer, jsonb) to authenticated;
grant execute on function public.record_candidate_contact(uuid, text, date, date, text) to authenticated;
grant execute on function public.search_supplier_candidates(text, text, uuid, integer, integer) to authenticated;
grant execute on function public.list_candidate_contacts(uuid) to authenticated;
grant execute on function public.convert_candidate_to_supplier(uuid, uuid, jsonb) to authenticated;
-- As funções private.* da etapa são chamadas só dentro das SECURITY DEFINER acima (executam como dono).
-- Pendente de verificação em homologação: confirmar que private.has_permission/default_company_id têm EXECUTE para
-- authenticated (necessário às políticas RLS de leitura), como no padrão das migrations anteriores.
