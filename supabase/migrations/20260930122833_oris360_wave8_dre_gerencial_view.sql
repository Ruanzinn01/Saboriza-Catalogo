-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930122833 · md5 normalizado 6e2efce7c6c8680eebff8f52e51e80c7 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
CREATE OR REPLACE VIEW public.dre_monthly
WITH (security_invoker = true) AS
WITH revenue_months AS (
  SELECT o.company_id,
         date_trunc('month', b.confirmed_at)::date AS month,
         sum(o.total_amount) AS gross_revenue,
         sum(o.discount_amount) AS deductions
  FROM billings b
  JOIN orders o ON o.id = b.order_id
  WHERE b.status = 'CONFIRMADO'
  GROUP BY o.company_id, date_trunc('month', b.confirmed_at)
),
other_revenue_months AS (
  SELECT rv.company_id,
         date_trunc('month', rr.effective_date)::date AS month,
         sum(rr.principal) AS other_revenue
  FROM revenue_receivables rr
  JOIN revenues rv ON rv.id = rr.revenue_id
  WHERE rr.status = 'RECEBIDO'
  GROUP BY rv.company_id, date_trunc('month', rr.effective_date)
),
expense_months AS (
  SELECT company_id,
         date_trunc('month', due_date)::date AS month,
         sum(amount) FILTER (WHERE nature <> 'INVESTIMENTO') AS operating_expenses
  FROM expenses
  WHERE status = 'PAGO'
  GROUP BY company_id, date_trunc('month', due_date)
),
salary_months AS (
  SELECT company_id,
         date_trunc('month', competence)::date AS month,
         sum(base_salary) AS salary_expenses
  FROM salary_obligations
  WHERE status = 'PAGO'
  GROUP BY company_id, date_trunc('month', competence)
),
months AS (
  SELECT company_id, month FROM revenue_months
  UNION SELECT company_id, month FROM other_revenue_months
  UNION SELECT company_id, month FROM expense_months
  UNION SELECT company_id, month FROM salary_months
)
SELECT
  m.company_id,
  m.month,
  coalesce(rm.gross_revenue, 0) AS gross_revenue,
  coalesce(rm.deductions, 0) AS deductions,
  coalesce(orm.other_revenue, 0) AS other_revenue,
  (coalesce(rm.gross_revenue, 0) + coalesce(orm.other_revenue, 0) - coalesce(rm.deductions, 0)) AS net_revenue,
  0::numeric AS cmv_cpv,
  (coalesce(rm.gross_revenue, 0) + coalesce(orm.other_revenue, 0) - coalesce(rm.deductions, 0)) AS gross_profit,
  (coalesce(em.operating_expenses, 0) + coalesce(sm.salary_expenses, 0)) AS operating_expenses,
  0::numeric AS financial_charges,
  (coalesce(rm.gross_revenue, 0) + coalesce(orm.other_revenue, 0) - coalesce(rm.deductions, 0))
    - (coalesce(em.operating_expenses, 0) + coalesce(sm.salary_expenses, 0)) AS managerial_operating_result
FROM months m
LEFT JOIN revenue_months rm ON rm.company_id = m.company_id AND rm.month = m.month
LEFT JOIN other_revenue_months orm ON orm.company_id = m.company_id AND orm.month = m.month
LEFT JOIN expense_months em ON em.company_id = m.company_id AND em.month = m.month
LEFT JOIN salary_months sm ON sm.company_id = m.company_id AND sm.month = m.month
ORDER BY m.company_id, m.month DESC;

COMMENT ON VIEW public.dre_monthly IS 'Onda 8 - DRE Gerencial: read model mensal, nao cria fatos, so agrega Vendas/Receitas/Despesas/Salarios ja confirmados. CMV/CPV e encargos financeiros zerados ate existir motor de custo.';
