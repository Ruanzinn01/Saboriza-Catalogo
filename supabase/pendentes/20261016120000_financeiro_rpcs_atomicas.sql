-- Financeiro: RPCs atômicas, idempotentes (command_id) e auditadas para pagar despesa, receber receita,
-- registrar aporte e estornar recebimento/aporte. NÃO APLICADA (pendente de ordem). Reversão: ..._reverter.sql
-- Não altera audit_events (só insere nela). Cria 1 tabela nova de comandos e 2 índices únicos parciais de estorno.

create table if not exists public.financial_commands (
  company_id uuid not null references public.companies(id) on delete restrict,
  command_id uuid not null,
  command_type text not null,
  request jsonb not null,
  result jsonb not null,
  actor_user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (company_id, command_id)
);
alter table public.financial_commands enable row level security;
revoke all on public.financial_commands from public, anon, authenticated;

create unique index if not exists revenue_receipts_one_reversal_per_receipt
  on public.revenue_receipts (reversed_receipt_id) where reversed_receipt_id is not null;
create unique index if not exists partner_contributions_one_reversal_per_contribution
  on public.partner_contributions (reversed_contribution_id) where reversed_contribution_id is not null;

-- Trava + consulta do comando. Retorna o resultado guardado (replay) ou null se for comando novo.
create or replace function private.fin_command_begin(p_company uuid, p_command uuid, p_type text, p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.financial_commands;
begin
  if p_command is null then
    raise exception 'command_id obrigatório';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_company::text || ':' || p_command::text, 0));
  select * into v_row from public.financial_commands where company_id = p_company and command_id = p_command;
  if found then
    if v_row.command_type <> p_type or v_row.request is distinct from p_request then
      raise exception 'COMANDO_REUSADO: command_id já usado com outros parâmetros' using errcode = '22023';
    end if;
    return v_row.result || jsonb_build_object('replayed', true);
  end if;
  return null;
end;
$$;

create or replace function private.fin_command_end(
  p_company uuid, p_command uuid, p_type text, p_request jsonb, p_result jsonb,
  p_event text, p_entity_type text, p_entity_id text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.financial_commands (company_id, command_id, command_type, request, result)
  values (p_company, p_command, p_type, p_request, p_result);
  insert into public.audit_events (event_type, company_id, actor_type, actor_user_id, entity_type, entity_id, idempotency_key, payload)
  values (p_event, p_company, 'USER', auth.uid(), p_entity_type, p_entity_id, p_command::text, p_payload);
  return p_result || jsonb_build_object('replayed', false);
end;
$$;
revoke all on function private.fin_command_begin(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.fin_command_end(uuid, uuid, text, jsonb, jsonb, text, text, text, jsonb) from public, anon, authenticated;

------------------------------------------------------------------ pagar despesa
create or replace function public.financeiro_pagar_despesa(p_command_id uuid, p_expense_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.expenses;
  v_req jsonb := jsonb_build_object('expense_id', p_expense_id, 'amount', p_amount);
  v_prev jsonb;
  v_paid numeric;
  v_settled boolean;
  v_status text;
  v_res jsonb;
begin
  select * into v_e from public.expenses where id = p_expense_id;
  if not found or not private.has_permission(v_e.company_id, 'despesas.manage') then
    raise exception 'Sem permissão ou despesa inexistente';
  end if;
  v_prev := private.fin_command_begin(v_e.company_id, p_command_id, 'pagar_despesa', v_req);
  if v_prev is not null then return v_prev; end if;

  select * into v_e from public.expenses where id = p_expense_id for update;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor do pagamento deve ser maior que zero';
  end if;
  if v_e.status not in ('ABERTO', 'AGENDADO', 'ATRASADO') then
    raise exception 'Despesa não pode receber pagamento (situação %)', v_e.status;
  end if;
  if p_amount > v_e.amount - coalesce(v_e.paid_amount, 0) + 0.004 then
    raise exception 'Pagamento excede o saldo da despesa';
  end if;

  v_paid := coalesce(v_e.paid_amount, 0) + p_amount;
  v_settled := v_paid >= v_e.amount - 0.004;
  v_status := case when v_settled then 'PAGO'
                   when v_e.due_date is not null and v_e.due_date < current_date then 'ATRASADO'
                   else 'ABERTO' end;
  update public.expenses
     set status = v_status, paid_at = now(), paid_amount = v_paid,
         settled_at = case when v_settled then now() else null end
   where id = p_expense_id;

  v_res := jsonb_build_object('expense_id', p_expense_id, 'status', v_status, 'paid_amount', v_paid, 'balance', v_e.amount - v_paid);
  return private.fin_command_end(v_e.company_id, p_command_id, 'pagar_despesa', v_req, v_res,
    'expense.payment_registered', 'expense', p_expense_id::text,
    jsonb_build_object('amount', p_amount, 'paid_amount_before', coalesce(v_e.paid_amount, 0), 'paid_amount_after', v_paid, 'status', v_status));
end;
$$;

------------------------------------------------------------------ receber receita
create or replace function public.financeiro_receber_receita(p_command_id uuid, p_receivable_id uuid, p_amount numeric, p_effective_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.revenue_receivables;
  v_date date := coalesce(p_effective_date, current_date);
  v_req jsonb := jsonb_build_object('receivable_id', p_receivable_id, 'amount', p_amount, 'effective_date', p_effective_date);
  v_prev jsonb;
  v_balance numeric;
  v_status text;
  v_receipt uuid;
  v_res jsonb;
begin
  select * into v_r from public.revenue_receivables where id = p_receivable_id;
  if not found or not private.has_permission(v_r.company_id, 'receitas.manage') then
    raise exception 'Sem permissão ou título inexistente';
  end if;
  v_prev := private.fin_command_begin(v_r.company_id, p_command_id, 'receber_receita', v_req);
  if v_prev is not null then return v_prev; end if;

  select * into v_r from public.revenue_receivables where id = p_receivable_id for update;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor recebido deve ser maior que zero';
  end if;
  if v_r.status = 'CANCELADO' or v_r.open_balance <= 0.004 then
    raise exception 'Título não está em aberto (situação %)', v_r.status;
  end if;
  if p_amount > v_r.open_balance + 0.004 then
    raise exception 'Recebimento excede o saldo em aberto';
  end if;

  v_balance := greatest(round(v_r.open_balance - p_amount, 2), 0);
  v_status := case when v_balance <= 0.004 then 'RECEBIDO' when v_r.due_date < current_date then 'VENCIDO' else 'ABERTO' end;
  insert into public.revenue_receipts (company_id, receivable_id, received_amount, principal_received, discount, interest_penalty, effective_date)
  values (v_r.company_id, p_receivable_id, p_amount, p_amount, 0, 0, v_date)
  returning id into v_receipt;
  update public.revenue_receivables set open_balance = v_balance, status = v_status, effective_date = v_date where id = p_receivable_id;

  v_res := jsonb_build_object('receipt_id', v_receipt, 'receivable_id', p_receivable_id, 'status', v_status, 'open_balance', v_balance);
  return private.fin_command_end(v_r.company_id, p_command_id, 'receber_receita', v_req, v_res,
    'revenue.receipt_registered', 'revenue_receipt', v_receipt::text,
    jsonb_build_object('receivable_id', p_receivable_id, 'amount', p_amount, 'open_balance_before', v_r.open_balance, 'open_balance_after', v_balance, 'status', v_status));
end;
$$;

------------------------------------------------------------------ estornar recebimento
-- A linha de estorno guarda received_amount POSITIVO (o check da tabela exige > 0) e aponta reversed_receipt_id.
create or replace function public.financeiro_estornar_recebimento(p_command_id uuid, p_receipt_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o public.revenue_receipts;
  v_r public.revenue_receivables;
  v_req jsonb := jsonb_build_object('receipt_id', p_receipt_id, 'reason', p_reason);
  v_prev jsonb;
  v_rev uuid;
  v_balance numeric;
  v_status text;
  v_res jsonb;
begin
  select * into v_o from public.revenue_receipts where id = p_receipt_id;
  if not found or not private.has_permission(v_o.company_id, 'receitas.manage') then
    raise exception 'Sem permissão ou recebimento inexistente';
  end if;
  v_prev := private.fin_command_begin(v_o.company_id, p_command_id, 'estornar_recebimento', v_req);
  if v_prev is not null then return v_prev; end if;

  select * into v_r from public.revenue_receivables where id = v_o.receivable_id for update;
  if v_o.reversed_receipt_id is not null then
    raise exception 'Um estorno não pode ser estornado';
  end if;
  if exists (select 1 from public.revenue_receipts where reversed_receipt_id = p_receipt_id) then
    raise exception 'ESTORNO_JA_REALIZADO: recebimento já estornado' using errcode = '23505';
  end if;

  insert into public.revenue_receipts (company_id, receivable_id, received_amount, principal_received, discount, interest_penalty, effective_date, reversed_receipt_id)
  values (v_o.company_id, v_o.receivable_id, v_o.received_amount, v_o.received_amount, 0, 0, current_date, p_receipt_id)
  returning id into v_rev;

  v_balance := least(v_r.open_balance + v_o.received_amount, v_r.principal);
  v_status := case when v_r.due_date < current_date then 'VENCIDO' else 'ABERTO' end;
  update public.revenue_receivables set open_balance = v_balance, status = v_status where id = v_r.id;

  v_res := jsonb_build_object('reversal_id', v_rev, 'receivable_id', v_r.id, 'status', v_status, 'open_balance', v_balance);
  return private.fin_command_end(v_o.company_id, p_command_id, 'estornar_recebimento', v_req, v_res,
    'revenue.receipt_reversed', 'revenue_receipt', p_receipt_id::text,
    jsonb_build_object('reversal_id', v_rev, 'amount', v_o.received_amount, 'reason', p_reason, 'open_balance_after', v_balance));
end;
$$;

------------------------------------------------------------------ registrar aporte
create or replace function public.financeiro_registrar_aporte(
  p_command_id uuid, p_partner_id uuid, p_amount numeric, p_status text, p_origin text,
  p_planned_date date default null, p_realized_date date default null, p_notes text default null, p_expense_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_req jsonb := jsonb_build_object('partner_id', p_partner_id, 'amount', p_amount, 'status', p_status, 'origin', p_origin,
    'planned_date', p_planned_date, 'realized_date', p_realized_date, 'notes', p_notes, 'expense_id', p_expense_id);
  v_prev jsonb;
  v_e public.expenses;
  v_date date;
  v_id uuid;
  v_res jsonb;
begin
  select company_id into v_company from public.company_partners where id = p_partner_id;
  if v_company is null or not private.has_permission(v_company, 'aportes.manage') then
    raise exception 'Sem permissão ou sócio inexistente';
  end if;
  v_prev := private.fin_command_begin(v_company, p_command_id, 'registrar_aporte', v_req);
  if v_prev is not null then return v_prev; end if;

  if p_amount is null or p_amount <= 0 then raise exception 'Valor do aporte deve ser maior que zero'; end if;
  if p_status not in ('PLANEJADO', 'REALIZADO') then raise exception 'Situação inicial inválida'; end if;
  v_date := case when p_status = 'REALIZADO' then coalesce(p_realized_date, current_date) else p_realized_date end;

  if p_expense_id is not null then
    select * into v_e from public.expenses where id = p_expense_id and company_id = v_company for update;
    if not found then raise exception 'Despesa não encontrada nesta empresa'; end if;
    if p_status = 'REALIZADO' and v_e.status not in ('ABERTO', 'AGENDADO', 'ATRASADO') then
      raise exception 'Despesa não pode ser paga por aporte (situação %)', v_e.status;
    end if;
  end if;

  insert into public.partner_contributions (company_id, partner_id, amount, status, origin, planned_date, realized_date, notes, expense_id)
  values (v_company, p_partner_id, p_amount, p_status, p_origin, p_planned_date, v_date, p_notes, p_expense_id)
  returning id into v_id;

  if p_expense_id is not null and p_status = 'REALIZADO' then
    update public.expenses set status = 'PAGO', paid_at = coalesce(v_date::timestamptz, now()), paid_amount = p_amount, settled_at = now()
     where id = p_expense_id;
  end if;

  v_res := jsonb_build_object('contribution_id', v_id, 'status', p_status);
  return private.fin_command_end(v_company, p_command_id, 'registrar_aporte', v_req, v_res,
    'partner_contribution.registered', 'partner_contribution', v_id::text,
    jsonb_build_object('partner_id', p_partner_id, 'amount', p_amount, 'status', p_status, 'origin', p_origin, 'expense_id', p_expense_id));
end;
$$;

------------------------------------------------------------------ estornar aporte
create or replace function public.financeiro_estornar_aporte(p_command_id uuid, p_contribution_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o public.partner_contributions;
  v_req jsonb := jsonb_build_object('contribution_id', p_contribution_id, 'reason', p_reason);
  v_prev jsonb;
  v_rev uuid;
  v_res jsonb;
begin
  select * into v_o from public.partner_contributions where id = p_contribution_id;
  if not found or not private.has_permission(v_o.company_id, 'aportes.manage') then
    raise exception 'Sem permissão ou aporte inexistente';
  end if;
  v_prev := private.fin_command_begin(v_o.company_id, p_command_id, 'estornar_aporte', v_req);
  if v_prev is not null then return v_prev; end if;

  select * into v_o from public.partner_contributions where id = p_contribution_id for update;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'Motivo obrigatório'; end if;
  if v_o.status <> 'REALIZADO' or v_o.reversed_contribution_id is not null then
    raise exception 'Somente aporte realizado pode ser estornado';
  end if;
  if exists (select 1 from public.partner_contributions where reversed_contribution_id = p_contribution_id) then
    raise exception 'ESTORNO_JA_REALIZADO: aporte já estornado' using errcode = '23505';
  end if;

  insert into public.partner_contributions (company_id, partner_id, amount, origin, status, realized_date, notes, reversed_contribution_id)
  values (v_o.company_id, v_o.partner_id, v_o.amount, v_o.origin, 'ESTORNADO', current_date, 'Estorno do aporte original: ' || p_reason, p_contribution_id)
  returning id into v_rev;

  v_res := jsonb_build_object('reversal_id', v_rev, 'contribution_id', p_contribution_id);
  return private.fin_command_end(v_o.company_id, p_command_id, 'estornar_aporte', v_req, v_res,
    'partner_contribution.reversed', 'partner_contribution', p_contribution_id::text,
    jsonb_build_object('reversal_id', v_rev, 'amount', v_o.amount, 'reason', p_reason));
end;
$$;

revoke all on function public.financeiro_pagar_despesa(uuid, uuid, numeric) from public, anon;
revoke all on function public.financeiro_receber_receita(uuid, uuid, numeric, date) from public, anon;
revoke all on function public.financeiro_estornar_recebimento(uuid, uuid, text) from public, anon;
revoke all on function public.financeiro_registrar_aporte(uuid, uuid, numeric, text, text, date, date, text, uuid) from public, anon;
revoke all on function public.financeiro_estornar_aporte(uuid, uuid, text) from public, anon;
grant execute on function public.financeiro_pagar_despesa(uuid, uuid, numeric) to authenticated;
grant execute on function public.financeiro_receber_receita(uuid, uuid, numeric, date) to authenticated;
grant execute on function public.financeiro_estornar_recebimento(uuid, uuid, text) to authenticated;
grant execute on function public.financeiro_registrar_aporte(uuid, uuid, numeric, text, text, date, date, text, uuid) to authenticated;
grant execute on function public.financeiro_estornar_aporte(uuid, uuid, text) to authenticated;
