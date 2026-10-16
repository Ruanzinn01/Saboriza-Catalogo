-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260930124350 · md5 normalizado 5f733e2331fd1b8a3fd62b3bcec8eb41 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE public.monthly_closes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  competence date NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['EM_ANDAMENTO','PREPARANDO','PRONTO','FECHADO_AUTOMATICAMENTE','FECHADO_COM_PENDENCIA','FALHA_TECNICA_FECHAMENTO'])),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  pendencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  checksum text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, competence)
);

CREATE TABLE public.company_closing_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id),
  automation_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.monthly_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_closing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY monthly_closes_select ON public.monthly_closes
  FOR SELECT USING (private.has_permission(company_id, 'fechamento.read'));

CREATE POLICY ccs_select ON public.company_closing_settings
  FOR SELECT USING (private.has_permission(company_id, 'fechamento.read'));

CREATE POLICY ccs_insert ON public.company_closing_settings
  FOR INSERT WITH CHECK (private.has_permission(company_id, 'fechamento.manage'));

CREATE POLICY ccs_update ON public.company_closing_settings
  FOR UPDATE USING (private.has_permission(company_id, 'fechamento.manage'))
  WITH CHECK (private.has_permission(company_id, 'fechamento.manage'));

INSERT INTO permissions (key, name, description, sensitivity) VALUES
  ('fechamento.read', 'Consultar Fechamento Mensal', 'Ver snapshots de fechamento e status da automacao', 'CRITICAL'),
  ('fechamento.manage', 'Gerenciar Fechamento Mensal', 'Ativar ou desativar a automacao de fechamento mensal', 'CRITICAL')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, company_id, permission_key)
SELECT DISTINCT r.id, r.company_id, p.key
FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id AND rp.permission_key = 'patrimonio.manage'
CROSS JOIN (VALUES ('fechamento.read'), ('fechamento.manage')) AS p(key)
ON CONFLICT DO NOTHING;

-- Constroi o snapshot de uma competencia (funcao interna, roda com privilegio elevado, sem contexto de usuario autenticado)
CREATE OR REPLACE FUNCTION private.build_monthly_close_snapshot(p_company_id uuid, p_competence date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_end date := (p_competence + interval '1 month' - interval '1 day')::date;
  v_gross_revenue numeric;
  v_deductions numeric;
  v_other_revenue numeric;
  v_operating_expenses numeric;
  v_salary_expenses numeric;
  v_receivables_open numeric;
  v_obligations_open numeric;
  v_partner_contributions numeric;
  v_assets_value numeric;
  v_snapshot jsonb;
BEGIN
  SELECT coalesce(sum(o.total_amount), 0), coalesce(sum(o.discount_amount), 0)
    INTO v_gross_revenue, v_deductions
  FROM billings b JOIN orders o ON o.id = b.order_id
  WHERE b.status = 'CONFIRMADO' AND o.company_id = p_company_id
    AND date_trunc('month', b.confirmed_at)::date = p_competence;

  SELECT coalesce(sum(rr.principal), 0) INTO v_other_revenue
  FROM revenue_receivables rr JOIN revenues rv ON rv.id = rr.revenue_id
  WHERE rv.company_id = p_company_id AND rr.status = 'RECEBIDO'
    AND date_trunc('month', rr.effective_date)::date = p_competence;

  SELECT coalesce(sum(amount) FILTER (WHERE nature <> 'INVESTIMENTO'), 0) INTO v_operating_expenses
  FROM expenses
  WHERE company_id = p_company_id AND status = 'PAGO'
    AND date_trunc('month', due_date)::date = p_competence;

  SELECT coalesce(sum(base_salary), 0) INTO v_salary_expenses
  FROM salary_obligations
  WHERE company_id = p_company_id AND status = 'PAGO' AND competence = p_competence;

  SELECT coalesce(sum(open_balance), 0) INTO v_receivables_open
  FROM revenue_receivables rr JOIN revenues rv ON rv.id = rr.revenue_id
  WHERE rv.company_id = p_company_id AND rr.status IN ('ABERTO', 'VENCIDO') AND rr.due_date <= v_month_end;

  SELECT coalesce(sum(amount), 0) INTO v_obligations_open
  FROM expenses
  WHERE company_id = p_company_id AND status IN ('ABERTO', 'AGENDADO', 'ATRASADO') AND due_date <= v_month_end;

  SELECT coalesce(sum(amount), 0) INTO v_partner_contributions
  FROM partner_contributions
  WHERE company_id = p_company_id AND status = 'REALIZADO' AND realized_date <= v_month_end;

  SELECT coalesce(sum(acquisition_value), 0) INTO v_assets_value
  FROM asset_units
  WHERE company_id = p_company_id AND status = 'ATIVO';

  v_snapshot := jsonb_build_object(
    'resultado', jsonb_build_object(
      'receita_bruta', v_gross_revenue,
      'outras_receitas', v_other_revenue,
      'deducoes', v_deductions,
      'despesas_operacionais', v_operating_expenses + v_salary_expenses,
      'resultado_operacional_gerencial', (v_gross_revenue + v_other_revenue - v_deductions) - (v_operating_expenses + v_salary_expenses)
    ),
    'recebiveis', jsonb_build_object('em_aberto', v_receivables_open),
    'obrigacoes', jsonb_build_object('em_aberto', v_obligations_open),
    'socios', jsonb_build_object('aportes_realizados_acumulados', v_partner_contributions),
    'patrimonio', jsonb_build_object('valor_ativos_acumulado', v_assets_value),
    'caixa', jsonb_build_object('disponivel', false, 'motivo', 'motor de caixa/banco ainda nao implementado'),
    'estoque', jsonb_build_object('disponivel', false, 'motivo', 'motor de custo/estoque ainda nao implementado'),
    'comercial', jsonb_build_object('disponivel', false, 'motivo', 'Forca de Vendas ainda nao implementada'),
    'integridade', jsonb_build_object('gerado_em', now(), 'competencia', p_competence)
  );

  RETURN v_snapshot;
END;
$$;

-- Varredura automatica: fecha o mes anterior para empresas com automacao ativa, uma vez que o mes tenha virado no fuso da empresa
CREATE OR REPLACE FUNCTION private.run_monthly_close_sweep()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company record;
  v_local_now timestamptz;
  v_current_competence date;
  v_prior_competence date;
  v_snapshot jsonb;
BEGIN
  FOR v_company IN
    SELECT c.id, c.default_timezone
    FROM companies c
    JOIN company_closing_settings ccs ON ccs.company_id = c.id
    WHERE ccs.automation_enabled = true
  LOOP
    v_local_now := now() AT TIME ZONE v_company.default_timezone;
    v_current_competence := date_trunc('month', v_local_now)::date;
    v_prior_competence := (v_current_competence - interval '1 month')::date;

    IF v_current_competence > v_prior_competence
       AND NOT EXISTS (
         SELECT 1 FROM monthly_closes
         WHERE company_id = v_company.id AND competence = v_prior_competence
       )
    THEN
      BEGIN
        v_snapshot := private.build_monthly_close_snapshot(v_company.id, v_prior_competence);
        INSERT INTO monthly_closes (company_id, competence, status, snapshot, pendencies, checksum, closed_at)
        VALUES (
          v_company.id,
          v_prior_competence,
          'FECHADO_COM_PENDENCIA',
          v_snapshot,
          jsonb_build_array('Caixa', 'Estoque', 'Comercial'),
          md5(v_snapshot::text),
          now()
        );
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO monthly_closes (company_id, competence, status, snapshot, pendencies, closed_at)
        VALUES (v_company.id, v_prior_competence, 'FALHA_TECNICA_FECHAMENTO', jsonb_build_object('erro', SQLERRM), '[]'::jsonb, now())
        ON CONFLICT (company_id, competence) DO NOTHING;
      END;
    END IF;
  END LOOP;
END;
$$;

-- RPC publica para a empresa ativar/desativar a automacao (nunca fecha o mes manualmente, so liga/desliga o motor)
CREATE OR REPLACE FUNCTION public.set_monthly_close_automation(p_company_id uuid, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_permission(p_company_id, 'fechamento.manage') THEN
    RAISE EXCEPTION 'permission denied for fechamento.manage';
  END IF;

  INSERT INTO company_closing_settings (company_id, automation_enabled, updated_by, updated_at)
  VALUES (p_company_id, p_enabled, auth.uid(), now())
  ON CONFLICT (company_id) DO UPDATE SET
    automation_enabled = p_enabled,
    updated_by = auth.uid(),
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_monthly_close_automation(uuid, boolean) TO authenticated;

SELECT cron.schedule('oris360-monthly-close-sweep', '*/30 * * * *', $$SELECT private.run_monthly_close_sweep()$$);
