-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002140205 · md5 normalizado 5858240aea7e04298e7743f90377f3a9 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Apropriação patrimonial: Patrimônio debita o saldo em formação (creditado por Despesas) e cria o bem.
-- NÃO gera nova despesa nem nova saída financeira (PRD Despesas §6.5 / RFC §14.4, cenário de aceite "Apropriação patrimonial não gera nova saída").
alter table public.investment_formation_ledger
  add column source_asset_model_id uuid references public.asset_models(id);

create or replace function public.appropriate_asset_from_formation(
  p_category_id text,
  p_model_name text,
  p_amount numeric,
  p_quantity int default 1,
  p_responsible_id uuid default null,
  p_acquisition_date date default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_balance numeric;
  v_model_id uuid;
  v_quantity int := greatest(1, coalesce(p_quantity, 1));
begin
  v_company := private.default_company_id();
  if v_company is null then
    raise exception 'Empresa não identificada';
  end if;
  if not private.has_permission(v_company, 'patrimonio.manage') then
    raise exception 'Sem permissão para apropriar bem patrimonial';
  end if;
  if p_amount <= 0 then
    raise exception 'Valor de apropriação deve ser maior que zero';
  end if;

  -- Serializa apropriações concorrentes da mesma categoria/empresa para evitar saldo negativo por corrida.
  perform pg_advisory_xact_lock(hashtextextended(v_company::text || ':' || p_category_id, 0));

  select coalesce(sum(
    case direction when 'credit' then amount when 'debit' then -amount when 'reversal' then -amount end
  ), 0) into v_balance
  from public.investment_formation_ledger
  where company_id = v_company and category_id = p_category_id;

  if v_balance < p_amount then
    raise exception 'Saldo em formação insuficiente na categoria % (disponível %, solicitado %)', p_category_id, v_balance, p_amount;
  end if;

  insert into public.asset_models (name, category, company_id)
  values (p_model_name, p_category_id, v_company)
  returning id into v_model_id;

  insert into public.asset_units (company_id, asset_model_id, acquisition_value, acquisition_date, current_responsible_id)
  select v_company, v_model_id, p_amount / v_quantity, p_acquisition_date, p_responsible_id
  from generate_series(1, v_quantity);

  insert into public.investment_formation_ledger (
    company_id, category_id, direction, amount, competence, source_asset_model_id
  ) values (
    v_company, p_category_id, 'debit', p_amount, date_trunc('month', now())::date, v_model_id
  );

  perform private.record_audit_event('investment.formation_appropriated', v_company, 'asset_model', v_model_id::text,
    jsonb_build_object('category_id', p_category_id, 'amount', p_amount, 'quantity', v_quantity));

  return v_model_id;
end;
$$;

revoke execute on function public.appropriate_asset_from_formation(text, text, numeric, int, uuid, date) from anon, public;
grant execute on function public.appropriate_asset_from_formation(text, text, numeric, int, uuid, date) to authenticated;
;
