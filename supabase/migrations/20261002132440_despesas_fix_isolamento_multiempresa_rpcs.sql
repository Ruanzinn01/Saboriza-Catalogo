-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002132440 · md5 normalizado 502766198764cf9995d0979330823ea6 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Fix de isolamento multiempresa detectado pelos advisors de segurança:
-- get_formation_balance e resolve_salary_base não validavam permissão na empresa do parâmetro recebido
-- (um usuário autenticado de outra empresa podia passar um company_id/employee_id alheio e ler o dado).

create or replace function public.get_formation_balance(p_company_id uuid, p_category_id text)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.has_permission(p_company_id, 'patrimonio.read') or private.has_permission(p_company_id, 'despesas.read')) then
    raise exception 'Sem permissão para consultar saldo em formação desta empresa';
  end if;

  return coalesce((
    select sum(
      case direction
        when 'credit' then amount
        when 'debit' then -amount
        when 'reversal' then -amount
      end
    )
    from public.investment_formation_ledger
    where company_id = p_company_id and category_id = p_category_id
  ), 0);
end;
$$;

create or replace function public.resolve_salary_base(p_employee_id uuid, p_competence date)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.employees where id = p_employee_id;
  if v_company is null then
    raise exception 'Colaborador não encontrado';
  end if;
  if not private.is_active_company_member(v_company) then
    raise exception 'Sem permissão para consultar salário deste colaborador';
  end if;

  return coalesce(
    (select sh.salary_base from public.salary_history sh
     where sh.employee_id = p_employee_id and sh.effective_date <= p_competence
     order by sh.effective_date desc limit 1),
    (select e.salary_base from public.employees e where e.id = p_employee_id)
  );
end;
$$;

-- search_path mutável no trigger function (lint function_search_path_mutable)
create or replace function private.expenses_guard_closed_period()
returns trigger
language plpgsql
set search_path = ''
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

-- run_monthly_close_rollover é função de sistema (cron) — ninguém via REST deve poder disparar fechamento em massa
revoke execute on function public.run_monthly_close_rollover() from public, anon, authenticated;

-- Defesa em profundidade: as demais RPCs já checam permissão internamente, mas anon não precisa nem tentar
revoke execute on function public.block_expense(uuid, text, text) from anon;
revoke execute on function public.create_expense_adjustment(uuid, text, numeric, text, text) from anon;
revoke execute on function public.update_employee_salary(uuid, numeric, date) from anon;
revoke execute on function public.resolve_salary_base(uuid, date) from anon;
revoke execute on function public.get_formation_balance(uuid, text) from anon;
;
