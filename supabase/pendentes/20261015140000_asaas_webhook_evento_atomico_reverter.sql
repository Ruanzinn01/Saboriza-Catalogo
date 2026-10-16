-- REVERSÃO do recebimento atômico do webhook Asaas: remove a função. Nenhum dado é alterado (eventos já gravados permanecem).
drop function if exists public.apply_asaas_webhook_event(uuid, text, text, text, jsonb);
