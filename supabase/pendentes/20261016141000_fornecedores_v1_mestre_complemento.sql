-- ============================================================================================
-- FORNECEDORES V1 · complemento ao pacote mestre (ORIS360_Fornecedores_V1_Mestre)
--
-- STATUS: VERSIONADA, NÃO APLICADA EM NENHUM BANCO. Fica em supabase/pendentes/ de propósito (nenhum `db push` pega).
-- Pré-requisito: 20261016100000_fornecedores_v1_categorias_possiveis.sql (NÃO editada; esta a complementa).
-- Reversão: 20261016141000_fornecedores_v1_mestre_complemento_REVERSAO.sql
--
-- O que faz (tudo aditivo, exceto o que está marcado como MUDANÇA DE COMPORTAMENTO):
--   1. Chaves de permissão próprias (fornecedores.*) com backfill a partir de despesas.* (banco/Pix só para OWNER).
--   2. Colunas novas em public.suppliers (formulário completo do pacote) + revisão concorrente + documento normalizado.
--   3. Contatos adicionais, favorecido/banco/Pix (tabela separada, RLS própria), arquivos/fotos, cotações da avaliação.
--   4. Eventos mínimos (supplier_events): só ids e NOMES de campos alterados, nunca valores. Sem consumidor: "registrado".
--   5. RPCs: create/update/ativar fornecedor, banco, arquivos, cotações, posição financeira, exportação, rascunho do formulário.
--   6. MUDANÇA DE COMPORTAMENTO: RLS de suppliers. Antes: qualquer membro ativo lia e gravava direto (inclusive DELETE).
--      Agora: leitura por permissão (fornecedores.read, despesas.read, operations.factory.*, estoque.movimentar);
--      escrita SOMENTE pelas RPCs (INSERT/UPDATE/DELETE revogados de authenticated). Sem exclusão: ativo/inativo (D5).
--   7. MUDANÇA DE COMPORTAMENTO: contato (name) e telefone deixam de ser exigidos (pacote não exige).
-- Fonte financeira (D10): expense_launches (comprado), expenses (títulos/baixas). Ver docs/fornecedores/CONFORMIDADE_PACOTE.md.
-- ============================================================================================

-- 1. Permissões ----------------------------------------------------------------------------
insert into public.permissions (key, name, description, sensitivity) values
  ('fornecedores.read', 'Ver fornecedores', 'Consultar cadastro comercial, ficha e possíveis fornecedores', 'NORMAL'),
  ('fornecedores.manage', 'Cadastrar e editar fornecedores', 'Criar, editar, ativar/inativar fornecedores e registrar avaliações', 'SENSITIVE'),
  ('fornecedores.categorias', 'Gerenciar categorias de fornecedores', 'Criar, renomear e inativar categorias do catálogo', 'NORMAL'),
  ('fornecedores.financeiro', 'Ver posição financeira do fornecedor', 'Comprado, pago, em aberto e pontualidade na lista e na ficha', 'SENSITIVE'),
  ('fornecedores.anexos', 'Gerenciar anexos de fornecedores', 'Fotos, contratos, propostas e arquivos de avaliações', 'SENSITIVE'),
  ('fornecedores.exportar', 'Exportar fornecedores', 'Exportar o conjunto filtrado em CSV', 'SENSITIVE'),
  ('fornecedores.banco.read', 'Ver favorecido, banco e Pix', 'Consultar dados bancários do fornecedor para conferência', 'CRITICAL'),
  ('fornecedores.banco.manage', 'Alterar favorecido, banco e Pix', 'Cadastrar e alterar dados bancários (invalida a conferência)', 'CRITICAL'),
  ('fornecedores.banco.verify', 'Conferir favorecido, banco e Pix', 'Marcar os dados bancários como conferidos', 'CRITICAL')
on conflict (key) do nothing;

-- Backfill: quem já lia/gerenciava Despesas mantém o acesso que tinha ao domínio de fornecedores.
insert into public.role_permissions (company_id, role_id, permission_key)
select rp.company_id, rp.role_id, k.key
from public.role_permissions rp
join (values ('despesas.read', 'fornecedores.read'), ('despesas.read', 'fornecedores.financeiro'),
             ('despesas.manage', 'fornecedores.manage'), ('despesas.manage', 'fornecedores.categorias'),
             ('despesas.manage', 'fornecedores.anexos'), ('despesas.manage', 'fornecedores.exportar')) as k(src, key)
  on k.src = rp.permission_key
on conflict do nothing;
-- Dados bancários: nunca por herança. Somente o papel OWNER recebe de partida.
insert into public.role_permissions (company_id, role_id, permission_key)
select r.company_id, r.id, p.key
from public.roles r
cross join (values ('fornecedores.banco.read'), ('fornecedores.banco.manage'), ('fornecedores.banco.verify')) as p(key)
where r.key = 'OWNER'
on conflict do nothing;

-- 2. suppliers: colunas do formulário completo -------------------------------------------------
alter table public.suppliers alter column name set default '';
alter table public.suppliers alter column phone set default '';
alter table public.suppliers alter column company_name set default '';

alter table public.suppliers
  add column person_type text not null default 'PJ' check (person_type in ('PJ', 'PF')),
  add column active boolean not null default true,
  add column tax_profile text not null default '' check (tax_profile in ('', 'MEI', 'Simples Nacional', 'Regime normal')),
  add column state_exempt boolean not null default false,
  add column contact_role text not null default '',
  add column contact_whatsapp boolean not null default true,
  add column street_number text not null default '',
  add column complement text not null default '',
  add column reference_note text not null default '',
  add column ibge_code text not null default '' check (ibge_code = '' or ibge_code ~ '^[0-9]{7}$'),
  add column latitude numeric(9, 6),
  add column longitude numeric(9, 6),
  add column location_source text check (location_source is null or location_source in ('MANUAL', 'GPS')),
  add column location_accuracy_m numeric check (location_accuracy_m is null or location_accuracy_m >= 0),
  add column location_confirmed_at timestamptz,
  add column location_confirmed_by uuid,
  add column buyer_name text not null default '',
  add column cost_center text not null default '',
  add column supply_type text not null default '',
  add column origin text not null default '',
  add column service_notes text not null default '',
  add column sales_email text not null default '',
  add column invoice_email text not null default '',
  add column website text not null default '',
  add column external_customer_code text not null default '',
  add column lead_time_days integer check (lead_time_days is null or lead_time_days between 0 and 365),
  add column minimum_order_cents bigint not null default 0 check (minimum_order_cents >= 0),
  add column freight_terms text not null default '',
  add column receiving_notes text not null default '',
  add column credit_limit_cents bigint not null default 0 check (credit_limit_cents >= 0),
  add column payment_terms text not null default '' check (payment_terms in ('', 'cash', '7', '14', '21', '28', 'custom')),
  add column payment_method text not null default '',
  add column negotiation_notes text not null default '',
  add column revision integer not null default 1,
  add column command_id uuid,
  add column command_hash text,
  add column document_key text generated always as (upper(regexp_replace(cnpj, '[^0-9A-Za-z]', '', 'g'))) stored,
  add constraint suppliers_lat_lon_pair check ((latitude is null) = (longitude is null)),
  add constraint suppliers_lat_range check (latitude is null or latitude between -90 and 90),
  add constraint suppliers_lon_range check (longitude is null or longitude between -180 and 180),
  add constraint suppliers_company_command_unique unique (company_id, command_id);
-- Duplicidade por documento normalizado (letras e zeros preservados). Produção lida em 2026-10-16: 0 duplicados.
create unique index suppliers_company_document_key on public.suppliers (company_id, document_key) where document_key <> '';
create index suppliers_company_active_idx on public.suppliers (company_id, active);

-- 3. Tabelas filhas -----------------------------------------------------------------------------
create table public.supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  supplier_id uuid not null,
  position integer not null default 0,
  name text not null default '',
  role text not null default '',
  phone text not null default '',
  whatsapp boolean not null default false,
  email text not null default '',
  created_at timestamptz not null default now(),
  foreign key (company_id, supplier_id) references public.suppliers (company_id, id) on delete cascade
);
create index supplier_contacts_supplier_idx on public.supplier_contacts (supplier_id, position);

create table public.supplier_bank_details (
  supplier_id uuid primary key,
  company_id uuid not null,
  beneficiary_name text not null default '',
  beneficiary_document text not null default '',
  bank text not null default '',
  branch text not null default '',
  account text not null default '',
  pix_type text not null default '' check (pix_type in ('', 'CPF/CNPJ', 'E-mail', 'Telefone', 'Aleatória')),
  pix_key text not null default '',
  notes text not null default '',
  verification_status text not null default 'PENDENTE' check (verification_status in ('PENDENTE', 'VERIFICADO')),
  verified_by uuid,
  verified_at timestamptz,
  bank_revision integer not null default 1,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, supplier_id) references public.suppliers (company_id, id) on delete cascade
);

create table public.supplier_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  supplier_id uuid,
  candidate_id uuid,
  kind text not null check (kind in ('FOTO', 'DOCUMENTO', 'REFERENCIA')),
  photo_kind text check (photo_kind is null or photo_kind in ('Fachada', 'Interior', 'Outra')),
  caption text not null default '',
  is_primary boolean not null default false,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid default auth.uid(),
  uploaded_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid,
  check (supplier_id is not null or candidate_id is not null),
  foreign key (company_id, supplier_id) references public.suppliers (company_id, id),
  foreign key (company_id, candidate_id) references public.supplier_candidates (company_id, id)
);
create index supplier_files_supplier_idx on public.supplier_files (supplier_id) where removed_at is null;
create index supplier_files_candidate_idx on public.supplier_files (candidate_id) where removed_at is null;
create unique index supplier_files_one_primary on public.supplier_files (supplier_id) where is_primary and removed_at is null;

-- Cotação é estimativa de referência: não é compra, obrigação nem limite.
create table public.supplier_candidate_quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  candidate_id uuid not null,
  item text not null check (length(btrim(item)) between 1 and 120),
  unit text not null check (length(btrim(unit)) between 1 and 20),
  quantity numeric not null check (quantity > 0),
  price_cents bigint not null check (price_cents >= 0),
  freight_cents bigint not null default 0 check (freight_cents >= 0),
  valid_until date,
  source text not null default '',
  quoted_on date not null default current_date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (company_id, candidate_id) references public.supplier_candidates (company_id, id) on delete cascade
);
create index supplier_candidate_quotes_idx on public.supplier_candidate_quotes (candidate_id, quoted_on desc);

alter table public.supplier_candidate_contacts drop constraint if exists supplier_candidate_contacts_kind_check;
alter table public.supplier_candidate_contacts
  add constraint supplier_candidate_contacts_kind_check check (kind in ('CONTATO', 'CONVERSAO', 'COTACAO'));

-- 4. Eventos mínimos ----------------------------------------------------------------------------
-- Só ids, revisão e NOMES de campos. Nunca telefone, documento, banco/Pix, valores, localização ou URLs.
create table public.supplier_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  event_type text not null,
  event_version integer not null default 1,
  entity_type text not null,
  entity_id uuid not null,
  entity_revision integer,
  occurred_at timestamptz not null default now(),
  actor_id uuid default auth.uid(),
  command_id uuid,
  correlation_id uuid not null default gen_random_uuid(),
  payload jsonb not null default '{}'::jsonb
);
create index supplier_events_entity_idx on public.supplier_events (company_id, entity_id, occurred_at desc);

create or replace function private.supplier_emit(p_company uuid, p_type text, p_entity_type text, p_entity uuid, p_revision integer, p_payload jsonb)
returns void
language sql
security definer
set search_path to ''
as $$
  insert into public.supplier_events (company_id, event_type, entity_type, entity_id, entity_revision, payload)
  values (p_company, p_type, p_entity_type, p_entity, p_revision, coalesce(p_payload, '{}'::jsonb));
$$;
revoke all on function private.supplier_emit(uuid, text, text, uuid, integer, jsonb) from public, anon, authenticated;

create or replace function private.supplier_changed_fields(p_old jsonb, p_new jsonb, p_ignore text[])
returns jsonb
language sql
immutable
set search_path to ''
as $$
  select coalesce(jsonb_agg(e.key order by e.key), '[]'::jsonb)
  from jsonb_each(p_new) e
  where p_old -> e.key is distinct from e.value and not (e.key = any (p_ignore))
$$;

create or replace function private.supplier_trg_suppliers()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_fields jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.supplier_emit(new.company_id, 'supplier.created', 'supplier', new.id, new.revision, '{}'::jsonb);
  else
    v_fields := private.supplier_changed_fields(to_jsonb(old), to_jsonb(new),
      array['updated_at', 'revision', 'command_id', 'command_hash', 'document_key']);
    if jsonb_array_length(v_fields) > 0 then
      perform private.supplier_emit(new.company_id, 'supplier.updated', 'supplier', new.id, new.revision, jsonb_build_object('fields', v_fields));
    end if;
  end if;
  return null;
end $$;
create trigger supplier_events_suppliers after insert or update on public.suppliers
  for each row execute function private.supplier_trg_suppliers();

create or replace function private.supplier_trg_categories()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.supplier_emit(new.company_id, 'supplier_category.created', 'supplier_category', new.id, null, '{}'::jsonb);
  elsif new.active is distinct from old.active and not new.active then
    perform private.supplier_emit(new.company_id, 'supplier_category.deactivated', 'supplier_category', new.id, null, '{}'::jsonb);
  elsif new.name is distinct from old.name or new.active is distinct from old.active then
    perform private.supplier_emit(new.company_id, 'supplier_category.updated', 'supplier_category', new.id, null, '{}'::jsonb);
  end if;
  return null;
end $$;
create trigger supplier_events_categories after insert or update on public.supplier_categories
  for each row execute function private.supplier_trg_categories();

create or replace function private.supplier_trg_links()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.supplier_emit(new.company_id, 'supplier.categories_changed', 'supplier', new.supplier_id, null,
      jsonb_build_object('op', 'added', 'category_id', new.category_id));
  else
    perform private.supplier_emit(old.company_id, 'supplier.categories_changed', 'supplier', old.supplier_id, null,
      jsonb_build_object('op', 'removed', 'category_id', old.category_id));
  end if;
  return null;
end $$;
create trigger supplier_events_links after insert or delete on public.supplier_category_links
  for each row execute function private.supplier_trg_links();

create or replace function private.supplier_trg_candidates()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_fields jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.supplier_emit(new.company_id, 'supplier_candidate.registered', 'supplier_candidate', new.id, new.revision, '{}'::jsonb);
  elsif new.stage = 'CADASTRADO' and old.stage <> 'CADASTRADO' then
    perform private.supplier_emit(new.company_id, 'supplier_candidate.converted', 'supplier_candidate', new.id, new.revision,
      jsonb_build_object('supplier_id', new.linked_supplier_id));
  else
    v_fields := private.supplier_changed_fields(to_jsonb(old), to_jsonb(new),
      array['updated_at', 'revision', 'last_contact_on', 'next_contact_on', 'linked_supplier_id', 'converted_at', 'converted_by', 'search_key']);
    if jsonb_array_length(v_fields) > 0 then
      perform private.supplier_emit(new.company_id, 'supplier_candidate.updated', 'supplier_candidate', new.id, new.revision, jsonb_build_object('fields', v_fields));
    end if;
  end if;
  return null;
end $$;
create trigger supplier_events_candidates after insert or update on public.supplier_candidates
  for each row execute function private.supplier_trg_candidates();

create or replace function private.supplier_trg_candidate_contacts()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.kind = 'CONTATO' then
    perform private.supplier_emit(new.company_id, 'supplier_candidate.contact_recorded', 'supplier_candidate', new.candidate_id, null, '{}'::jsonb);
  end if;
  return null;
end $$;
create trigger supplier_events_candidate_contacts after insert on public.supplier_candidate_contacts
  for each row execute function private.supplier_trg_candidate_contacts();

create or replace function private.supplier_trg_bank()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_fields jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.supplier_emit(new.company_id, 'supplier.bank_details_changed', 'supplier', new.supplier_id, new.bank_revision, '{}'::jsonb);
  else
    v_fields := private.supplier_changed_fields(to_jsonb(old), to_jsonb(new),
      array['updated_at', 'updated_by', 'bank_revision', 'verification_status', 'verified_by', 'verified_at']);
    if jsonb_array_length(v_fields) > 0 then
      perform private.supplier_emit(new.company_id, 'supplier.bank_details_changed', 'supplier', new.supplier_id, new.bank_revision, jsonb_build_object('fields', v_fields));
    end if;
    if new.verification_status = 'VERIFICADO' and old.verification_status <> 'VERIFICADO' then
      perform private.supplier_emit(new.company_id, 'supplier.bank_details_verified', 'supplier', new.supplier_id, new.bank_revision, '{}'::jsonb);
    end if;
  end if;
  return null;
end $$;
create trigger supplier_events_bank after insert or update on public.supplier_bank_details
  for each row execute function private.supplier_trg_bank();

create or replace function private.supplier_trg_files()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.supplier_emit(new.company_id, 'media.changed', 'supplier', coalesce(new.supplier_id, new.candidate_id), null,
      jsonb_build_object('op', 'added', 'file_id', new.id));
  elsif new.removed_at is not null and old.removed_at is null then
    perform private.supplier_emit(new.company_id, 'media.changed', 'supplier', coalesce(new.supplier_id, new.candidate_id), null,
      jsonb_build_object('op', 'removed', 'file_id', new.id));
  end if;
  return null;
end $$;
create trigger supplier_events_files after insert or update on public.supplier_files
  for each row execute function private.supplier_trg_files();

-- 5. RLS e grants -----------------------------------------------------------------------------
alter table public.supplier_contacts enable row level security;
alter table public.supplier_bank_details enable row level security;
alter table public.supplier_files enable row level security;
alter table public.supplier_candidate_quotes enable row level security;
alter table public.supplier_events enable row level security;

-- suppliers: leitura por permissão; nenhuma política de escrita (só RPC).
drop policy if exists suppliers_admin_select_all on public.suppliers;
drop policy if exists suppliers_admin_insert on public.suppliers;
drop policy if exists suppliers_admin_update on public.suppliers;
drop policy if exists suppliers_admin_delete on public.suppliers;
create policy suppliers_select_by_permission on public.suppliers for select to authenticated
  using ((select private.has_permission(company_id, 'fornecedores.read'))
      or (select private.has_permission(company_id, 'despesas.read'))
      or (select private.has_permission(company_id, 'operations.factory.read'))
      or (select private.has_permission(company_id, 'operations.factory.manage'))
      or (select private.has_permission(company_id, 'estoque.movimentar')));

-- tabelas da migration anterior: leitura por fornecedores.read (categorias/vínculos também por despesas.read, p/ o seletor de Compras)
drop policy if exists supplier_categories_select on public.supplier_categories;
drop policy if exists supplier_category_links_select on public.supplier_category_links;
drop policy if exists supplier_candidates_select on public.supplier_candidates;
drop policy if exists supplier_candidate_products_select on public.supplier_candidate_products;
drop policy if exists supplier_candidate_categories_select on public.supplier_candidate_categories;
drop policy if exists supplier_candidate_contacts_select on public.supplier_candidate_contacts;
create policy supplier_categories_select on public.supplier_categories for select to authenticated
  using ((select private.has_permission(company_id, 'fornecedores.read')) or (select private.has_permission(company_id, 'despesas.read')));
create policy supplier_category_links_select on public.supplier_category_links for select to authenticated
  using ((select private.has_permission(company_id, 'fornecedores.read')) or (select private.has_permission(company_id, 'despesas.read')));
create policy supplier_candidates_select on public.supplier_candidates for select to authenticated
  using ((select private.has_permission(company_id, 'fornecedores.read')));
create policy supplier_candidate_products_select on public.supplier_candidate_products for select to authenticated
  using ((select private.has_permission(company_id, 'fornecedores.read')));
create policy supplier_candidate_categories_select on public.supplier_candidate_categories for select to authenticated
  using ((select private.has_permission(company_id, 'fornecedores.read')));
create policy supplier_candidate_contacts_select on public.supplier_candidate_contacts for select to authenticated
  using ((select private.has_permission(company_id, 'fornecedores.read')));

create policy supplier_contacts_select on public.supplier_contacts for select to authenticated
  using ((select private.has_permission(company_id, 'fornecedores.read')));
create policy supplier_bank_details_select on public.supplier_bank_details for select to authenticated
  using ((select private.has_permission(company_id, 'fornecedores.banco.read')));
create policy supplier_files_select on public.supplier_files for select to authenticated
  using ((select private.has_permission(company_id, 'fornecedores.anexos')));
create policy supplier_candidate_quotes_select on public.supplier_candidate_quotes for select to authenticated
  using ((select private.has_permission(company_id, 'fornecedores.read')));
create policy supplier_events_select on public.supplier_events for select to authenticated
  using ((select private.has_permission(company_id, 'fornecedores.read')));

revoke all on public.suppliers, public.supplier_contacts, public.supplier_bank_details, public.supplier_files,
  public.supplier_candidate_quotes, public.supplier_events from anon;
revoke all on public.suppliers, public.supplier_contacts, public.supplier_bank_details,
  public.supplier_files, public.supplier_candidate_quotes, public.supplier_events from authenticated;
grant select on public.suppliers, public.supplier_contacts, public.supplier_bank_details,
  public.supplier_files, public.supplier_candidate_quotes, public.supplier_events to authenticated;

-- Storage privado para arquivos de fornecedores: <company_id>/<arquivo>. Sem UPDATE/DELETE para usuários (evidência preservada).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('supplier-files', 'supplier-files', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy supplier_files_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'supplier-files'
    and private.oris360_storage_company_id(objects.name) is not null
    and (select private.has_permission(private.oris360_storage_company_id(objects.name), 'fornecedores.anexos')));
create policy supplier_files_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'supplier-files'
    and private.oris360_storage_company_id(objects.name) is not null
    and (select private.has_permission(private.oris360_storage_company_id(objects.name), 'fornecedores.anexos')));

-- 6. Guarda de empresa/permissão ----------------------------------------------------------------
-- As RPCs da migration anterior chamam com 'despesas.*'; aqui viram as chaves próprias.
create or replace function private.supplier_company_for(p_permission text)
returns uuid
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid := (select private.default_company_id());
  v_perm text := case p_permission when 'despesas.read' then 'fornecedores.read' when 'despesas.manage' then 'fornecedores.manage' else p_permission end;
begin
  if v_company is null or not (select private.has_permission(v_company, v_perm)) then
    raise exception 'Sem permissão para esta operação de fornecedores';
  end if;
  return v_company;
end;
$$;
revoke all on function private.supplier_company_for(text) from public, anon, authenticated;

-- Categorias: exigem a chave de categorias (antes: despesas.manage).
create or replace function public.create_supplier_category(p_name text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.categorias');
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
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.categorias');
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

create or replace function public.set_supplier_category_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.categorias');
begin
  update public.supplier_categories set active = coalesce(p_active, true), updated_at = now()
    where id = p_id and company_id = v_company;
  if not found then raise exception 'Categoria não encontrada'; end if;
end;
$$;

create or replace function public.ensure_default_supplier_categories()
returns integer language plpgsql security definer set search_path to '' as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.categorias');
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

-- 7. Cadastro do fornecedor -----------------------------------------------------------------------
create or replace function private.supplier_clean(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path to ''
as $$
declare
  a jsonb;
  b jsonb;
begin
  a := jsonb_build_object(
    'name', btrim(coalesce(p ->> 'name', '')), 'company_name', btrim(coalesce(p ->> 'company_name', '')),
    'phone', btrim(coalesce(p ->> 'phone', '')), 'trade_name', btrim(coalesce(p ->> 'trade_name', '')),
    'cnpj', btrim(coalesce(p ->> 'cnpj', '')), 'ie', btrim(coalesce(p ->> 'ie', '')),
    'email', btrim(coalesce(p ->> 'email', '')), 'address', btrim(coalesce(p ->> 'address', '')),
    'neighborhood', btrim(coalesce(p ->> 'neighborhood', '')), 'cep', btrim(coalesce(p ->> 'cep', '')),
    'city', btrim(coalesce(p ->> 'city', '')), 'state', upper(btrim(coalesce(p ->> 'state', ''))),
    'person_type', coalesce(nullif(btrim(p ->> 'person_type'), ''), 'PJ'),
    'active', coalesce((p ->> 'active')::boolean, true),
    'tax_profile', btrim(coalesce(p ->> 'tax_profile', '')),
    'state_exempt', coalesce((p ->> 'state_exempt')::boolean, false),
    'contact_role', btrim(coalesce(p ->> 'contact_role', '')),
    'contact_whatsapp', coalesce((p ->> 'contact_whatsapp')::boolean, true),
    'street_number', btrim(coalesce(p ->> 'street_number', '')), 'complement', btrim(coalesce(p ->> 'complement', '')),
    'reference_note', btrim(coalesce(p ->> 'reference_note', '')),
    'ibge_code', btrim(coalesce(p ->> 'ibge_code', '')),
    'latitude', nullif(replace(btrim(coalesce(p ->> 'latitude', '')), ',', '.'), '')::numeric,
    'longitude', nullif(replace(btrim(coalesce(p ->> 'longitude', '')), ',', '.'), '')::numeric,
    'location_source', nullif(btrim(coalesce(p ->> 'location_source', '')), ''),
    'location_accuracy_m', nullif(btrim(coalesce(p ->> 'location_accuracy_m', '')), '')::numeric
  );
  b := jsonb_build_object(
    'buyer_name', btrim(coalesce(p ->> 'buyer_name', '')), 'cost_center', btrim(coalesce(p ->> 'cost_center', '')),
    'supply_type', btrim(coalesce(p ->> 'supply_type', '')), 'origin', btrim(coalesce(p ->> 'origin', '')),
    'service_notes', btrim(coalesce(p ->> 'service_notes', '')),
    'sales_email', btrim(coalesce(p ->> 'sales_email', '')), 'invoice_email', btrim(coalesce(p ->> 'invoice_email', '')),
    'website', btrim(coalesce(p ->> 'website', '')),
    'external_customer_code', btrim(coalesce(p ->> 'external_customer_code', '')),
    'lead_time_days', nullif(btrim(coalesce(p ->> 'lead_time_days', '')), '')::integer,
    'minimum_order_cents', coalesce(nullif(btrim(coalesce(p ->> 'minimum_order_cents', '')), '')::bigint, 0),
    'freight_terms', btrim(coalesce(p ->> 'freight_terms', '')), 'receiving_notes', btrim(coalesce(p ->> 'receiving_notes', '')),
    'credit_limit_cents', coalesce(nullif(btrim(coalesce(p ->> 'credit_limit_cents', '')), '')::bigint, 0),
    'payment_terms', btrim(coalesce(p ->> 'payment_terms', '')), 'payment_method', btrim(coalesce(p ->> 'payment_method', '')),
    'negotiation_notes', btrim(coalesce(p ->> 'negotiation_notes', '')),
    'location_confirmed', coalesce((p ->> 'location_confirmed')::boolean, false)
  );
  return a || b;
end;
$$;

create or replace function private.supplier_validate(p_n jsonb, p_old public.suppliers, p_create boolean)
returns void
language plpgsql
set search_path to ''
as $$
declare
  v_doc text := upper(regexp_replace(p_n ->> 'cnpj', '[^0-9A-Za-z]', '', 'g'));
  v_field text;
  v_label text;
  v_old jsonb := case when p_old.id is null then '{}'::jsonb else to_jsonb(p_old) end;
begin
  if (p_n ->> 'trade_name') = '' then raise exception 'Informe o nome do fornecedor'; end if;
  if (p_n ->> 'company_name') = '' then raise exception 'Informe a razão social ou o nome completo'; end if;
  -- Endereço e documento são exigidos no cadastro novo; em edição de legado vazio, só não podem ser apagados depois de preenchidos.
  for v_field, v_label in select * from (values ('cnpj', 'o documento'), ('state', 'o estado'), ('city', 'o município'),
      ('address', 'o logradouro'), ('street_number', 'o número (ou S/N)')) as t(f, l) loop
    if (p_n ->> v_field) = '' and (p_create or coalesce(v_old ->> v_field, '') <> '') then
      raise exception 'Informe %', v_label;
    end if;
  end loop;
  if p_n ->> 'person_type' not in ('PJ', 'PF') then raise exception 'Tipo de pessoa inválido'; end if;
  if v_doc <> '' and (p_create or p_old.id is null or upper(regexp_replace(p_old.cnpj, '[^0-9A-Za-z]', '', 'g')) <> v_doc) then
    if p_n ->> 'person_type' = 'PF' and v_doc !~ '^[0-9]{11}$' then raise exception 'O CPF deve conter 11 números'; end if;
    if p_n ->> 'person_type' = 'PJ' and v_doc !~ '^[A-Z0-9]{12}[0-9]{2}$' then
      raise exception 'O CNPJ deve conter 14 posições, com os dois últimos caracteres numéricos';
    end if;
  end if;
  if (p_n ->> 'state') <> '' and (p_n ->> 'state') !~ '^[A-Z]{2}$' then raise exception 'UF inválida'; end if;
  if (p_n ->> 'cep') <> '' and regexp_replace(p_n ->> 'cep', '\D', '', 'g') !~ '^[0-9]{8}$' then raise exception 'CEP deve ter 8 números'; end if;
  if (p_n ->> 'ibge_code') <> '' and (p_n ->> 'ibge_code') !~ '^[0-9]{7}$' then raise exception 'Código IBGE deve ter 7 dígitos'; end if;
  if (p_n ->> 'email') <> '' and (p_n ->> 'email') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido'; end if;
  if (p_n ->> 'sales_email') <> '' and (p_n ->> 'sales_email') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail de pedidos inválido'; end if;
  if (p_n ->> 'invoice_email') <> '' and (p_n ->> 'invoice_email') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail de notas inválido'; end if;
  if (p_n ->> 'website') <> '' and (p_n ->> 'website') !~* '^https?://' then raise exception 'Informe o site com http:// ou https://'; end if;
  if (p_n ->> 'tax_profile') not in ('', 'MEI', 'Simples Nacional', 'Regime normal') then raise exception 'Enquadramento inválido'; end if;
  if (p_n ->> 'payment_terms') not in ('', 'cash', '7', '14', '21', '28', 'custom') then raise exception 'Prazo de pagamento inválido'; end if;
  if (p_n ->> 'location_source') is not null and (p_n ->> 'location_source') not in ('MANUAL', 'GPS') then raise exception 'Origem do ponto inválida'; end if;
  if ((p_n -> 'latitude') = 'null'::jsonb) <> ((p_n -> 'longitude') = 'null'::jsonb) then
    raise exception 'Latitude e longitude devem ser informadas juntas';
  end if;
  if (p_n ->> 'latitude') is not null then
    if (p_n ->> 'latitude')::numeric not between -90 and 90 or (p_n ->> 'longitude')::numeric not between -180 and 180 then
      raise exception 'Coordenadas fora da faixa (latitude -90 a 90, longitude -180 a 180)';
    end if;
    if not (p_n ->> 'location_confirmed')::boolean then raise exception 'Confirme que o ponto corresponde ao fornecedor'; end if;
  end if;
  if (p_n ->> 'minimum_order_cents')::bigint < 0 or (p_n ->> 'credit_limit_cents')::bigint < 0 then raise exception 'Valores não podem ser negativos'; end if;
end;
$$;

-- Sincroniza contatos adicionais (substitui a lista) e categorias (delta, sem apagar a seleção de outra pessoa).
create or replace function private.supplier_sync_children(p_company uuid, p_supplier uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_c jsonb;
  v_i integer := 0;
  v_cat uuid;
begin
  if p_payload ? 'contacts' then
    if jsonb_typeof(p_payload -> 'contacts') <> 'array' or jsonb_array_length(p_payload -> 'contacts') > 20 then
      raise exception 'Contatos inválidos (máximo 20)';
    end if;
    delete from public.supplier_contacts where supplier_id = p_supplier and company_id = p_company;
    for v_c in select * from jsonb_array_elements(p_payload -> 'contacts') loop
      if btrim(coalesce(v_c ->> 'name', '') || coalesce(v_c ->> 'phone', '') || coalesce(v_c ->> 'email', '')) <> '' then
        v_i := v_i + 1;
        insert into public.supplier_contacts (company_id, supplier_id, position, name, role, phone, whatsapp, email)
          values (p_company, p_supplier, v_i, btrim(coalesce(v_c ->> 'name', '')), btrim(coalesce(v_c ->> 'role', '')),
            btrim(coalesce(v_c ->> 'phone', '')), coalesce((v_c ->> 'whatsapp')::boolean, false), btrim(coalesce(v_c ->> 'email', '')));
      end if;
    end loop;
  end if;
  -- criação usa category_ids (todas as marcadas); edição usa category_add / category_remove
  for v_cat in select t.val::uuid from jsonb_array_elements_text(coalesce(p_payload -> 'category_ids', p_payload -> 'category_add', '[]'::jsonb)) as t(val) loop
    if exists (select 1 from public.supplier_category_links l where l.supplier_id = p_supplier and l.category_id = v_cat) then continue; end if;
    if not exists (select 1 from public.supplier_categories c where c.id = v_cat and c.company_id = p_company and c.active) then
      raise exception 'Categoria inexistente ou inativa';
    end if;
    insert into public.supplier_category_links (company_id, supplier_id, category_id) values (p_company, p_supplier, v_cat);
  end loop;
  delete from public.supplier_category_links
    where supplier_id = p_supplier and company_id = p_company
      and category_id in (select t.val::uuid from jsonb_array_elements_text(coalesce(p_payload -> 'category_remove', '[]'::jsonb)) as t(val));
end;
$$;
revoke all on function private.supplier_sync_children(uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function private.supplier_create_core(p_company uuid, p_payload jsonb, p_command uuid, p_hash text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  n jsonb := private.supplier_clean(p_payload);
  r public.suppliers;
  v_doc text := upper(regexp_replace(n ->> 'cnpj', '[^0-9A-Za-z]', '', 'g'));
  v_dup uuid;
  v_id uuid;
begin
  perform private.supplier_validate(n, null::public.suppliers, true);
  if v_doc <> '' then
    perform pg_advisory_xact_lock(hashtext(p_company::text || ':' || v_doc));
    select s.id into v_dup from public.suppliers s where s.company_id = p_company and s.document_key = v_doc limit 1;
    if v_dup is not null then raise exception 'DUPLICADO:%', v_dup; end if;
  end if;
  r := jsonb_populate_record(null::public.suppliers, n);
  insert into public.suppliers (company_id, name, company_name, phone, trade_name, cnpj, ie, email, address, neighborhood, cep, city, state,
      person_type, active, tax_profile, state_exempt, contact_role, contact_whatsapp, street_number, complement, reference_note, ibge_code,
      latitude, longitude, location_source, location_accuracy_m, location_confirmed_at, location_confirmed_by,
      buyer_name, cost_center, supply_type, origin, service_notes, sales_email, invoice_email, website, external_customer_code,
      lead_time_days, minimum_order_cents, freight_terms, receiving_notes, credit_limit_cents, payment_terms, payment_method,
      negotiation_notes, command_id, command_hash)
    values (p_company, r.name, r.company_name, r.phone, r.trade_name, r.cnpj, r.ie, r.email, r.address, r.neighborhood, r.cep, r.city, r.state,
      r.person_type, r.active, r.tax_profile, case when r.state_exempt then true else false end, r.contact_role, r.contact_whatsapp,
      r.street_number, r.complement, r.reference_note, r.ibge_code,
      r.latitude, r.longitude, r.location_source, r.location_accuracy_m,
      case when r.latitude is not null then now() end, case when r.latitude is not null then auth.uid() end,
      r.buyer_name, r.cost_center, r.supply_type, r.origin, r.service_notes, r.sales_email, r.invoice_email, r.website, r.external_customer_code,
      r.lead_time_days, r.minimum_order_cents, r.freight_terms, r.receiving_notes, r.credit_limit_cents, r.payment_terms, r.payment_method,
      r.negotiation_notes, p_command, p_hash)
    returning id into v_id;
  perform private.supplier_sync_children(p_company, v_id, p_payload);
  return v_id;
end;
$$;
revoke all on function private.supplier_create_core(uuid, jsonb, uuid, text) from public, anon, authenticated;

create or replace function public.create_supplier(p_command_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.manage');
  v_hash text := md5(coalesce(p_payload, '{}'::jsonb)::text);
  v_row public.suppliers;
  v_id uuid;
begin
  if p_command_id is null then raise exception 'command_id obrigatório'; end if;
  select * into v_row from public.suppliers where company_id = v_company and command_id = p_command_id;
  if found then
    if v_row.command_hash <> v_hash then raise exception 'CONFLITO_COMANDO: este command_id já foi usado com outro conteúdo'; end if;
    return jsonb_build_object('id', v_row.id, 'revision', v_row.revision, 'replayed', true);
  end if;
  v_id := private.supplier_create_core(v_company, p_payload, p_command_id, v_hash);
  return jsonb_build_object('id', v_id, 'revision', 1, 'replayed', false);
end;
$$;

create or replace function public.update_supplier(p_id uuid, p_expected_revision integer, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.manage');
  s public.suppliers;
  n jsonb := private.supplier_clean(p_payload);
  r public.suppliers;
  v_doc text := upper(regexp_replace(n ->> 'cnpj', '[^0-9A-Za-z]', '', 'g'));
  v_dup uuid;
  v_geo_changed boolean;
  v_confirm boolean;
begin
  select * into s from public.suppliers where id = p_id and company_id = v_company for update;
  if not found then raise exception 'Fornecedor não encontrado'; end if;
  if s.revision <> p_expected_revision then
    raise exception 'CONFLITO_REVISAO: o fornecedor foi alterado por outra pessoa (revisão atual %)', s.revision;
  end if;
  perform private.supplier_validate(n, s, false);
  if v_doc <> '' and v_doc <> s.document_key then
    perform pg_advisory_xact_lock(hashtext(v_company::text || ':' || v_doc));
    select x.id into v_dup from public.suppliers x where x.company_id = v_company and x.document_key = v_doc and x.id <> s.id limit 1;
    if v_dup is not null then raise exception 'DUPLICADO:%', v_dup; end if;
  end if;
  r := jsonb_populate_record(null::public.suppliers, n);
  -- Mudar endereço ou ponto invalida a confirmação anterior; só vale a nova se o pedido a trouxer.
  v_geo_changed := r.latitude is distinct from s.latitude or r.longitude is distinct from s.longitude
    or r.address is distinct from s.address or r.street_number is distinct from s.street_number
    or r.city is distinct from s.city or r.state is distinct from s.state or r.cep is distinct from s.cep
    or r.neighborhood is distinct from s.neighborhood or r.complement is distinct from s.complement;
  v_confirm := r.latitude is not null and (n ->> 'location_confirmed')::boolean;
  update public.suppliers set
      name = r.name, company_name = r.company_name, phone = r.phone, trade_name = r.trade_name, cnpj = r.cnpj, ie = r.ie, email = r.email,
      address = r.address, neighborhood = r.neighborhood, cep = r.cep, city = r.city, state = r.state,
      person_type = r.person_type, active = r.active, tax_profile = r.tax_profile, state_exempt = coalesce(r.state_exempt, false),
      contact_role = r.contact_role, contact_whatsapp = r.contact_whatsapp, street_number = r.street_number, complement = r.complement,
      reference_note = r.reference_note, ibge_code = r.ibge_code,
      latitude = r.latitude, longitude = r.longitude, location_source = r.location_source, location_accuracy_m = r.location_accuracy_m,
      location_confirmed_at = case when not v_confirm then null when v_geo_changed or s.location_confirmed_at is null then now() else s.location_confirmed_at end,
      location_confirmed_by = case when not v_confirm then null when v_geo_changed or s.location_confirmed_at is null then auth.uid() else s.location_confirmed_by end,
      buyer_name = r.buyer_name, cost_center = r.cost_center, supply_type = r.supply_type, origin = r.origin, service_notes = r.service_notes,
      sales_email = r.sales_email, invoice_email = r.invoice_email, website = r.website, external_customer_code = r.external_customer_code,
      lead_time_days = r.lead_time_days, minimum_order_cents = r.minimum_order_cents, freight_terms = r.freight_terms,
      receiving_notes = r.receiving_notes, credit_limit_cents = r.credit_limit_cents, payment_terms = r.payment_terms,
      payment_method = r.payment_method, negotiation_notes = r.negotiation_notes,
      revision = s.revision + 1, updated_at = now()
    where id = s.id
    returning * into s;
  perform private.supplier_sync_children(v_company, s.id, p_payload);
  return jsonb_build_object('id', s.id, 'revision', s.revision);
end;
$$;

-- Ativar/inativar no lugar de excluir. Vínculos, compras e histórico permanecem.
create or replace function public.set_supplier_active(p_id uuid, p_active boolean, p_expected_revision integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.manage');
  s public.suppliers;
begin
  select * into s from public.suppliers where id = p_id and company_id = v_company for update;
  if not found then raise exception 'Fornecedor não encontrado'; end if;
  if s.revision <> p_expected_revision then raise exception 'CONFLITO_REVISAO: o fornecedor foi alterado por outra pessoa (revisão atual %)', s.revision; end if;
  update public.suppliers set active = coalesce(p_active, true), revision = revision + 1, updated_at = now() where id = s.id returning * into s;
  return jsonb_build_object('id', s.id, 'revision', s.revision, 'active', s.active);
end;
$$;

-- Pré-checagem de duplicidade por documento normalizado (a trava de verdade é o índice único + advisory lock).
create or replace function public.find_supplier_by_document(p_document text, p_exclude uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.read');
  v_doc text := upper(regexp_replace(coalesce(p_document, ''), '[^0-9A-Za-z]', '', 'g'));
  s public.suppliers;
begin
  if v_doc = '' then return null; end if;
  select * into s from public.suppliers x where x.company_id = v_company and x.document_key = v_doc and (p_exclude is null or x.id <> p_exclude) limit 1;
  if not found then return null; end if;
  return jsonb_build_object('id', s.id, 'trade_name', s.trade_name, 'company_name', s.company_name, 'active', s.active);
end;
$$;

-- 8. Favorecido / banco / Pix ----------------------------------------------------------------------
create or replace function private.supplier_mask(p_value text)
returns text language sql immutable set search_path to '' as $$
  select case when coalesce(p_value, '') = '' then '' when length(p_value) <= 4 then '••••' else '••••' || right(p_value, 4) end
$$;

-- Máscara por padrão. Texto completo só com p_reveal e permissão de alteração (necessário para editar).
create or replace function public.get_supplier_bank_details(p_supplier_id uuid, p_reveal boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.banco.read');
  b public.supplier_bank_details;
  v_full boolean := coalesce(p_reveal, false);
begin
  if v_full and not (select private.has_permission(v_company, 'fornecedores.banco.manage')) then
    raise exception 'Sem permissão para ver os dados bancários completos';
  end if;
  select * into b from public.supplier_bank_details where supplier_id = p_supplier_id and company_id = v_company;
  if not found then return jsonb_build_object('exists', false); end if;
  return jsonb_build_object('exists', true, 'masked', not v_full,
    'beneficiary_name', b.beneficiary_name,
    'beneficiary_document', case when v_full then b.beneficiary_document else private.supplier_mask(b.beneficiary_document) end,
    'bank', b.bank, 'branch', b.branch,
    'account', case when v_full then b.account else private.supplier_mask(b.account) end,
    'pix_type', b.pix_type,
    'pix_key', case when v_full then b.pix_key else private.supplier_mask(b.pix_key) end,
    'notes', b.notes, 'verification_status', b.verification_status, 'verified_at', b.verified_at, 'bank_revision', b.bank_revision);
end;
$$;

-- Qualquer alteração de titular/documento/banco/agência/conta/chave invalida a conferência anterior. Nunca agenda pagamento.
create or replace function public.set_supplier_bank_details(p_supplier_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.banco.manage');
  o public.supplier_bank_details;
  v_new public.supplier_bank_details;
  v_changed boolean;
  t text := coalesce(nullif(btrim(p_payload ->> 'pix_type'), ''), '');
begin
  if not exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.company_id = v_company) then
    raise exception 'Fornecedor não encontrado';
  end if;
  if t not in ('', 'CPF/CNPJ', 'E-mail', 'Telefone', 'Aleatória') then raise exception 'Tipo de chave Pix inválido'; end if;
  select * into o from public.supplier_bank_details where supplier_id = p_supplier_id and company_id = v_company for update;
  if not found then
    if btrim(coalesce(p_payload ->> 'beneficiary_name', '') || coalesce(p_payload ->> 'beneficiary_document', '') || coalesce(p_payload ->> 'bank', '')
        || coalesce(p_payload ->> 'branch', '') || coalesce(p_payload ->> 'account', '') || coalesce(p_payload ->> 'pix_key', '')
        || coalesce(p_payload ->> 'notes', '')) = '' then
      return jsonb_build_object('exists', false);
    end if;
    insert into public.supplier_bank_details (supplier_id, company_id, beneficiary_name, beneficiary_document, bank, branch, account, pix_type, pix_key, notes)
      values (p_supplier_id, v_company, btrim(coalesce(p_payload ->> 'beneficiary_name', '')), btrim(coalesce(p_payload ->> 'beneficiary_document', '')),
        btrim(coalesce(p_payload ->> 'bank', '')), btrim(coalesce(p_payload ->> 'branch', '')), btrim(coalesce(p_payload ->> 'account', '')),
        t, btrim(coalesce(p_payload ->> 'pix_key', '')), btrim(coalesce(p_payload ->> 'notes', '')))
      returning * into v_new;
    return jsonb_build_object('exists', true, 'verification_status', v_new.verification_status, 'bank_revision', v_new.bank_revision);
  end if;
  v_changed := o.beneficiary_name is distinct from btrim(coalesce(p_payload ->> 'beneficiary_name', ''))
    or o.beneficiary_document is distinct from btrim(coalesce(p_payload ->> 'beneficiary_document', ''))
    or o.bank is distinct from btrim(coalesce(p_payload ->> 'bank', ''))
    or o.branch is distinct from btrim(coalesce(p_payload ->> 'branch', ''))
    or o.account is distinct from btrim(coalesce(p_payload ->> 'account', ''))
    or o.pix_type is distinct from t
    or o.pix_key is distinct from btrim(coalesce(p_payload ->> 'pix_key', ''));
  update public.supplier_bank_details set
      beneficiary_name = btrim(coalesce(p_payload ->> 'beneficiary_name', '')), beneficiary_document = btrim(coalesce(p_payload ->> 'beneficiary_document', '')),
      bank = btrim(coalesce(p_payload ->> 'bank', '')), branch = btrim(coalesce(p_payload ->> 'branch', '')),
      account = btrim(coalesce(p_payload ->> 'account', '')), pix_type = t, pix_key = btrim(coalesce(p_payload ->> 'pix_key', '')),
      notes = btrim(coalesce(p_payload ->> 'notes', '')),
      verification_status = case when v_changed then 'PENDENTE' else verification_status end,
      verified_by = case when v_changed then null else verified_by end,
      verified_at = case when v_changed then null else verified_at end,
      bank_revision = bank_revision + case when v_changed then 1 else 0 end,
      updated_by = auth.uid(), updated_at = now()
    where supplier_id = p_supplier_id
    returning * into v_new;
  return jsonb_build_object('exists', true, 'verification_status', v_new.verification_status, 'bank_revision', v_new.bank_revision);
end;
$$;

create or replace function public.verify_supplier_bank_details(p_supplier_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.banco.verify');
  b public.supplier_bank_details;
begin
  select * into b from public.supplier_bank_details where supplier_id = p_supplier_id and company_id = v_company for update;
  if not found or (b.account = '' and b.pix_key = '') then raise exception 'Não há dados bancários para conferir'; end if;
  update public.supplier_bank_details set verification_status = 'VERIFICADO', verified_by = auth.uid(), verified_at = now()
    where supplier_id = p_supplier_id returning * into b;
  return jsonb_build_object('verification_status', b.verification_status, 'verified_at', b.verified_at);
end;
$$;

-- 9. Arquivos, fotos e cotações -----------------------------------------------------------------------
create or replace function public.register_supplier_file(p_supplier_id uuid, p_candidate_id uuid, p_kind text, p_path text,
  p_file_name text, p_mime text, p_size bigint, p_caption text, p_photo_kind text, p_primary boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.anexos');
  v_obj record;
  v_mime text;
  v_size bigint;
  v_limit bigint;
  v_row public.supplier_files;
  v_primary boolean := coalesce(p_primary, false);
begin
  if (p_supplier_id is null) = (p_candidate_id is null) then raise exception 'Informe o fornecedor OU a avaliação'; end if;
  if p_supplier_id is not null and not exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.company_id = v_company) then
    raise exception 'Fornecedor não encontrado';
  end if;
  if p_candidate_id is not null and not exists (select 1 from public.supplier_candidates c where c.id = p_candidate_id and c.company_id = v_company) then
    raise exception 'Avaliação não encontrada';
  end if;
  if p_kind not in ('FOTO', 'DOCUMENTO', 'REFERENCIA') then raise exception 'Tipo de arquivo inválido'; end if;
  if p_kind = 'FOTO' and p_supplier_id is null then raise exception 'Fotos pertencem ao fornecedor'; end if;
  if left(coalesce(p_path, ''), length(v_company::text) + 1) <> v_company::text || '/' then raise exception 'Caminho de arquivo de outra empresa'; end if;
  -- valida o objeto REAL do storage (tipo e tamanho vêm dos metadados do storage, não do navegador)
  select o.metadata into v_obj from storage.objects o where o.bucket_id = 'supplier-files' and o.name = p_path;
  if not found then raise exception 'Arquivo não encontrado no armazenamento (envie novamente)'; end if;
  v_mime := coalesce(v_obj.metadata ->> 'mimetype', p_mime);
  v_size := coalesce((v_obj.metadata ->> 'size')::bigint, p_size);
  if v_mime not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then raise exception 'Tipo de arquivo não aceito'; end if;
  if p_kind = 'FOTO' and v_mime = 'application/pdf' then raise exception 'Foto deve ser JPG, PNG ou WebP'; end if;
  v_limit := case when p_kind = 'FOTO' then 8388608 else 10485760 end;
  if v_size is null or v_size <= 0 or v_size > v_limit then
    raise exception 'Tamanho do arquivo fora do limite';
  end if;
  v_primary := v_primary and p_kind = 'FOTO' and p_photo_kind = 'Fachada';
  -- retry do mesmo upload não duplica o vínculo
  select * into v_row from public.supplier_files where storage_path = p_path;
  if found then return jsonb_build_object('id', v_row.id, 'replayed', true); end if;
  if v_primary then update public.supplier_files set is_primary = false where supplier_id = p_supplier_id and is_primary and removed_at is null; end if;
  insert into public.supplier_files (company_id, supplier_id, candidate_id, kind, photo_kind, caption, is_primary, storage_path, file_name, mime_type, size_bytes)
    values (v_company, p_supplier_id, p_candidate_id, p_kind, case when p_kind = 'FOTO' then coalesce(p_photo_kind, 'Outra') end,
      btrim(coalesce(p_caption, '')), v_primary, p_path, left(btrim(coalesce(p_file_name, 'arquivo')), 200), v_mime, v_size)
    returning * into v_row;
  return jsonb_build_object('id', v_row.id, 'replayed', false);
end;
$$;

-- Retirar não apaga o objeto nem o registro (evidência compartilhada): marca como removido.
create or replace function public.remove_supplier_file(p_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.anexos');
begin
  update public.supplier_files set removed_at = now(), removed_by = auth.uid(), is_primary = false
    where id = p_id and company_id = v_company and removed_at is null;
  if not found then raise exception 'Arquivo não encontrado'; end if;
end;
$$;

create or replace function public.add_candidate_quote(p_candidate_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.manage');
  v_id uuid;
begin
  if not exists (select 1 from public.supplier_candidates c where c.id = p_candidate_id and c.company_id = v_company) then
    raise exception 'Avaliação não encontrada';
  end if;
  insert into public.supplier_candidate_quotes (company_id, candidate_id, item, unit, quantity, price_cents, freight_cents, valid_until, source, quoted_on)
    values (v_company, p_candidate_id, btrim(coalesce(p_payload ->> 'item', '')), btrim(coalesce(p_payload ->> 'unit', '')),
      (p_payload ->> 'quantity')::numeric, (p_payload ->> 'price_cents')::bigint, coalesce((p_payload ->> 'freight_cents')::bigint, 0),
      nullif(p_payload ->> 'valid_until', '')::date, btrim(coalesce(p_payload ->> 'source', '')), coalesce(nullif(p_payload ->> 'quoted_on', '')::date, current_date))
    returning id into v_id;
  insert into public.supplier_candidate_contacts (company_id, candidate_id, kind, note)
    values (v_company, p_candidate_id, 'COTACAO', 'Cotação de referência registrada (não é compra, obrigação ou limite)');
  return jsonb_build_object('id', v_id);
end;
$$;

-- 10. Promoção da avaliação (substitui a versão anterior: mesma assinatura, campos completos, chaves novas) ------------
create or replace function public.convert_candidate_to_supplier(p_candidate_id uuid, p_existing_supplier_id uuid, p_supplier jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.manage');
  c public.supplier_candidates;
  v_supplier uuid;
  v_created boolean := false;
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
    v_supplier := private.supplier_create_core(v_company, p_supplier - 'category_ids', null, null);
    v_created := true;
  end if;

  for v_cat in
    select k.category_id from public.supplier_candidate_categories k
      join public.supplier_categories sc on sc.id = k.category_id and sc.active where k.candidate_id = c.id
    union
    select sc.id from jsonb_array_elements_text(coalesce(p_supplier -> 'category_ids', '[]'::jsonb)) as t(val)
      join public.supplier_categories sc on sc.id = t.val::uuid and sc.company_id = v_company and sc.active
  loop
    insert into public.supplier_category_links (company_id, supplier_id, category_id) values (v_company, v_supplier, v_cat) on conflict do nothing;
  end loop;

  -- arquivos da avaliação continuam com a referência de origem e passam a valer também para o fornecedor (sem cópia)
  update public.supplier_files set supplier_id = v_supplier where candidate_id = c.id and supplier_id is null and removed_at is null;

  update public.supplier_candidates
    set stage = 'CADASTRADO', linked_supplier_id = v_supplier, converted_at = now(), converted_by = auth.uid(),
        revision = revision + 1, updated_at = now()
    where id = c.id;
  insert into public.supplier_candidate_contacts (company_id, candidate_id, kind, note)
    values (v_company, c.id, 'CONVERSAO', case when v_created then 'Cadastrado como novo fornecedor' else 'Vinculado a fornecedor existente' end);
  return jsonb_build_object('supplier_id', v_supplier, 'created', v_created, 'replayed', false);
end;
$$;

-- 11. Posição financeira (D10) -----------------------------------------------------------------------------------
-- Fontes físicas: expense_launches (comprado: lançamentos ABERTO = confirmados; RASCUNHO fora das somas, total_amount já é
-- itens + frete - desconto) e expenses (uma linha por parcela: aberto/vencido/pago). Comprado usa a data de emissão do documento
-- (competência quando não há emissão); pago usa paid_at; aberto/vencido são posição atual de todos os períodos.
-- NÃO existem no schema: estorno, baixa parcial separada, juros/multa, devolução, cancelamento de lançamento, adiantamentos/créditos
-- de fornecedor. Esses itens saem como indisponíveis na resposta (flags), nunca como zero.
create or replace function private.supplier_tz(p_company uuid)
returns text language sql stable security definer set search_path to '' as $$
  select coalesce((select default_timezone from public.companies where id = p_company), 'America/Belem')
$$;
revoke all on function private.supplier_tz(uuid) from public, anon, authenticated;

create or replace function public.list_suppliers_financial(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.financeiro');
  v_tz text := private.supplier_tz(v_company);
  v_today date := (now() at time zone private.supplier_tz(v_company))::date;
  v_from date := coalesce(p_from, date '0001-01-01');
  v_to date := coalesce(p_to, date '9999-12-31');
begin
  return jsonb_build_object('as_of', v_today, 'from', p_from, 'to', p_to, 'timezone', v_tz,
    'purchase_date_basis', 'document_issue_date_or_competence',
    'rows', coalesce((
      with l as (
        select x.id, x.supplier_id, x.total_amount, coalesce(x.document_issue_date, x.competence) as day
        from public.expense_launches x where x.company_id = v_company and x.supplier_id is not null and x.status = 'ABERTO'
      ), buy as (
        select supplier_id, sum(total_amount) filter (where day between v_from and v_to) as total,
               count(*) filter (where day between v_from and v_to) as n, max(day) as last_day
        from l group by supplier_id
      ), ex as (
        select l.supplier_id, e.status, e.due_date, e.amount, e.paid_amount, (e.paid_at at time zone v_tz)::date as paid_day
        from public.expenses e join l on l.id = e.launch_id where e.company_id = v_company
      ), fin as (
        select supplier_id,
          sum(coalesce(paid_amount, amount)) filter (where status = 'PAGO' and paid_day between v_from and v_to) as paid,
          sum(greatest(amount - coalesce(paid_amount, 0), 0)) filter (where status <> 'PAGO') as open_total,
          sum(greatest(amount - coalesce(paid_amount, 0), 0)) filter (where status <> 'PAGO' and due_date < v_today) as overdue,
          sum(greatest(amount - coalesce(paid_amount, 0), 0)) filter (where status <> 'PAGO' and due_date = v_today) as due_today,
          count(*) filter (where status <> 'PAGO' and due_date < v_today) as overdue_n
        from ex group by supplier_id
      ), ranked as (
        select supplier_id, dense_rank() over (order by total desc) as rnk from buy where coalesce(total, 0) > 0
      )
      select jsonb_agg(jsonb_build_object(
        'supplier_id', s.id,
        'purchased_cents', round(coalesce(b.total, 0) * 100)::bigint, 'purchase_count', coalesce(b.n, 0), 'last_purchase_on', b.last_day,
        'paid_cents', round(coalesce(f.paid, 0) * 100)::bigint,
        'open_cents', round(coalesce(f.open_total, 0) * 100)::bigint, 'overdue_cents', round(coalesce(f.overdue, 0) * 100)::bigint,
        'due_today_cents', round(coalesce(f.due_today, 0) * 100)::bigint, 'overdue_count', coalesce(f.overdue_n, 0),
        'rank', rk.rnk))
      from public.suppliers s
      left join buy b on b.supplier_id = s.id left join fin f on f.supplier_id = s.id left join ranked rk on rk.supplier_id = s.id
      where s.company_id = v_company), '[]'::jsonb));
end;
$$;

create or replace function public.supplier_financial_summary(p_supplier_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.financeiro');
  v_tz text := private.supplier_tz(v_company);
  v_today date := (now() at time zone private.supplier_tz(v_company))::date;
  v_from date := coalesce(p_from, date '0001-01-01');
  v_to date := coalesce(p_to, date '9999-12-31');
  v_result jsonb;
begin
  if not exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.company_id = v_company) then
    raise exception 'Fornecedor não encontrado';
  end if;
  with l as (
    select x.id, x.kind, x.status, x.document_ref, x.total_amount, x.document_issue_date, x.competence, coalesce(x.document_issue_date, x.competence) as day, x.payment_condition
    from public.expense_launches x where x.company_id = v_company and x.supplier_id = p_supplier_id
  ), lc as (select * from l where status = 'ABERTO'),
  ex as (
    select e.id, e.launch_id, e.installment_number, e.installment_count, e.status, e.due_date, e.amount, e.paid_amount,
           e.scheduled_payment_at, e.payment_method, lc.document_ref, lc.day as issue_day, (e.paid_at at time zone v_tz)::date as paid_day
    from public.expenses e join lc on lc.id = e.launch_id where e.company_id = v_company
  ), buy_period as (select * from lc where day between v_from and v_to),
  all_totals as (
    select x.supplier_id, sum(x.total_amount) filter (where coalesce(x.document_issue_date, x.competence) between v_from and v_to) as t
    from public.expense_launches x where x.company_id = v_company and x.supplier_id is not null and x.status = 'ABERTO' group by x.supplier_id
  ), rank_all as (select supplier_id, t, dense_rank() over (order by t desc) as rnk from all_totals where coalesce(t, 0) > 0),
  paid_ev as (select * from ex where status = 'PAGO' and paid_day is not null),
  settled as (select * from paid_ev where paid_day between v_from and v_to),
  months as (select to_char(m, 'YYYY-MM') as ym from generate_series(date_trunc('month', case when p_from is null then (select coalesce(min(day), v_today) from lc) else v_from end)::date,
              date_trunc('month', case when p_to is null then v_today else v_to end)::date, interval '1 month') m),
  items as (
    select coalesce(i.raw_material_id::text, i.catalog_item_id::text, lower(i.name_snapshot)) || '|' || i.unit as k, i.name_snapshot, i.unit,
           i.quantity, i.amount, i.unit_price, lc.day
    from public.expense_launch_items i join buy_period lc on lc.id = i.launch_id
  ), item_rank as (
    select k, max(name_snapshot) as name, unit, sum(quantity) as qty, sum(amount) as value,
           (array_agg(unit_price order by day desc))[1] as last_price, max(day) as last_day,
           (select jsonb_agg(jsonb_build_object('day', h.day, 'unit_price', h.unit_price) order by h.day desc) from (
              select day, unit_price from items i2 where i2.k = items.k order by day desc limit 12) h) as history
    from items group by k, unit
  )
  select jsonb_build_object(
    'as_of', v_today, 'from', p_from, 'to', p_to, 'timezone', v_tz,
    'purchase_date_basis', 'document_issue_date_or_competence',
    'purchased', jsonb_build_object(
      'total_cents', round(coalesce((select sum(total_amount) from buy_period), 0) * 100)::bigint,
      'count', (select count(*) from buy_period),
      'avg_cents', (select case when count(*) > 0 then round(sum(total_amount) / count(*) * 100)::bigint end from buy_period),
      'all_time_cents', round(coalesce((select sum(total_amount) from lc), 0) * 100)::bigint,
      'rank', (select rnk from rank_all where supplier_id = p_supplier_id),
      'ranked_suppliers', (select count(*) from rank_all),
      'last_purchase_on', (select max(day) from lc)),
    'paid', jsonb_build_object(
      'period_cents', round(coalesce((select sum(coalesce(paid_amount, amount)) from settled), 0) * 100)::bigint,
      'all_time_cents', round(coalesce((select sum(coalesce(paid_amount, amount)) from paid_ev), 0) * 100)::bigint,
      'last_payment_on', (select max(paid_day) from paid_ev),
      'last_payment_cents', (select round(coalesce(paid_amount, amount) * 100)::bigint from paid_ev order by paid_day desc limit 1)),
    'open', jsonb_build_object(
      'total_cents', round(coalesce((select sum(greatest(amount - coalesce(paid_amount, 0), 0)) from ex where status <> 'PAGO'), 0) * 100)::bigint,
      'overdue_cents', round(coalesce((select sum(greatest(amount - coalesce(paid_amount, 0), 0)) from ex where status <> 'PAGO' and due_date < v_today), 0) * 100)::bigint,
      'due_today_cents', round(coalesce((select sum(greatest(amount - coalesce(paid_amount, 0), 0)) from ex where status <> 'PAGO' and due_date = v_today), 0) * 100)::bigint,
      'count', (select count(*) from ex where status <> 'PAGO'),
      'titles', coalesce((select jsonb_agg(jsonb_build_object('expense_id', id, 'launch_id', launch_id, 'document_ref', document_ref,
          'installment_number', installment_number, 'installment_count', installment_count, 'due_date', due_date,
          'balance_cents', round(greatest(amount - coalesce(paid_amount, 0), 0) * 100)::bigint, 'status', status,
          'scheduled_payment_on', scheduled_payment_at, 'payment_method', payment_method,
          'overdue_days', case when due_date < v_today then v_today - due_date end) order by due_date, installment_number)
        from (select * from ex where status <> 'PAGO' order by due_date, installment_number limit 100) t), '[]'::jsonb)),
    'punctuality', jsonb_build_object(
      'settled', (select count(*) from settled where due_date is not null),
      'on_time', (select count(*) from settled where due_date is not null and paid_day <= due_date),
      'late', (select count(*) from settled where due_date is not null and paid_day > due_date),
      'pct', (select case when count(*) > 0 then round(100.0 * count(*) filter (where paid_day <= due_date) / count(*))::int end from settled where due_date is not null)),
    'terms', jsonb_build_object(
      'contracted_avg_days', (select case when sum(amount) > 0 then round(sum(amount * (due_date - issue_day)) / sum(amount))::int end
          from ex where issue_day between v_from and v_to and due_date is not null),
      'effective_avg_days', (select case when sum(coalesce(paid_amount, amount)) > 0 then round(sum(coalesce(paid_amount, amount) * (paid_day - issue_day)) / sum(coalesce(paid_amount, amount)))::int end from settled)),
    'by_kind', coalesce((select jsonb_object_agg(k.kind, k.cents) from (select kind, round(sum(total_amount) * 100)::bigint as cents from buy_period group by kind) k), '{}'::jsonb),
    'monthly', coalesce((select jsonb_agg(jsonb_build_object('month', m.ym,
        'purchased_cents', round(coalesce((select sum(total_amount) from lc where to_char(day, 'YYYY-MM') = m.ym), 0) * 100)::bigint,
        'paid_cents', round(coalesce((select sum(coalesce(paid_amount, amount)) from paid_ev where to_char(paid_day, 'YYYY-MM') = m.ym), 0) * 100)::bigint) order by m.ym)
      from months m), '[]'::jsonb),
    'purchases', coalesce((select jsonb_agg(jsonb_build_object('launch_id', id, 'day', day, 'document_ref', document_ref, 'state', status,
        'total_cents', round(total_amount * 100)::bigint, 'counted', status = 'ABERTO') order by day desc, id)
      from (select * from l where day between v_from and v_to order by day desc, id limit 100) t), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'unit', unit, 'quantity', qty, 'value_cents', round(value * 100)::bigint,
        'last_unit_price_cents', round(last_price * 100)::bigint, 'last_day', last_day, 'history', history) order by value desc, name)
      from (select * from item_rank order by value desc, name limit 200) t), '[]'::jsonb),
    'unavailable', jsonb_build_array('credits_advances', 'reversals', 'interest_fees_discounts', 'returns', 'cancelled_launches', 'supplier_item_codes_sku')
  ) into v_result;
  return v_result;
end;
$$;

-- 12. Exportação: só o conjunto de ids enviado, só da empresa da sessão, só com a permissão própria ----------------------
create or replace function public.list_suppliers_export(p_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.exportar');
begin
  return jsonb_build_object('exported_at', now(), 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'trade_name', s.trade_name, 'company_name', s.company_name, 'document', s.cnpj,
        'person_type', s.person_type, 'active', s.active, 'city', s.city, 'state', s.state, 'contact', s.name, 'phone', s.phone,
        'email', s.email, 'buyer', s.buyer_name, 'supply_type', s.supply_type,
        'categories', coalesce((select string_agg(c.name, ' | ' order by c.name) from public.supplier_category_links l
                                join public.supplier_categories c on c.id = l.category_id where l.supplier_id = s.id), ''))
      order by s.trade_name)
    from public.suppliers s where s.company_id = v_company and s.id = any (coalesce(p_ids, '{}'::uuid[]))), '[]'::jsonb));
end;
$$;

-- 12b. Rascunho persistente do formulário (um por pessoa e por alvo; nunca guarda banco/Pix) -------------------------------
create table public.supplier_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id uuid not null default auth.uid(),
  supplier_id uuid,
  candidate_id uuid,
  payload jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  foreign key (company_id, supplier_id) references public.suppliers (company_id, id) on delete cascade,
  foreign key (company_id, candidate_id) references public.supplier_candidates (company_id, id) on delete cascade,
  check (supplier_id is null or candidate_id is null)
);
create unique index supplier_drafts_new_idx on public.supplier_drafts (company_id, user_id) where supplier_id is null and candidate_id is null;
create unique index supplier_drafts_supplier_idx on public.supplier_drafts (company_id, user_id, supplier_id) where supplier_id is not null;
create unique index supplier_drafts_candidate_idx on public.supplier_drafts (company_id, user_id, candidate_id) where candidate_id is not null;
alter table public.supplier_drafts enable row level security;
create policy supplier_drafts_select on public.supplier_drafts for select to authenticated
  using (user_id = (select auth.uid()) and (select private.has_permission(company_id, 'fornecedores.manage')));
revoke all on public.supplier_drafts from anon, authenticated;
grant select on public.supplier_drafts to authenticated;

-- Versão esperada: duas abas não se sobrescrevem em silêncio (CONFLITO_REVISAO). Chaves de banco/Pix são descartadas no servidor.
create or replace function public.save_supplier_draft(p_supplier_id uuid, p_candidate_id uuid, p_expected_version integer, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.manage');
  v_clean jsonb;
  d public.supplier_drafts;
begin
  if jsonb_typeof(p_payload) <> 'object' or length(p_payload::text) > 100000 then raise exception 'Rascunho inválido ou grande demais'; end if;
  if p_supplier_id is not null and p_candidate_id is not null then raise exception 'Informe o fornecedor OU a avaliação'; end if;
  if p_supplier_id is not null and not exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.company_id = v_company) then
    raise exception 'Fornecedor não encontrado';
  end if;
  if p_candidate_id is not null and not exists (select 1 from public.supplier_candidates c where c.id = p_candidate_id and c.company_id = v_company) then
    raise exception 'Avaliação não encontrada';
  end if;
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_clean
    from jsonb_each(p_payload) e where e.key !~* '(bank|pix|benef|account|branch)';
  select * into d from public.supplier_drafts
    where company_id = v_company and user_id = auth.uid()
      and supplier_id is not distinct from p_supplier_id and candidate_id is not distinct from p_candidate_id for update;
  if not found then
    insert into public.supplier_drafts (company_id, supplier_id, candidate_id, payload) values (v_company, p_supplier_id, p_candidate_id, v_clean)
      returning * into d;
    return jsonb_build_object('version', d.version);
  end if;
  if d.version <> coalesce(p_expected_version, 0) then
    raise exception 'CONFLITO_REVISAO: o rascunho foi alterado em outra aba (versão atual %)', d.version;
  end if;
  update public.supplier_drafts set payload = v_clean, version = version + 1, updated_at = now() where id = d.id returning * into d;
  return jsonb_build_object('version', d.version);
end;
$$;

create or replace function public.get_supplier_draft(p_supplier_id uuid, p_candidate_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.manage');
  d public.supplier_drafts;
begin
  select * into d from public.supplier_drafts
    where company_id = v_company and user_id = auth.uid()
      and supplier_id is not distinct from p_supplier_id and candidate_id is not distinct from p_candidate_id;
  if not found then return null; end if;
  return jsonb_build_object('payload', d.payload, 'version', d.version, 'updated_at', d.updated_at);
end;
$$;

create or replace function public.discard_supplier_draft(p_supplier_id uuid, p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company uuid := private.supplier_company_for('fornecedores.manage');
begin
  delete from public.supplier_drafts
    where company_id = v_company and user_id = auth.uid()
      and supplier_id is not distinct from p_supplier_id and candidate_id is not distinct from p_candidate_id;
end;
$$;

-- 13. GRANT EXECUTE: só authenticated; anon e public fora ------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_supplier(uuid, jsonb)', 'public.update_supplier(uuid, integer, jsonb)', 'public.set_supplier_active(uuid, boolean, integer)',
    'public.find_supplier_by_document(text, uuid)', 'public.get_supplier_bank_details(uuid, boolean)',
    'public.set_supplier_bank_details(uuid, jsonb)', 'public.verify_supplier_bank_details(uuid)',
    'public.register_supplier_file(uuid, uuid, text, text, text, text, bigint, text, text, boolean)', 'public.remove_supplier_file(uuid)',
    'public.add_candidate_quote(uuid, jsonb)', 'public.list_suppliers_financial(date, date)',
    'public.supplier_financial_summary(uuid, date, date)', 'public.list_suppliers_export(uuid[])', 'public.save_supplier_draft(uuid, uuid, integer, jsonb)', 'public.get_supplier_draft(uuid, uuid)', 'public.discard_supplier_draft(uuid, uuid)',
    'public.create_supplier_category(text)', 'public.rename_supplier_category(uuid, text)', 'public.set_supplier_category_active(uuid, boolean)',
    'public.ensure_default_supplier_categories()', 'public.convert_candidate_to_supplier(uuid, uuid, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke all on function private.supplier_clean(jsonb), private.supplier_mask(text), private.supplier_changed_fields(jsonb, jsonb, text[]) from public, anon, authenticated;
revoke all on function private.supplier_validate(jsonb, public.suppliers, boolean) from public, anon, authenticated;
-- Pendente de verificação em homologação: has_permission/default_company_id precisam de EXECUTE para authenticated
-- (políticas RLS acima), como no padrão das migrations anteriores; storage.objects e o bucket 'supplier-files' em ambiente real.
