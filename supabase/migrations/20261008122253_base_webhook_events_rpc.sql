-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261008122253 · md5 normalizado a88559055fa0951551c38759422a12c4 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
CREATE OR REPLACE FUNCTION public.list_integration_events(p_company_id uuid, p_provider text DEFAULT 'ASAAS', p_limit integer DEFAULT 20)
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

  IF p_provider = 'BASE' THEN
    RETURN COALESCE(
      (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.received_at DESC)
         FROM (
           SELECT id, event_type, environment, received_at, processed_at, process_error
             FROM public.base_webhook_events
            WHERE company_id = p_company_id
            ORDER BY received_at DESC
            LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
         ) e),
      '[]'::jsonb
    );
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

REVOKE ALL ON FUNCTION public.list_integration_events(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_integration_events(uuid, text, integer) TO authenticated;
