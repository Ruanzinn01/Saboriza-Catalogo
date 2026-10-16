-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002132149 · md5 normalizado 5c126bd07d535bb0f23bbc700ec3d2ce · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Histórico de vigência salarial (pacote mestre Despesas: salário resolvido pela competência, nunca redigitado)
create table public.salary_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  employee_id uuid not null references public.employees(id) on delete cascade,
  salary_base numeric not null check (salary_base >= 0),
  effective_date date not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index salary_history_employee_idx on public.salary_history(employee_id, effective_date desc);
create index salary_history_company_idx on public.salary_history(company_id);

alter table public.salary_history enable row level security;

-- Mesma regra de acesso já usada em employees (sem permissão granular própria hoje)
create policy salary_history_select on public.salary_history
  for select using (private.is_active_company_member(company_id));

create policy salary_history_insert on public.salary_history
  for insert with check (private.is_active_company_member(company_id));

-- Append-only: sem policy de update/delete (preserva vigências passadas)

-- Backfill: salário atual vira a primeira vigência conhecida
insert into public.salary_history (company_id, employee_id, salary_base, effective_date, created_at)
select company_id, id, salary_base, coalesce(salary_effective_date, admission_date, '2026-01-01'::date), now()
from public.employees
where salary_base is not null;

-- Resolve o salário-base vigente de um colaborador numa competência (nunca redigitado em Despesas)
create or replace function public.resolve_salary_base(p_employee_id uuid, p_competence date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select sh.salary_base from public.salary_history sh
     where sh.employee_id = p_employee_id and sh.effective_date <= p_competence
     order by sh.effective_date desc limit 1),
    (select e.salary_base from public.employees e where e.id = p_employee_id)
  );
$$;

-- Atualiza salário inserindo nova vigência (nunca sobrescreve o histórico)
create or replace function public.update_employee_salary(p_employee_id uuid, p_salary_base numeric, p_effective_date date)
returns void
language plpgsql
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
    raise exception 'Sem permissão para alterar salário';
  end if;
  if p_salary_base < 0 then
    raise exception 'Salário inválido';
  end if;

  insert into public.salary_history (company_id, employee_id, salary_base, effective_date, created_by)
  values (v_company, p_employee_id, p_salary_base, p_effective_date, auth.uid());

  if (select max(effective_date) from public.salary_history where employee_id = p_employee_id) = p_effective_date then
    update public.employees
    set salary_base = p_salary_base, salary_effective_date = p_effective_date, updated_at = now()
    where id = p_employee_id;
  end if;
end;
$$;
;
