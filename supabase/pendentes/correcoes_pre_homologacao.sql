-- CORREÇÕES ANTES DA HOMOLOGAÇÃO. NÃO APLICADA EM PRODUÇÃO: aguarda aprovação específica.
-- (1) Competência ambígua: se o colaborador teve mais de um período de contratação no mês, a obrigação NÃO é formada
--     automaticamente (nem pelo comando de geração, nem por inserção direta, que cobre o caminho de create_expense_launch).
--     Cada período mantém a sua atribuição; a composição proporcional fica para decisão do cliente.
-- (2) Eventos sem perda: duas alterações legítimas do mesmo campo na mesma transação geravam a MESMA chave de idempotência
--     e a segunda era descartada em silêncio. Cada alteração agora recebe um número único (sequência), então nenhuma se perde.
--     Eventos de fato único (criado, vale pago, estornado, revisão, Espelho) seguem com chave determinística pelo id.
-- Reversão: aplicar de novo o texto original das mesmas funções (migrações 20261014173037 e 20261014150319/2026101416...);
-- o teste gera e confere por hash em testes_compatibilidade_e_correcoes.mjs.

-- (3) Gravação de batida pela função de borda: service_role NÃO tem USAGE no schema private. Dois gatilhos de time_punches são
--     funções comuns que consultam private.* (sync_occurrence_after_punch, que já existia, e time_punch_eligibility). Resultado em
--     produção hoje: TODA gravação de batida pela função de borda falha com "permission denied for schema private". service_role é o
--     papel interno das funções de borda (não é exposto a clientes); conceder USAGE é a correção mínima e reversível.
grant usage on schema private to service_role;

create sequence if not exists private.outbox_event_nonce;

create or replace function private.salary_obligation_set_employment()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.employee_employments x
   where x.employee_id = new.employee_id
     and x.start_date <= (new.competence + interval '1 month - 1 day')::date
     and (x.end_date is null or x.end_date >= new.competence);
  if v_count > 1 then
    raise exception 'COMPETENCIA_AMBIGUA: o colaborador teve mais de um período de contratação nesta competência; a composição proporcional ainda não existe, então a obrigação não é formada automaticamente';
  end if;
  if new.employment_id is null then
    select x.id into new.employment_id from public.employee_employments x
    where x.employee_id = new.employee_id
      and x.start_date <= (new.competence + interval '1 month - 1 day')::date
      and (x.end_date is null or x.end_date >= new.competence)
    order by x.start_date desc limit 1;
  end if;
  return new;
end;
$$;

create or replace function public.generate_salary_obligation(
  p_employee_id uuid,
  p_competence date,
  p_due_date date,
  p_due_date_source text default 'competence_closing'
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_emp public.employees;
  v_comp date;
  v_comp_end date;
  v_employment uuid;
  v_base numeric;
  v_existing public.salary_obligations;
  v_id uuid;
begin
  select * into v_emp from public.employees where id = p_employee_id;
  if not found then
    raise exception 'Colaborador não encontrado';
  end if;
  if not private.has_permission(v_emp.company_id, 'despesas.manage') then
    raise exception 'Sem permissão para gerar obrigação salarial';
  end if;
  if p_due_date is null then
    raise exception 'VENCIMENTO_OBRIGATORIO: informe a data de vencimento da folha desta competência';
  end if;
  if p_due_date_source not in ('payroll_calendar', 'competence_closing') then
    raise exception 'Origem de vencimento inválida: %', p_due_date_source;
  end if;

  v_comp := date_trunc('month', p_competence)::date;
  v_comp_end := (v_comp + interval '1 month - 1 day')::date;

  select x.id into v_employment from public.employee_employments x
    where x.employee_id = p_employee_id and x.start_date <= v_comp_end and (x.end_date is null or x.end_date >= v_comp)
    order by x.start_date desc limit 1;
  if v_employment is null then
    raise exception 'O colaborador não tinha vínculo vigente nesta competência';
  end if;
  if (select count(*) from public.employee_employments x where x.employee_id = p_employee_id and x.start_date <= v_comp_end and (x.end_date is null or x.end_date >= v_comp)) > 1 then
    raise exception 'COMPETENCIA_AMBIGUA: o colaborador teve mais de um período de contratação nesta competência; a composição proporcional ainda não existe, então a obrigação não é formada automaticamente';
  end if;

  v_base := public.resolve_salary_base(p_employee_id, v_comp);
  if v_base is null or v_base <= 0 then
    raise exception 'Colaborador sem salário vigente para esta competência';
  end if;

  select * into v_existing from public.salary_obligations
    where employee_id = p_employee_id and competence = v_comp for update;

  if found then
    if v_existing.base_salary = 0 and v_existing.net_amount = 0 then
      update public.salary_obligations
         set base_salary = v_base, net_amount = v_base
       where id = v_existing.id;
      perform private.record_audit_event('salary_obligation.updated', v_emp.company_id, 'salary_obligation', v_existing.id::text,
        jsonb_build_object('reason', 'reconcilia_obligacao_criada_por_vale', 'employee_id', p_employee_id,
          'employment_id', v_existing.employment_id, 'competence', v_comp, 'salary_base', v_base, 'due_date', v_existing.due_date));
    end if;
    return v_existing.id;
  end if;

  insert into public.salary_obligations (company_id, employee_id, employment_id, competence, base_salary, net_amount, status, due_date, due_date_source)
  values (v_emp.company_id, p_employee_id, v_employment, v_comp, v_base, v_base, 'ABERTO', p_due_date, p_due_date_source)
  on conflict (employee_id, competence) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.salary_obligations where employee_id = p_employee_id and competence = v_comp;
    return v_id;
  end if;

  perform private.record_audit_event('salary_obligation.created', v_emp.company_id, 'salary_obligation', v_id::text,
    jsonb_build_object('employee_id', p_employee_id, 'employment_id', v_employment, 'competence', v_comp,
      'salary_base', v_base, 'due_date', p_due_date, 'due_date_source', p_due_date_source,
      'idempotency_key', 'salary:' || v_emp.company_id || ':' || v_employment || ':' || v_comp));
  return v_id;
end;
$$;

create or replace function private.salary_obligation_emit_event()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.emit_event('salary_obligation.created', new.company_id, 'salary_obligation', new.id::text,
      jsonb_build_object('employee_id', new.employee_id, 'employment_id', new.employment_id, 'competence', new.competence,
        'due_date', new.due_date, 'due_date_source', new.due_date_source),
      new.employee_id, null, 'salary_obligation.created:' || new.id);
  else
    if new.due_date is distinct from old.due_date then
      perform private.emit_event('salary_obligation.due_date_changed', new.company_id, 'salary_obligation', new.id::text,
        jsonb_build_object('employee_id', new.employee_id, 'employment_id', new.employment_id, 'competence', new.competence,
          'due_date', new.due_date, 'previous_due_date', old.due_date, 'due_date_source', new.due_date_source),
        new.employee_id, null,
        'salary_obligation.due_date_changed:' || new.id || ':' || nextval('private.outbox_event_nonce'));
    end if;
    if new.base_salary is distinct from old.base_salary or new.net_amount is distinct from old.net_amount then
      perform private.emit_event('salary_obligation.updated', new.company_id, 'salary_obligation', new.id::text,
        jsonb_build_object('employee_id', new.employee_id, 'employment_id', new.employment_id, 'competence', new.competence),
        new.employee_id, null, 'salary_obligation.updated:' || new.id || ':' || nextval('private.outbox_event_nonce'));
    end if;
  end if;
  return null;
end;
$$;
