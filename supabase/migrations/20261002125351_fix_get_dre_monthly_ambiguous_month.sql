-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002125351 · md5 normalizado 515bf212fc033715d8fb2a99a03bb4fc · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
CREATE OR REPLACE FUNCTION public.get_dre_monthly(p_company_id uuid)
 RETURNS TABLE(month date, gross_revenue numeric, deductions numeric, other_revenue numeric, net_revenue numeric, cmv_cpv numeric, gross_profit numeric, operating_expenses numeric, financial_charges numeric, managerial_operating_result numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT private.has_permission(p_company_id, 'dre.read') THEN
    RAISE EXCEPTION 'permission denied for dre.read';
  END IF;

  RETURN QUERY
  WITH revenue_months AS (
    SELECT o.company_id,
           date_trunc('month', b.confirmed_at)::date AS mth,
           sum(o.total_amount) AS gross_revenue,
           sum(o.discount_amount) AS deductions
    FROM billings b
    JOIN orders o ON o.id = b.order_id
    WHERE b.status = 'CONFIRMADO' AND o.company_id = p_company_id
    GROUP BY o.company_id, date_trunc('month', b.confirmed_at)
  ),
  other_revenue_months AS (
    SELECT rv.company_id,
           date_trunc('month', rr.effective_date)::date AS mth,
           sum(rr.principal) AS other_revenue
    FROM revenue_receivables rr
    JOIN revenues rv ON rv.id = rr.revenue_id
    WHERE rr.status = 'RECEBIDO' AND rv.company_id = p_company_id
    GROUP BY rv.company_id, date_trunc('month', rr.effective_date)
  ),
  expense_months AS (
    SELECT company_id,
           date_trunc('month', due_date)::date AS mth,
           sum(amount) FILTER (WHERE nature <> 'INVESTIMENTO') AS operating_expenses
    FROM expenses
    WHERE status = 'PAGO' AND company_id = p_company_id
    GROUP BY company_id, date_trunc('month', due_date)
  ),
  salary_months AS (
    SELECT company_id,
           date_trunc('month', competence)::date AS mth,
           sum(base_salary) AS salary_expenses
    FROM salary_obligations
    WHERE status = 'PAGO' AND company_id = p_company_id
    GROUP BY company_id, date_trunc('month', competence)
  ),
  all_months AS (
    SELECT company_id, mth FROM revenue_months
    UNION SELECT company_id, mth FROM other_revenue_months
    UNION SELECT company_id, mth FROM expense_months
    UNION SELECT company_id, mth FROM salary_months
  )
  SELECT
    m.mth,
    coalesce(rm.gross_revenue, 0),
    coalesce(rm.deductions, 0),
    coalesce(orm.other_revenue, 0),
    (coalesce(rm.gross_revenue, 0) + coalesce(orm.other_revenue, 0) - coalesce(rm.deductions, 0)),
    0::numeric,
    (coalesce(rm.gross_revenue, 0) + coalesce(orm.other_revenue, 0) - coalesce(rm.deductions, 0)),
    (coalesce(em.operating_expenses, 0) + coalesce(sm.salary_expenses, 0)),
    0::numeric,
    (coalesce(rm.gross_revenue, 0) + coalesce(orm.other_revenue, 0) - coalesce(rm.deductions, 0))
      - (coalesce(em.operating_expenses, 0) + coalesce(sm.salary_expenses, 0))
  FROM all_months m
  LEFT JOIN revenue_months rm ON rm.company_id = m.company_id AND rm.mth = m.mth
  LEFT JOIN other_revenue_months orm ON orm.company_id = m.company_id AND orm.mth = m.mth
  LEFT JOIN expense_months em ON em.company_id = m.company_id AND em.mth = m.mth
  LEFT JOIN salary_months sm ON sm.company_id = m.company_id AND sm.mth = m.mth
  ORDER BY m.mth DESC;
END;
$function$;
;
