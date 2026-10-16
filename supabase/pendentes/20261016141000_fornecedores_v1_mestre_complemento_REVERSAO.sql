-- REVERSÃO de 20261016141000_fornecedores_v1_mestre_complemento.sql. NÃO APLICADA EM NENHUM BANCO.
-- ATENÇÃO, DESTRUTIVA: apaga as tabelas novas (contatos extras, banco/Pix, arquivos, cotações, eventos) e as COLUNAS novas de
-- public.suppliers (os dados digitados nelas se perdem). Os registros de fornecedores, compras, categorias e avaliações permanecem.
-- Os objetos já enviados ao bucket supplier-files NÃO são apagados (o bucket só é removido se estiver vazio).
-- Restaura: policies originais de suppliers (membro ativo lê/grava/exclui) e as RPCs da migration 20261016100000 nas versões originais.
-- Depois desta, a reversão de 20261016100000 pode ser aplicada se for o caso.

drop policy if exists supplier_files_storage_select on storage.objects;
drop policy if exists supplier_files_storage_insert on storage.objects;
delete from storage.buckets b where b.id = 'supplier-files' and not exists (select 1 from storage.objects o where o.bucket_id = b.id);

drop function if exists public.create_supplier(uuid, jsonb);
drop function if exists public.update_supplier(uuid, integer, jsonb);
drop function if exists public.set_supplier_active(uuid, boolean, integer);
drop function if exists public.find_supplier_by_document(text, uuid);
drop function if exists public.get_supplier_bank_details(uuid, boolean);
drop function if exists public.set_supplier_bank_details(uuid, jsonb);
drop function if exists public.verify_supplier_bank_details(uuid);
drop function if exists public.register_supplier_file(uuid, uuid, text, text, text, text, bigint, text, text, boolean);
drop function if exists public.remove_supplier_file(uuid);
drop function if exists public.add_candidate_quote(uuid, jsonb);
drop function if exists public.list_suppliers_financial(date, date);
drop function if exists public.supplier_financial_summary(uuid, date, date);
drop function if exists public.list_suppliers_export(uuid[]);
drop function if exists public.save_supplier_draft(uuid, uuid, integer, jsonb);
drop function if exists public.get_supplier_draft(uuid, uuid);
drop function if exists public.discard_supplier_draft(uuid, uuid);

drop trigger if exists supplier_events_suppliers on public.suppliers;
drop trigger if exists supplier_events_categories on public.supplier_categories;
drop trigger if exists supplier_events_links on public.supplier_category_links;
drop trigger if exists supplier_events_candidates on public.supplier_candidates;
drop trigger if exists supplier_events_candidate_contacts on public.supplier_candidate_contacts;
drop table if exists public.supplier_drafts, public.supplier_events, public.supplier_candidate_quotes, public.supplier_files, public.supplier_bank_details, public.supplier_contacts;
drop function if exists private.supplier_trg_suppliers(), private.supplier_trg_categories(), private.supplier_trg_links(), private.supplier_trg_candidates(),
  private.supplier_trg_candidate_contacts(), private.supplier_trg_bank(), private.supplier_trg_files();
drop function if exists private.supplier_emit(uuid, text, text, uuid, integer, jsonb), private.supplier_changed_fields(jsonb, jsonb, text[]),
  private.supplier_create_core(uuid, jsonb, uuid, text), private.supplier_sync_children(uuid, uuid, jsonb), private.supplier_validate(jsonb, public.suppliers, boolean),
  private.supplier_clean(jsonb), private.supplier_mask(text), private.supplier_tz(uuid);

-- a cotação sai do histórico antes de restaurar a constraint original
delete from public.supplier_candidate_contacts where kind = 'COTACAO';
alter table public.supplier_candidate_contacts drop constraint if exists supplier_candidate_contacts_kind_check;
alter table public.supplier_candidate_contacts add constraint supplier_candidate_contacts_kind_check check (kind in ('CONTATO', 'CONVERSAO'));

-- policies originais das tabelas da etapa anterior
drop policy if exists supplier_categories_select on public.supplier_categories;
drop policy if exists supplier_category_links_select on public.supplier_category_links;
drop policy if exists supplier_candidates_select on public.supplier_candidates;
drop policy if exists supplier_candidate_products_select on public.supplier_candidate_products;
drop policy if exists supplier_candidate_categories_select on public.supplier_candidate_categories;
drop policy if exists supplier_candidate_contacts_select on public.supplier_candidate_contacts;
create policy supplier_categories_select on public.supplier_categories for select using ((select private.has_permission(company_id, 'despesas.read')));
create policy supplier_category_links_select on public.supplier_category_links for select using ((select private.has_permission(company_id, 'despesas.read')));
create policy supplier_candidates_select on public.supplier_candidates for select using ((select private.has_permission(company_id, 'despesas.read')));
create policy supplier_candidate_products_select on public.supplier_candidate_products for select using ((select private.has_permission(company_id, 'despesas.read')));
create policy supplier_candidate_categories_select on public.supplier_candidate_categories for select using ((select private.has_permission(company_id, 'despesas.read')));
create policy supplier_candidate_contacts_select on public.supplier_candidate_contacts for select using ((select private.has_permission(company_id, 'despesas.read')));

-- funções da etapa anterior nas versões originais
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

revoke all on function public.create_supplier_category(text), public.rename_supplier_category(uuid, text), public.set_supplier_category_active(uuid, boolean),
  public.ensure_default_supplier_categories(), public.convert_candidate_to_supplier(uuid, uuid, jsonb) from public, anon;
grant execute on function public.create_supplier_category(text), public.rename_supplier_category(uuid, text), public.set_supplier_category_active(uuid, boolean),
  public.ensure_default_supplier_categories(), public.convert_candidate_to_supplier(uuid, uuid, jsonb) to authenticated;
revoke all on function private.supplier_company_for(text) from public, anon, authenticated;

-- suppliers: volta ao comportamento original (membro ativo lê/grava/exclui). MUDANÇA DE SEGURANÇA: só se a reversão for mesmo desejada.
drop policy if exists suppliers_select_by_permission on public.suppliers;
drop policy if exists suppliers_admin_select_all on public.suppliers;
drop policy if exists suppliers_admin_insert on public.suppliers;
drop policy if exists suppliers_admin_update on public.suppliers;
drop policy if exists suppliers_admin_delete on public.suppliers;
create policy suppliers_admin_select_all on public.suppliers for select to authenticated using ((select private.is_active_company_member(company_id)));
create policy suppliers_admin_insert on public.suppliers for insert to authenticated with check ((select private.is_active_company_member(company_id)));
create policy suppliers_admin_update on public.suppliers for update to authenticated using ((select private.is_active_company_member(company_id))) with check ((select private.is_active_company_member(company_id)));
create policy suppliers_admin_delete on public.suppliers for delete to authenticated using ((select private.is_active_company_member(company_id)));
grant select, insert, update, delete on public.suppliers to authenticated;

drop index if exists public.suppliers_company_document_key;
drop index if exists public.suppliers_company_active_idx;
alter table public.suppliers
  drop constraint if exists suppliers_company_command_unique, drop constraint if exists suppliers_lat_lon_pair,
  drop constraint if exists suppliers_lat_range, drop constraint if exists suppliers_lon_range,
  drop column if exists document_key, drop column if exists person_type, drop column if exists active, drop column if exists tax_profile,
  drop column if exists state_exempt, drop column if exists contact_role, drop column if exists contact_whatsapp, drop column if exists street_number,
  drop column if exists complement, drop column if exists reference_note, drop column if exists ibge_code, drop column if exists latitude,
  drop column if exists longitude, drop column if exists location_source, drop column if exists location_accuracy_m, drop column if exists location_confirmed_at,
  drop column if exists location_confirmed_by, drop column if exists buyer_name, drop column if exists cost_center, drop column if exists supply_type,
  drop column if exists origin, drop column if exists service_notes, drop column if exists sales_email, drop column if exists invoice_email,
  drop column if exists website, drop column if exists external_customer_code, drop column if exists lead_time_days, drop column if exists minimum_order_cents,
  drop column if exists freight_terms, drop column if exists receiving_notes, drop column if exists credit_limit_cents, drop column if exists payment_terms,
  drop column if exists payment_method, drop column if exists negotiation_notes, drop column if exists revision, drop column if exists command_id,
  drop column if exists command_hash;
-- Os NOT NULL de name/phone não são reativados aqui: seria impossível se já existirem contatos/telefones vazios. Os defaults '' são removidos.
alter table public.suppliers alter column name drop default, alter column phone drop default, alter column company_name drop default;

delete from public.role_permissions where permission_key like 'fornecedores.%';
delete from public.permissions where key like 'fornecedores.%';
