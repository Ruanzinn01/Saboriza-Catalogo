-- Central de Colaboradores V4.1 — integração salarial: vencimento explícito, geração idempotente e vales sem duplicidade.
-- Não existe calendário/regra de folha no banco: o vencimento é exigido no fechamento de cada competência (PRD §5.3 item 2).

alter table public.salary_obligations
  add column if not exists due_date_source text;

update public.salary_obligations
   set due_date_source = 'legacy_convention'
 where due_date_source is null and due_date is not null;

alter table public.salary_obligations
  drop constraint if exists salary_obligations_due_date_source_check;
alter table public.salary_obligations
  add constraint salary_obligations_due_date_source_check
  check (due_date_source in ('payroll_calendar', 'competence_closing', 'legacy_convention', 'manual_adjustment'));

alter table public.salary_obligations alter column due_date set not null;

-- Um estorno por vale: retry/duplo clique não cria segunda reversão.
create unique index if not exists salary_advances_one_reversal_idx
  on public.salary_advances (reversed_advance_id) where reversed_advance_id is not null;

-- Vencimento nunca é presumido: obrigação sem data é rejeitada; origem da data é sempre registrada.
create or replace function private.salary_obligation_due_date_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.due_date is null then
      raise exception 'VENCIMENTO_OBRIGATORIO: informe a data de vencimento da folha desta competência';
    end if;
    if new.due_date_source is null then
      new.due_date_source := 'competence_closing';
    end if;
  elsif new.due_date is distinct from old.due_date
        and coalesce(current_setting('app.salary_due_change', true), '') <> 'on' then
    raise exception 'ALTERACAO_VENCIMENTO_BLOQUEADA: use change_salary_due_date (exige motivo e gera auditoria)';
  end if;
  return new;
end;
$$;

drop trigger if exists salary_obligations_due_date_guard on public.salary_obligations;
create trigger salary_obligations_due_date_guard
  before insert or update of due_date on public.salary_obligations
  for each row execute function private.salary_obligation_due_date_guard();

-- Geração idempotente: uma obrigação por colaborador/vínculo e competência. Retry devolve a mesma.
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

  if coalesce(v_emp.employment_start_date, v_emp.admission_date) > v_comp_end then
    raise exception 'O vínculo do colaborador começa depois desta competência';
  end if;
  if coalesce(v_emp.employment_end_date, v_emp.termination_date) < v_comp then
    raise exception 'O vínculo do colaborador terminou antes desta competência';
  end if;

  v_base := public.resolve_salary_base(p_employee_id, v_comp);
  if v_base is null or v_base <= 0 then
    raise exception 'Colaborador sem salário vigente para esta competência';
  end if;

  select * into v_existing from public.salary_obligations
    where employee_id = p_employee_id and competence = v_comp for update;

  if found then
    -- Vale antes da obrigação: o registro nasceu zerado só para ancorar o vale; completa em vez de duplicar.
    if v_existing.base_salary = 0 and v_existing.net_amount = 0 then
      update public.salary_obligations
         set base_salary = v_base, net_amount = v_base
       where id = v_existing.id;
      perform private.record_audit_event('salary_obligation.updated', v_emp.company_id, 'salary_obligation', v_existing.id::text,
        jsonb_build_object('reason', 'reconcilia_obligacao_criada_por_vale', 'employee_id', p_employee_id,
          'vinculo_id', p_employee_id, 'competence', v_comp, 'salary_base', v_base, 'due_date', v_existing.due_date));
    end if;
    return v_existing.id;
  end if;

  insert into public.salary_obligations (company_id, employee_id, competence, base_salary, net_amount, status, due_date, due_date_source)
  values (v_emp.company_id, p_employee_id, v_comp, v_base, v_base, 'ABERTO', p_due_date, p_due_date_source)
  on conflict (employee_id, competence) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.salary_obligations where employee_id = p_employee_id and competence = v_comp;
    return v_id;
  end if;

  perform private.record_audit_event('salary_obligation.created', v_emp.company_id, 'salary_obligation', v_id::text,
    jsonb_build_object('employee_id', p_employee_id, 'vinculo_id', p_employee_id, 'competence', v_comp,
      'salary_base', v_base, 'due_date', p_due_date, 'due_date_source', p_due_date_source,
      'idempotency_key', 'salary:' || v_emp.company_id || ':' || p_employee_id || ':' || v_comp));
  return v_id;
end;
$$;

-- Alteração posterior de vencimento: permissão, motivo e auditoria com antes/depois.
create or replace function public.change_salary_due_date(p_obligation_id uuid, p_new_due_date date, p_reason text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_o public.salary_obligations;
begin
  select * into v_o from public.salary_obligations where id = p_obligation_id for update;
  if not found then
    raise exception 'Obrigação salarial não encontrada';
  end if;
  if not private.has_permission(v_o.company_id, 'despesas.manage') then
    raise exception 'Sem permissão para alterar o vencimento';
  end if;
  if p_new_due_date is null then
    raise exception 'VENCIMENTO_OBRIGATORIO: informe a nova data de vencimento';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe o motivo da alteração do vencimento';
  end if;
  if v_o.status = 'PAGO' then
    raise exception 'Obrigação já paga: o vencimento não pode ser alterado';
  end if;
  if p_new_due_date = v_o.due_date then
    return;
  end if;

  perform set_config('app.salary_due_change', 'on', true);
  update public.salary_obligations set due_date = p_new_due_date, due_date_source = 'manual_adjustment' where id = p_obligation_id;
  perform set_config('app.salary_due_change', 'off', true);

  perform private.record_audit_event('salary_obligation.due_date_changed', v_o.company_id, 'salary_obligation', p_obligation_id::text,
    jsonb_build_object('employee_id', v_o.employee_id, 'vinculo_id', v_o.employee_id, 'competence', v_o.competence,
      'before', jsonb_build_object('due_date', v_o.due_date, 'due_date_source', v_o.due_date_source),
      'after', jsonb_build_object('due_date', p_new_due_date, 'due_date_source', 'manual_adjustment'),
      'reason', trim(p_reason)));
end;
$$;

-- Pagamento do vale: aplica uma única vez; repetir não muda paid_at nem gera novo evento.
create or replace function public.pay_salary_advance(p_advance_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_a public.salary_advances;
begin
  select * into v_a from public.salary_advances where id = p_advance_id for update;
  if not found then
    raise exception 'Vale não encontrado';
  end if;
  if not private.has_permission(v_a.company_id, 'despesas.manage') then
    raise exception 'Sem permissão para pagar vale';
  end if;
  if v_a.status = 'PAGO' then
    return;
  end if;
  if v_a.status not in ('SOLICITADO', 'AGENDADO') then
    raise exception 'Este vale não pode ser pago (situação %)', v_a.status;
  end if;

  update public.salary_advances set status = 'PAGO', paid_at = now() where id = p_advance_id;
  perform private.record_audit_event('salary_advance.paid', v_a.company_id, 'salary_advance', p_advance_id::text,
    jsonb_build_object('salary_obligation_id', v_a.salary_obligation_id, 'amount', v_a.amount));
end;
$$;

-- Estorno do vale: preserva o original, cria uma única reversão e audita.
create or replace function public.reverse_salary_advance(p_advance_id uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_a public.salary_advances;
  v_rev uuid;
begin
  select * into v_a from public.salary_advances where id = p_advance_id for update;
  if not found then
    raise exception 'Vale não encontrado';
  end if;
  if not private.has_permission(v_a.company_id, 'despesas.manage') then
    raise exception 'Sem permissão para estornar vale';
  end if;
  if v_a.status <> 'PAGO' or v_a.reversed_advance_id is not null then
    raise exception 'Somente vale pago pode ser estornado';
  end if;

  select id into v_rev from public.salary_advances where reversed_advance_id = p_advance_id;
  if v_rev is not null then
    return v_rev;
  end if;

  insert into public.salary_advances (company_id, salary_obligation_id, amount, status, paid_at, reversed_advance_id)
  values (v_a.company_id, v_a.salary_obligation_id, v_a.amount, 'ESTORNADO', now(), p_advance_id)
  returning id into v_rev;

  perform private.record_audit_event('salary_advance.reversed', v_a.company_id, 'salary_advance', p_advance_id::text,
    jsonb_build_object('salary_obligation_id', v_a.salary_obligation_id, 'amount', v_a.amount,
      'reversal_id', v_rev, 'reason', nullif(trim(coalesce(p_reason, '')), '')));
  return v_rev;
end;
$$;

revoke all on function public.generate_salary_obligation(uuid, date, date, text) from public, anon;
revoke all on function public.change_salary_due_date(uuid, date, text) from public, anon;
revoke all on function public.pay_salary_advance(uuid) from public, anon;
revoke all on function public.reverse_salary_advance(uuid, text) from public, anon;
grant execute on function public.generate_salary_obligation(uuid, date, date, text) to authenticated;
grant execute on function public.change_salary_due_date(uuid, date, text) to authenticated;
grant execute on function public.pay_salary_advance(uuid) to authenticated;
grant execute on function public.reverse_salary_advance(uuid, text) to authenticated;
