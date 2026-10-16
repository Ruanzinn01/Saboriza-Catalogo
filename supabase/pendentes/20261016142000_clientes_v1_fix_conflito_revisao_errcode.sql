-- Correcao de 20261016140000_clientes_v1_mestre.sql (que NAO foi editada): CONFLITO_REVISAO usava errcode 40001 (serialization_failure).
-- O PostgREST repete a transacao em 40001 e a chamada fica pendurada ate 504 em vez de devolver o conflito
-- (evidencia: homologacao 2026-10-16, caso C20; funcao de teste com PT409 respondeu 409 em ~0,5 s, com 40001 nao respondeu em 25 s).
-- Aqui vira PT409 (PostgREST responde HTTP 409 com a mesma mensagem). Nenhuma outra mudanca de comportamento.
-- Teste: scripts/homologacao/http/clientes_fornecedores.mjs (C20 e C24b). Reversao: reaplicar as duas funcoes de 20261016140000 (errcode 40001).

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
      raise exception 'CONFLITO_REVISAO: o cadastro foi alterado por outra pessoa; recarregue' using errcode = 'PT409';
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
    raise exception 'CONFLITO_REVISAO: o cadastro foi alterado por outra pessoa; recarregue' using errcode = 'PT409';
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
