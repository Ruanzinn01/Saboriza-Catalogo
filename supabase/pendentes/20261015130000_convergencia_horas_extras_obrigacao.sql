-- CONVERGÊNCIA DAS HORAS EXTRAS PAGAS NA OBRIGAÇÃO SALARIAL (item 8). NÃO APLICADA EM PRODUÇÃO NEM EM HOMOLOGAÇÃO.
-- Depende de decisão do responsável (impacta KPIs de Despesas: ver docs/integracoes/CONVERGENCIA_HORAS_EXTRAS_ANTES_DEPOIS.md).
-- Reversão: 20261015130000_convergencia_horas_extras_obrigacao_reverter.sql
--
-- Hoje oris360_resolver_banco_horas(..., 'PAGO') insere uma linha em expenses (natureza SALARIO), a terceira porta para dinheiro
-- de salário. Aqui o mesmo comando (mesma assinatura, o app antigo continua funcionando) passa a gravar SOMENTE em
-- salary_obligation_items, ligado à obrigação do colaborador na competência de ORIGEM das horas (FIFO dos créditos do banco).
-- private.salary_balances (fonte dos totais de Financeiro Geral, Painel do Proprietário e DRE) soma os itens ativos ao valor devido:
-- sem itens, o resultado é idêntico ao anterior. Linhas antigas de expenses (pagamentos já feitos) NÃO são reescritas.
-- Ordem: aplicar DEPOIS de seguranca_salario_pix_2_restritiva.sql (aquele arquivo recria esta função na versão antiga com despesa).

create table public.salary_obligation_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  salary_obligation_id uuid not null references public.salary_obligations(id),
  employee_id uuid not null references public.employees(id),
  competence date not null,
  kind text not null check (kind in ('HORA_EXTRA_PAGA')),
  minutes integer not null check (minutes > 0),
  amount numeric not null check (amount > 0),
  time_bank_entry_id uuid not null references public.time_bank_entries(id),
  status text not null default 'ATIVO' check (status in ('ATIVO', 'ESTORNADO')),
  reversed_at timestamptz,
  reversed_by uuid,
  reverse_reason text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (time_bank_entry_id, competence)
);

create index salary_obligation_items_obligation_idx on public.salary_obligation_items (salary_obligation_id, status);

alter table public.salary_obligation_items enable row level security;
create policy salary_obligation_items_select on public.salary_obligation_items
  for select to authenticated using (private.has_permission(company_id, 'despesas.read'));
-- escrita só pelas funções abaixo (SECURITY DEFINER); nenhuma política de insert/update/delete
revoke all on public.salary_obligation_items from anon, authenticated;
grant select on public.salary_obligation_items to authenticated;

-- A fonte dos totais passa a somar os itens ativos. A coluna base_salary da saída continua sendo "valor devido" para os
-- chamadores (get_financeiro_geral_summary, get_owner_panel_summary, get_dre_monthly), que não precisam mudar.
create or replace function private.salary_balances(p_company_id uuid)
returns table (obligation_id uuid, competence date, due_date date, base_salary numeric, paid numeric, remaining numeric)
language sql
stable
security definer
set search_path to ''
as $$
  select o.id, o.competence, o.due_date, o.base_salary + x.extras, p.paid, o.base_salary + x.extras - p.paid
  from public.salary_obligations o
  cross join lateral (
    select coalesce(sum(i.amount), 0) as extras
    from public.salary_obligation_items i
    where i.salary_obligation_id = o.id and i.status = 'ATIVO'
  ) x
  cross join lateral (
    select coalesce(sum(a.amount), 0) as paid
    from public.salary_advances a
    where a.salary_obligation_id = o.id
      and a.status = 'PAGO'
      and not exists (select 1 from public.salary_advances r where r.reversed_advance_id = a.id)
  ) p
  where o.company_id = p_company_id
$$;

revoke all on function private.salary_balances(uuid) from public, anon, authenticated;

create or replace function public.oris360_resolver_banco_horas(p_employee_id uuid, p_minutes integer, p_resolution text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_company_id uuid;
  v_salary numeric;
  v_divisor numeric;
  v_percent numeric;
  v_hourly numeric;
  v_amount numeric;
  v_entry_id uuid;
  v_balance integer;
  v_consumed integer;
  v_need integer;
  v_take integer;
  v_avail integer;
  v_credit record;
  v_slices jsonb := '[]'::jsonb;
  v_slice record;
  v_sum numeric := 0;
  v_slice_amount numeric;
  v_obligation public.salary_obligations;
  v_competence date;
begin
  if p_resolution not in ('PAGO', 'COMPENSADO') then
    raise exception 'resolucao invalida';
  end if;
  if p_minutes is null or p_minutes <= 0 then
    raise exception 'Informe uma quantidade de minutos maior que zero';
  end if;

  select company_id, salary_base, monthly_divisor, timesheet_overtime_percent
    into v_company_id, v_salary, v_divisor, v_percent
    from public.employees where id = p_employee_id;

  if v_company_id is null or not private.has_permission(v_company_id, 'timesheet.apuracao.manage') then
    raise exception 'sem permissao';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('banco_horas' || p_employee_id::text, 0));

  select coalesce(sum(case when type = 'CREDITO_EXTRA' then minutes else -minutes end), 0)::integer
    into v_balance from public.time_bank_entries where employee_id = p_employee_id;
  if p_minutes > v_balance then
    raise exception 'SALDO_INSUFICIENTE: o banco de horas tem % minuto(s) e foram pedidos %', v_balance, p_minutes;
  end if;

  if p_resolution = 'COMPENSADO' then
    insert into public.time_bank_entries (employee_id, type, minutes) values (p_employee_id, 'COMPENSADO', p_minutes) returning id into v_entry_id;
    return v_entry_id;
  end if;

  if v_salary is null or v_divisor is null or v_divisor = 0 then
    raise exception 'colaborador sem salario/divisor configurado para calcular o valor da hora';
  end if;
  v_hourly := v_salary / v_divisor;
  v_amount := round((p_minutes / 60.0) * v_hourly * (1 + coalesce(v_percent, 0) / 100.0), 2);

  -- FIFO: as horas pagas saem dos créditos mais antigos que ainda têm saldo; cada fatia pertence ao mês em que as horas foram feitas
  select coalesce(sum(minutes), 0)::integer into v_consumed from public.time_bank_entries where employee_id = p_employee_id and type <> 'CREDITO_EXTRA';
  v_need := p_minutes;
  for v_credit in
    select competencia, minutes from public.time_bank_entries
    where employee_id = p_employee_id and type = 'CREDITO_EXTRA'
    order by coalesce(competencia, date '0001-01-01'), created_at, id
  loop
    exit when v_need = 0;
    v_avail := v_credit.minutes - least(v_credit.minutes, v_consumed);
    v_consumed := greatest(v_consumed - v_credit.minutes, 0);
    if v_avail > 0 then
      v_take := least(v_avail, v_need);
      v_need := v_need - v_take;
      v_competence := date_trunc('month', coalesce(v_credit.competencia, current_date))::date;
      v_slices := v_slices || jsonb_build_object('competence', v_competence, 'minutes', v_take);
    end if;
  end loop;
  if v_need > 0 then
    raise exception 'SALDO_INSUFICIENTE: créditos do banco de horas não cobrem os minutos pedidos';
  end if;

  insert into public.time_bank_entries (employee_id, type, minutes, amount) values (p_employee_id, 'PAGO', p_minutes, v_amount) returning id into v_entry_id;

  for v_slice in
    select (e ->> 'competence')::date as competence, sum((e ->> 'minutes')::integer)::integer as minutes
    from jsonb_array_elements(v_slices) e group by 1 order by 1
  loop
    select * into v_obligation from public.salary_obligations where employee_id = p_employee_id and competence = v_slice.competence for update;
    if not found then
      raise exception 'OBRIGACAO_INEXISTENTE: gere a folha de % do colaborador (com vencimento) antes de pagar horas extras dessa competência', to_char(v_slice.competence, 'MM/YYYY');
    end if;
    v_slice_amount := round((v_slice.minutes / 60.0) * v_hourly * (1 + coalesce(v_percent, 0) / 100.0), 2);
    if v_slice.competence = (select max((e ->> 'competence')::date) from jsonb_array_elements(v_slices) e) then
      v_slice_amount := v_amount - v_sum;
    end if;
    v_sum := v_sum + v_slice_amount;
    if v_slice_amount <= 0 then
      continue;
    end if;
    insert into public.salary_obligation_items (company_id, salary_obligation_id, employee_id, competence, kind, minutes, amount, time_bank_entry_id)
    values (v_company_id, v_obligation.id, p_employee_id, v_slice.competence, 'HORA_EXTRA_PAGA', v_slice.minutes, v_slice_amount, v_entry_id);
    update public.salary_obligations
       set additions = coalesce(additions, 0) + v_slice_amount, net_amount = coalesce(net_amount, base_salary) + v_slice_amount
     where id = v_obligation.id;
  end loop;

  perform private.record_audit_event('salary_obligation.overtime_paid', v_company_id, 'time_bank_entry', v_entry_id::text,
    jsonb_build_object('employee_id', p_employee_id, 'minutes', p_minutes, 'amount', v_amount, 'slices', v_slices));
  return v_entry_id;
end;
$$;

-- Estorno: evento inverso. O item vira ESTORNADO (histórico imutável), as horas voltam ao banco por crédito compensatório e o valor
-- sai do devido da obrigação. Se o devido ficaria abaixo do que já foi pago, recusa (estorne antes os vales pagos).
create or replace function public.reverse_overtime_payment(p_time_bank_entry_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_entry public.time_bank_entries;
  v_item record;
  v_paid numeric;
  v_o public.salary_obligations;
  v_active integer;
begin
  select * into v_entry from public.time_bank_entries where id = p_time_bank_entry_id for update;
  if not found or v_entry.type <> 'PAGO' then
    raise exception 'Pagamento de horas extras não encontrado';
  end if;
  if not (private.has_permission(v_entry.company_id, 'timesheet.apuracao.manage') and private.has_permission(v_entry.company_id, 'despesas.manage')) then
    raise exception 'Sem permissão para estornar pagamento de horas extras';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'MOTIVO_OBRIGATORIO: informe o motivo do estorno';
  end if;
  if v_entry.expense_id is not null then
    raise exception 'ESTORNO_LEGADO: este pagamento foi lançado em Despesas antes da convergência; estorne por lá';
  end if;
  select count(*) into v_active from public.salary_obligation_items where time_bank_entry_id = p_time_bank_entry_id and status = 'ATIVO';
  if v_active = 0 then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('banco_horas' || v_entry.employee_id::text, 0));

  for v_item in select * from public.salary_obligation_items where time_bank_entry_id = p_time_bank_entry_id and status = 'ATIVO' order by competence loop
    select * into v_o from public.salary_obligations where id = v_item.salary_obligation_id for update;
    select coalesce(sum(a.amount), 0) into v_paid from public.salary_advances a
      where a.salary_obligation_id = v_o.id and a.status = 'PAGO'
        and not exists (select 1 from public.salary_advances r where r.reversed_advance_id = a.id);
    if v_o.base_salary + coalesce((select sum(i.amount) from public.salary_obligation_items i where i.salary_obligation_id = v_o.id and i.status = 'ATIVO'), 0) - v_item.amount < v_paid then
      raise exception 'ESTORNO_BLOQUEADO: a folha de % já foi paga além do valor sem estas horas; estorne antes os vales pagos', to_char(v_item.competence, 'MM/YYYY');
    end if;
    update public.salary_obligation_items
       set status = 'ESTORNADO', reversed_at = now(), reversed_by = auth.uid(), reverse_reason = trim(p_reason)
     where id = v_item.id;
    update public.salary_obligations
       set additions = coalesce(additions, 0) - v_item.amount, net_amount = coalesce(net_amount, base_salary) - v_item.amount
     where id = v_o.id;
  end loop;

  insert into public.time_bank_entries (employee_id, type, minutes) values (v_entry.employee_id, 'CREDITO_EXTRA', v_entry.minutes);
  perform private.record_audit_event('salary_obligation.overtime_reversed', v_entry.company_id, 'time_bank_entry', p_time_bank_entry_id::text,
    jsonb_build_object('employee_id', v_entry.employee_id, 'minutes', v_entry.minutes, 'amount', v_entry.amount, 'reason', trim(p_reason)));
end;
$$;

revoke all on function public.oris360_resolver_banco_horas(uuid, integer, text) from public, anon;
revoke all on function public.reverse_overtime_payment(uuid, text) from public, anon;
grant execute on function public.oris360_resolver_banco_horas(uuid, integer, text) to authenticated;
grant execute on function public.reverse_overtime_payment(uuid, text) to authenticated;
