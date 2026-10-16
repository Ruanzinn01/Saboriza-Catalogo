-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002132241 · md5 normalizado ebdb9ed74b9c1af45dcd0d5ceecc0696 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Auditoria mínima reutilizando a tabela audit_events já existente (0 rows hoje, schema pronto)
create or replace function private.record_audit_event(
  p_event_type text, p_company_id uuid, p_entity_type text, p_entity_id text, p_payload jsonb default '{}'::jsonb
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_events (event_type, company_id, actor_type, actor_user_id, entity_type, entity_id, payload)
  values (p_event_type, p_company_id, 'user', auth.uid(), p_entity_type, p_entity_id, p_payload);
$$;

-- Guarda de competência fechada: bloqueia reescrita de campos ECONÔMICOS de expenses após o fechamento.
-- Campos financeiros (status/pagamento/programação/bloqueio) continuam editáveis — obrigação aberta
-- atravessa o fechamento sem duplicar o fato (PRD §8 / RFC §8.3).
create or replace function private.expenses_guard_closed_period()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.monthly_closes
  where company_id = old.company_id and competence = date_trunc('month', old.competence)::date;

  if v_status in ('FECHADO_AUTOMATICAMENTE', 'FECHADO_COM_PENDENCIA') then
    if new.amount is distinct from old.amount
       or new.category is distinct from old.category
       or new.nature is distinct from old.nature
       or new.origin is distinct from old.origin
       or new.competence is distinct from old.competence
       or new.description is distinct from old.description
       or new.employee_id is distinct from old.employee_id
       or new.partner_id is distinct from old.partner_id
    then
      raise exception 'Competência % está fechada: edição retroativa não é permitida. Registre um ajuste.', old.competence
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists expenses_guard_closed_period_trg on public.expenses;
create trigger expenses_guard_closed_period_trg
  before update on public.expenses
  for each row execute function private.expenses_guard_closed_period();

-- Correção pós-fechamento = novo evento vinculado ao fato original, nunca edição retroativa (PRD §8 / RFC §8.4)
create or replace function public.create_expense_adjustment(
  p_original_expense_id uuid,
  p_reason text,
  p_new_amount numeric default null,
  p_new_category text default null,
  p_new_description text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orig public.expenses%rowtype;
  v_new_id uuid;
begin
  select * into v_orig from public.expenses where id = p_original_expense_id;
  if not found then
    raise exception 'Despesa original não encontrada';
  end if;
  if not private.has_permission(v_orig.company_id, 'despesas.manage') then
    raise exception 'Sem permissão para ajuste de despesa';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Motivo obrigatório para ajuste';
  end if;

  insert into public.expenses (
    company_id, description, category, nature, origin, pattern,
    employee_id, partner_id, competence, amount, status, due_date, created_by,
    original_expense_id, adjustment_reason, source_module, source_entity_id
  ) values (
    v_orig.company_id,
    coalesce(p_new_description, v_orig.description) || ' (ajuste)',
    coalesce(p_new_category, v_orig.category),
    v_orig.nature, v_orig.origin, v_orig.pattern,
    v_orig.employee_id, v_orig.partner_id,
    date_trunc('month', now())::date,
    coalesce(p_new_amount, v_orig.amount) - v_orig.amount,
    'ABERTO', now()::date, auth.uid(),
    p_original_expense_id, p_reason, 'despesas', p_original_expense_id
  )
  returning id into v_new_id;

  perform private.record_audit_event(
    'expense.adjustment_created', v_orig.company_id, 'expense', v_new_id::text,
    jsonb_build_object('original_expense_id', p_original_expense_id, 'reason', p_reason, 'delta_amount', coalesce(p_new_amount, v_orig.amount) - v_orig.amount)
  );

  return v_new_id;
end;
$$;

-- Bloquear/interromper despesa — três opções obrigatórias do DRT (hold|skip_occurrence|end_recurrence)
create or replace function public.block_expense(p_expense_id uuid, p_block_type text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_event_type text;
begin
  select company_id into v_company from public.expenses where id = p_expense_id;
  if v_company is null then
    raise exception 'Despesa não encontrada';
  end if;
  if not private.has_permission(v_company, 'despesas.manage') then
    raise exception 'Sem permissão para bloquear despesa';
  end if;
  if p_block_type not in ('hold', 'skip_occurrence', 'end_recurrence') then
    raise exception 'Tipo de bloqueio inválido';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Motivo obrigatório';
  end if;

  update public.expenses set
    block_type = p_block_type,
    block_reason = p_reason,
    blocked_at = now(),
    blocked_by = auth.uid(),
    status = case when p_block_type = 'hold' then 'BLOQUEADO' else status end,
    updated_at = now()
  where id = p_expense_id;

  v_event_type := case p_block_type
    when 'hold' then 'expense.blocked'
    when 'skip_occurrence' then 'expense.occurrence_cancelled'
    else 'expense.recurrence_ended'
  end;

  perform private.record_audit_event(v_event_type, v_company, 'expense', p_expense_id::text,
    jsonb_build_object('block_type', p_block_type, 'reason', p_reason));
end;
$$;
;
