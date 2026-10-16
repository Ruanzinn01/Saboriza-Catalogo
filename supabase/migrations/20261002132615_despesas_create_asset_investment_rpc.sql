-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002132615 · md5 normalizado 26c30c9a18c76efbde3ef6d911c963b3 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Investimento nasce em Despesas e credita o saldo em formação na MESMA transação (RFC §14: "ledger de formação").
-- Não cria asset_units automaticamente — isso só ocorre na apropriação futura pelo Patrimônio.
create or replace function public.create_asset_investment(
  p_description text,
  p_category_id text,
  p_amount numeric,
  p_competence date,
  p_due_date date default null,
  p_pattern text default 'eventual',
  p_idempotency_key text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_expense_id uuid;
begin
  v_company := private.default_company_id();
  if v_company is null then
    raise exception 'Empresa não identificada';
  end if;
  if not private.has_permission(v_company, 'despesas.manage') then
    raise exception 'Sem permissão para lançar investimento';
  end if;
  if p_amount <= 0 then
    raise exception 'Valor do investimento deve ser maior que zero';
  end if;

  if p_idempotency_key is not null then
    select source_entity_id into v_expense_id
    from public.investment_formation_ledger
    where idempotency_key = p_idempotency_key;
    if v_expense_id is not null then
      return v_expense_id;
    end if;
  end if;

  insert into public.expenses (
    company_id, description, category, nature, origin, pattern,
    competence, amount, status, due_date, created_by, source_module
  ) values (
    v_company, p_description, p_category_id, 'INVESTIMENTO', 'asset', p_pattern,
    p_competence, p_amount, 'ABERTO', p_due_date, auth.uid(), 'despesas'
  )
  returning id into v_expense_id;

  insert into public.investment_formation_ledger (
    company_id, category_id, source_expense_id, direction, amount, competence, idempotency_key
  ) values (
    v_company, p_category_id, v_expense_id, 'credit', p_amount, p_competence, p_idempotency_key
  );

  perform private.record_audit_event('investment.formation_credited', v_company, 'expense', v_expense_id::text,
    jsonb_build_object('category_id', p_category_id, 'amount', p_amount));

  return v_expense_id;
end;
$$;

revoke execute on function public.create_asset_investment(text, text, numeric, date, date, text, text) from public;
grant execute on function public.create_asset_investment(text, text, numeric, date, date, text, text) to authenticated;
;
