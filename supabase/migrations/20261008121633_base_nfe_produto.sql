-- NF-e de Produto via Base ERP (Base by Asaas). Pesquisa de documentação oficial (docs.baseerp.com.br)
-- feita antes desta migration: autenticação (header access_token), ambientes separados (URL + chave
-- por ambiente, mesmo padrão do Asaas), webhook (header asaas-access-token), idempotência
-- (Idempotency-Key), payload do webhook de nota autorizada traz pdfUrl/xmlUrl mas não chave de
-- acesso nem protocolo (não existem na API pública) e campos fiscais do produto se resumem a
-- ncm/unit/cClassTrib (CFOP/CST/CSOSN/ICMS/IPI/PIS/COFINS ficam 100% na configuração fiscal da
-- empresa, dentro do painel do Base, fora da API).
--
-- Fiscal_choice ganha um terceiro valor (EMITIR_NFE_PRODUTO) para distinguir de EMITIR_NFE (que na
-- prática já significa "emitir NFS-e via Asaas"). A UI do Faturar para escolher esse terceiro valor
-- ainda NÃO foi implementada nesta migration — ela tem ~12 pontos que tratam EMITIR_NFE como único
-- caminho fiscal e precisam de uma revisão cuidadosa à parte, pra não quebrar o fluxo de NFS-e que já
-- está em produção. Esta migration só prepara o banco e as Edge Functions para quando essa UI entrar.

-- 1. Credencial: novo provider BASE, mesmo modelo de ambiente/Vault/is_active que ASAAS já usa.
ALTER TABLE public.company_integration_credentials DROP CONSTRAINT company_integration_credentials_provider_check;
ALTER TABLE public.company_integration_credentials
  ADD CONSTRAINT company_integration_credentials_provider_check CHECK (provider = ANY (ARRAY['ASAAS', 'FISCAL', 'BASE']));

-- 2. Terceiro valor de fiscal_choice, para quando o Faturar for ajustado.
ALTER TABLE public.billings DROP CONSTRAINT billings_fiscal_choice_check;
ALTER TABLE public.billings
  ADD CONSTRAINT billings_fiscal_choice_check CHECK (fiscal_choice = ANY (ARRAY['EMITIR_NFE', 'EMITIR_NFE_PRODUTO', 'SEM_DOCUMENTO_FISCAL']));

-- 3. Referência externa do cliente/produto no Base (mesmo padrão de customers.asaas_customer_id).
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS base_customer_id text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS base_product_id text;
-- Unidade comercial exigida pelo Base (campo "unit", obrigatório, máx. 6 caracteres). products não
-- tem um campo confiável pra isso hoje (packaging_type tem valores como "Fardo"/"Caixa", que não são
-- necessariamente os códigos que o Base espera) — fica null até o usuário cadastrar explicitamente.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_unit text;

-- 4. Eventos de webhook do Base, em tabela própria — não reaproveita asaas_webhook_events (provider
--    diferente, nome da tabela já é específico do Asaas).
CREATE TABLE public.base_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  credential_id uuid,
  environment text,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  process_error text,
  UNIQUE (event_id)
);

ALTER TABLE public.base_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY base_webhook_events_company_read ON public.base_webhook_events
  FOR SELECT USING (private.has_permission(company_id, 'financeiro.integracoes.manage'));

-- anon/authenticated não precisam de acesso direto: só o service_role (Edge Function) escreve, e a
-- leitura humana passa por RPC (list_integration_events generalizada no passo 6).
REVOKE ALL ON public.base_webhook_events FROM anon, authenticated;
GRANT SELECT ON public.base_webhook_events TO authenticated;

-- 5. oris360_billing_confirm: EMITIR_NFE_PRODUTO cria fiscal_documents em PROCESSANDO, igual
--    EMITIR_NFE já faz. Corpo idêntico ao original, só essa condição muda.
CREATE OR REPLACE FUNCTION public.oris360_billing_confirm(p_order_id uuid, p_payment_methods jsonb, p_fiscal_choice text, p_idempotency_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_company_id uuid;
  v_customer_id uuid;
  v_order_total numeric;
  v_billing_id uuid;
  v_financed_part numeric := 0;
  v_pm jsonb;
  v_pm_id uuid;
  v_inst jsonb;
  v_inst_id uuid;
  v_receivable_id uuid;
begin
  select company_id, customer_id, total_amount into v_company_id, v_customer_id, v_order_total
  from public.orders where id = p_order_id;

  if v_company_id is null or not private.has_permission(v_company_id, 'billing.invoice_order') then
    raise exception 'sem permissao para faturar este pedido';
  end if;

  select id into v_billing_id from public.billings where idempotency_key = p_idempotency_key;
  if v_billing_id is not null then
    return v_billing_id;
  end if;

  if exists (select 1 from public.billings where order_id = p_order_id and status = 'CONFIRMADO') then
    raise exception 'pedido ja foi faturado';
  end if;

  select coalesce(sum((pm->>'amount')::numeric), 0) into v_financed_part
  from jsonb_array_elements(p_payment_methods) pm
  where coalesce((pm->>'generates_credit')::boolean, false);

  insert into public.billings (order_id, customer_id, status, fiscal_choice, idempotency_key, company_id)
  values (p_order_id, v_customer_id, 'CONFIRMADO', p_fiscal_choice, p_idempotency_key, v_company_id)
  returning id into v_billing_id;

  insert into public.billing_credit_snapshots (
    billing_id, open_receivables, overdue_amount, overdue_count, commitments,
    credit_limit, current_exposure, financed_part, projected_exposure, available_after, excess, fingerprint
  )
  select
    v_billing_id,
    (s->>'open_receivables')::numeric, (s->>'overdue_amount')::numeric, (s->>'overdue_count')::int, (s->>'commitments')::numeric,
    (s->>'credit_limit')::numeric, (s->>'current_exposure')::numeric, (s->>'financed_part')::numeric,
    (s->>'projected_exposure')::numeric, (s->>'available_after')::numeric, (s->>'excess')::numeric, s->>'fingerprint'
  from (select private.compute_credit_snapshot(v_customer_id, v_financed_part) as s) x;

  for v_pm in select * from jsonb_array_elements(p_payment_methods)
  loop
    insert into public.payment_methods (billing_id, type, amount, condition, generates_credit, fees, auto_messages)
    values (
      v_billing_id,
      v_pm->>'type',
      (v_pm->>'amount')::numeric,
      v_pm->>'condition',
      coalesce((v_pm->>'generates_credit')::boolean, false),
      coalesce(v_pm->'fees', '{}'::jsonb),
      coalesce((v_pm->>'auto_messages')::boolean, true)
    )
    returning id into v_pm_id;

    for v_inst in select * from jsonb_array_elements(coalesce(v_pm->'installments', '[]'::jsonb))
    loop
      insert into public.installments (payment_method_id, number, days, due_date, amount)
      values (
        v_pm_id,
        (v_inst->>'number')::int,
        coalesce((v_inst->>'days')::int, 0),
        (v_inst->>'due_date')::date,
        (v_inst->>'amount')::numeric
      )
      returning id into v_inst_id;

      insert into public.receivables (customer_id, billing_id, installment_id, amount, due_date, status)
      values (v_customer_id, v_billing_id, v_inst_id, (v_inst->>'amount')::numeric, (v_inst->>'due_date')::date, 'ABERTO')
      returning id into v_receivable_id;

      if v_pm->>'type' in ('BOLETO', 'PIX') and coalesce((v_pm->>'asaas')::boolean, false) then
        insert into public.charges (installment_id, provider, idempotency_key, status, company_id)
        values (v_inst_id, 'ASAAS', p_idempotency_key || ':' || v_inst_id::text, 'PENDENTE', v_company_id);
      end if;
    end loop;
  end loop;

  insert into public.fiscal_documents (billing_id, status, company_id)
  values (v_billing_id, case when p_fiscal_choice in ('EMITIR_NFE', 'EMITIR_NFE_PRODUTO') then 'PROCESSANDO' else 'NAO_EMITIDO' end, v_company_id);

  update public.billings set confirmed_by = auth.uid(), confirmed_at = now() where id = v_billing_id;

  update public.orders set status = 'COMPLETED' where id = p_order_id;

  return v_billing_id;
end;
$function$;

-- 6. save_integration_credential: aceitar BASE como provider válido.
CREATE OR REPLACE FUNCTION public.save_integration_credential(
  p_company_id uuid,
  p_provider text,
  p_environment text,
  p_api_key text,
  p_wallet_id text DEFAULT NULL,
  p_fiscal_provider_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing public.company_integration_credentials;
  v_replaced boolean;
  v_row public.company_integration_credentials;
  v_secret_id uuid;
BEGIN
  IF NOT private.has_permission(p_company_id, 'financeiro.integracoes.manage') THEN
    RAISE EXCEPTION 'Sem permissao para gerenciar integracoes financeiras';
  END IF;
  IF p_provider NOT IN ('ASAAS', 'FISCAL', 'BASE') OR p_environment NOT IN ('SANDBOX', 'PRODUCAO') THEN
    RAISE EXCEPTION 'Provedor ou ambiente invalido';
  END IF;
  IF p_api_key IS NULL OR length(trim(p_api_key)) < 8 THEN
    RAISE EXCEPTION 'Chave de API invalida';
  END IF;

  SELECT * INTO v_existing
    FROM public.company_integration_credentials
   WHERE company_id = p_company_id AND provider = p_provider AND environment = p_environment
   FOR UPDATE;
  v_replaced := FOUND;

  IF v_replaced THEN
    PERFORM vault.update_secret(v_existing.vault_secret_id, trim(p_api_key));

    UPDATE public.company_integration_credentials
       SET key_last4 = right(trim(p_api_key), 4),
           wallet_id = COALESCE(p_wallet_id, wallet_id),
           fiscal_provider_name = COALESCE(p_fiscal_provider_name, fiscal_provider_name),
           status = 'CONFIGURADO',
           last_validated_at = NULL,
           last_error = NULL,
           is_active = false,
           activated_at = NULL,
           updated_at = now()
     WHERE id = v_existing.id
     RETURNING * INTO v_row;
  ELSE
    v_secret_id := vault.create_secret(
      trim(p_api_key),
      'integration_' || p_company_id || '_' || p_provider || '_' || p_environment,
      'Credencial ' || p_provider || ' (' || p_environment || ') da empresa ' || p_company_id
    );

    INSERT INTO public.company_integration_credentials (
      company_id, provider, environment, vault_secret_id, key_last4, wallet_id,
      fiscal_provider_name, status, is_active, webhook_token, created_by_user_id
    ) VALUES (
      p_company_id, p_provider, p_environment, v_secret_id, right(trim(p_api_key), 4), p_wallet_id,
      p_fiscal_provider_name, 'CONFIGURADO', false, encode(gen_random_bytes(24), 'hex'), (SELECT auth.uid())
    )
    RETURNING * INTO v_row;
  END IF;

  PERFORM private.record_integration_audit(
    p_company_id,
    'integration_credential.saved',
    v_row.id::text,
    jsonb_build_object('provider', p_provider, 'environment', p_environment, 'replaced', v_replaced)
  );

  RETURN private.integration_credential_json(v_row);
END;
$$;
