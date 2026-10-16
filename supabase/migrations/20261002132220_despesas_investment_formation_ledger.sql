-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002132220 · md5 normalizado 6e9cca8292e34e9ee0b18943ca0de040 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Ledger de formação patrimonial: investimento nasce em Despesas, credita saldo em formação por categoria.
-- Apropriação futura pelo Patrimônio debita este ledger sem gerar nova despesa/saída (RFC §14).
create table public.investment_formation_ledger (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  category_id text not null,
  source_expense_id uuid references public.expenses(id),
  direction text not null check (direction in ('credit','debit','reversal')),
  amount numeric not null check (amount > 0),
  competence date not null,
  occurred_at timestamptz not null default now(),
  correlation_id uuid default gen_random_uuid(),
  idempotency_key text,
  actor_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);

create index ifl_company_category_idx on public.investment_formation_ledger(company_id, category_id);

alter table public.investment_formation_ledger enable row level security;

create policy ifl_select on public.investment_formation_ledger
  for select using (private.has_permission(company_id, 'patrimonio.read') or private.has_permission(company_id, 'despesas.read'));

create policy ifl_insert on public.investment_formation_ledger
  for insert with check (private.has_permission(company_id, 'despesas.manage') or private.has_permission(company_id, 'patrimonio.manage'));

-- Append-only: sem update/delete

create or replace function public.get_formation_balance(p_company_id uuid, p_category_id text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(
    case direction
      when 'credit' then amount
      when 'debit' then -amount
      when 'reversal' then -amount
    end
  ), 0)
  from public.investment_formation_ledger
  where company_id = p_company_id and category_id = p_category_id;
$$;
;
