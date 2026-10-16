-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261008140211 · md5 normalizado 11bf4fb10f0ac99d65d88cd2a137b38d · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
CREATE OR REPLACE FUNCTION private.record_audit_event(p_event_type text, p_company_id uuid, p_entity_type text, p_entity_id text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.audit_events (event_type, company_id, actor_type, actor_user_id, entity_type, entity_id, payload)
  values (p_event_type, p_company_id, 'USER', auth.uid(), p_entity_type, p_entity_id, p_payload);
$function$;
