-- Central de Integrações (onda A): credencial ativa explícita, acesso só por RPC, webhook token fora do SELECT.

-- 1. anon/authenticated tinham INSERT/UPDATE/DELETE/TRUNCATE direto na tabela. RLS não cobre TRUNCATE,
--    então qualquer usuário logado conseguiria apagar as credenciais de todas as empresas. Toda leitura e
--    escrita passa a ser feita pelas RPCs abaixo (SECURITY DEFINER, com permissão checada por company).
REVOKE ALL ON public.company_integration_credentials FROM anon, authenticated;

-- 2. Ambiente ativo explícito por empresa + provedor. Só pode haver uma credencial ativa por provedor,
--    e só credencial validada pode ficar ativa.
ALTER TABLE public.company_integration_credentials
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

ALTER TABLE public.company_integration_credentials DROP CONSTRAINT IF EXISTS cic_active_requires_validated;
ALTER TABLE public.company_integration_credentials
  ADD CONSTRAINT cic_active_requires_validated CHECK (NOT is_active OR status = 'VALIDADO');

CREATE UNIQUE INDEX IF NOT EXISTS cic_one_active_per_provider
  ON public.company_integration_credentials (company_id, provider) WHERE is_active;

-- 3. Webhook registra de qual ambiente/credencial veio o evento.
ALTER TABLE public.asaas_webhook_events
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS credential_id uuid;

-- 4. Helpers privados.
CREATE OR REPLACE FUNCTION private.integration_credential_json(c public.company_integration_credentials)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'id', c.id,
    'provider', c.provider,
    'environment', c.environment,
    'key_last4', c.key_last4,
    'wallet_id', c.wallet_id,
    'fiscal_provider_name', c.fiscal_provider_name,
    'status', c.status,
    'is_active', c.is_active,
    'activated_at', c.activated_at,
    'last_validated_at', c.last_validated_at,
    'last_error', c.last_error,
    'has_webhook_token', c.webhook_token IS NOT NULL,
    'updated_at', c.updated_at
  )
$$;

CREATE OR REPLACE FUNCTION private.record_integration_audit(p_company_id uuid, p_event_type text, p_entity_id text, p_payload jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  INSERT INTO public.audit_events (
    event_type, schema_version, company_id, actor_type, actor_user_id,
    entity_type, entity_id, occurred_at, recorded_at, correlation_id, payload
  ) VALUES (
    p_event_type, 1, p_company_id, 'user', (SELECT auth.uid()),
    'integration_credential', p_entity_id, now(), now(), gen_random_uuid(), p_payload
  )
$$;

-- 5. Listagem segura: nunca devolve webhook_token nem vault_secret_id.
CREATE OR REPLACE FUNCTION public.list_integration_credentials(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT private.has_permission(p_company_id, 'financeiro.integracoes.read') THEN
    RAISE EXCEPTION 'Sem permissao para ver integracoes financeiras';
  END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(private.integration_credential_json(c) ORDER BY c.provider, c.environment)
       FROM public.company_integration_credentials c
      WHERE c.company_id = p_company_id),
    '[]'::jsonb
  );
END;
$$;

-- 6. Salvar/substituir chave. Substituir chave desativa o ambiente e exige novo teste.
DROP FUNCTION IF EXISTS public.save_integration_credential(text, text, text, text, text);

CREATE FUNCTION public.save_integration_credential(
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
  IF p_provider NOT IN ('ASAAS', 'FISCAL') OR p_environment NOT IN ('SANDBOX', 'PRODUCAO') THEN
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

-- 7. Ativar um ambiente (ou desativar tudo, com p_environment NULL). Só ativa credencial VALIDADA.
CREATE OR REPLACE FUNCTION public.set_active_integration_credential(p_company_id uuid, p_provider text, p_environment text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target public.company_integration_credentials;
BEGIN
  IF NOT private.has_permission(p_company_id, 'financeiro.integracoes.manage') THEN
    RAISE EXCEPTION 'Sem permissao para gerenciar integracoes financeiras';
  END IF;

  IF p_environment IS NULL THEN
    UPDATE public.company_integration_credentials
       SET is_active = false, activated_at = NULL
     WHERE company_id = p_company_id AND provider = p_provider AND is_active;

    PERFORM private.record_integration_audit(p_company_id, 'integration_credential.deactivated', p_provider,
      jsonb_build_object('provider', p_provider));
    RETURN NULL;
  END IF;

  SELECT * INTO v_target
    FROM public.company_integration_credentials
   WHERE company_id = p_company_id AND provider = p_provider AND environment = p_environment
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma credencial cadastrada para este ambiente';
  END IF;
  IF v_target.status <> 'VALIDADO' THEN
    RAISE EXCEPTION 'Valide a conexao deste ambiente antes de ativa-lo';
  END IF;

  -- Dois UPDATEs separados: o índice único parcial é checado linha a linha, então desativar antes de ativar.
  UPDATE public.company_integration_credentials
     SET is_active = false, activated_at = NULL
   WHERE company_id = p_company_id AND provider = p_provider AND environment <> p_environment AND is_active;

  UPDATE public.company_integration_credentials
     SET is_active = true, activated_at = now()
   WHERE id = v_target.id
   RETURNING * INTO v_target;

  PERFORM private.record_integration_audit(p_company_id, 'integration_credential.activated', v_target.id::text,
    jsonb_build_object('provider', p_provider, 'environment', p_environment));

  RETURN private.integration_credential_json(v_target);
END;
$$;

-- 8. Remoção: apaga só a credencial e o segredo. Cobranças e documentos fiscais já existentes ficam intactos.
DROP FUNCTION IF EXISTS public.remove_integration_credential(text, text);

CREATE FUNCTION public.remove_integration_credential(p_company_id uuid, p_provider text, p_environment text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.company_integration_credentials;
BEGIN
  IF NOT private.has_permission(p_company_id, 'financeiro.integracoes.manage') THEN
    RAISE EXCEPTION 'Sem permissao para gerenciar integracoes financeiras';
  END IF;

  SELECT * INTO v_row
    FROM public.company_integration_credentials
   WHERE company_id = p_company_id AND provider = p_provider AND environment = p_environment
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  DELETE FROM public.company_integration_credentials WHERE id = v_row.id;
  DELETE FROM vault.secrets WHERE id = v_row.vault_secret_id;

  PERFORM private.record_integration_audit(p_company_id, 'integration_credential.removed', v_row.id::text,
    jsonb_build_object('provider', p_provider, 'environment', p_environment, 'was_active', v_row.is_active));
END;
$$;

-- 9. Token do webhook: só sai do banco sob ação explícita de quem tem permissão de gerenciar.
CREATE OR REPLACE FUNCTION public.get_integration_webhook_token(p_company_id uuid, p_provider text, p_environment text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT private.has_permission(p_company_id, 'financeiro.integracoes.manage') THEN
    RAISE EXCEPTION 'Sem permissao para gerenciar integracoes financeiras';
  END IF;

  SELECT webhook_token INTO v_token
    FROM public.company_integration_credentials
   WHERE company_id = p_company_id AND provider = p_provider AND environment = p_environment;
  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Webhook ainda nao gerado para este ambiente';
  END IF;

  PERFORM private.record_integration_audit(p_company_id, 'integration_webhook.token_viewed', p_provider || ':' || p_environment,
    jsonb_build_object('provider', p_provider, 'environment', p_environment));

  RETURN v_token;
END;
$$;

-- 10. Rotação do token: o endpoint antigo para de aceitar eventos até a nova URL/token ser colada no Asaas.
CREATE OR REPLACE FUNCTION public.rotate_integration_webhook_token(p_company_id uuid, p_provider text, p_environment text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT private.has_permission(p_company_id, 'financeiro.integracoes.manage') THEN
    RAISE EXCEPTION 'Sem permissao para gerenciar integracoes financeiras';
  END IF;

  UPDATE public.company_integration_credentials
     SET webhook_token = encode(gen_random_bytes(24), 'hex'), updated_at = now()
   WHERE company_id = p_company_id AND provider = p_provider AND environment = p_environment
   RETURNING webhook_token INTO v_token;
  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Credencial nao cadastrada para este ambiente';
  END IF;

  PERFORM private.record_integration_audit(p_company_id, 'integration_webhook.token_rotated', p_provider || ':' || p_environment,
    jsonb_build_object('provider', p_provider, 'environment', p_environment));

  RETURN v_token;
END;
$$;

-- 11. Últimos eventos de webhook, com ambiente.
CREATE OR REPLACE FUNCTION public.list_integration_events(p_company_id uuid, p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT private.has_permission(p_company_id, 'financeiro.integracoes.read') THEN
    RAISE EXCEPTION 'Sem permissao para ver integracoes financeiras';
  END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.received_at DESC)
       FROM (
         SELECT id, event_type, environment, received_at, processed_at, process_error
           FROM public.asaas_webhook_events
          WHERE company_id = p_company_id
          ORDER BY received_at DESC
          LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
       ) e),
    '[]'::jsonb
  );
END;
$$;

-- 12. Só usuários autenticados chamam as RPCs; anon fica de fora.
REVOKE ALL ON FUNCTION public.list_integration_credentials(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_integration_credential(uuid, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_active_integration_credential(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_integration_credential(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_integration_webhook_token(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rotate_integration_webhook_token(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_integration_events(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.integration_credential_json(public.company_integration_credentials) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.record_integration_audit(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.list_integration_credentials(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_integration_credential(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_integration_credential(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_integration_credential(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_integration_webhook_token(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_integration_webhook_token(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_integration_events(uuid, integer) TO authenticated;
