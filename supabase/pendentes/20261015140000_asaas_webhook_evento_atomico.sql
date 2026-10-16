-- WEBHOOK ASAAS: recebimento atômico e idempotente no banco. NÃO APLICADA EM PRODUÇÃO NEM EM HOMOLOGAÇÃO; a função de borda NÃO foi alterada nem publicada.
-- Reversão: 20261015140000_asaas_webhook_evento_atomico_reverter.sql (só remove esta função; não mexe em dados).
--
-- Defeitos da lógica atual da função de borda (supabase/functions/asaas-webhook/index.ts), provados em testes_webhook_asaas.mjs:
--  1. charges.status = 'PAGO' viola o CHECK (valores válidos: PENDENTE, EMITIDA, PAGA, FALHOU, CANCELADA). O erro é ignorado; a cobrança
--     nunca vira paga nem SINCRONIZADO (a baixa do recebível funciona porque é outro comando).
--  2. Cada comando é independente e os erros são ignorados, mas processed_at é gravado do mesmo jeito: uma falha no meio perde o evento.
--  3. PAYMENT_CONFIRMED depois de PAYMENT_RECEIVED (ids diferentes) sobrescreve paid_at.
--  4. PAYMENT_OVERDUE fora de ordem rebaixa um recebível PAGO para VENCIDO; recebível CANCELADO pode ser reaberto.
--  5. event_id é único no mundo (não por empresa): colisão entre empresas fica sem tratamento explícito.
-- Esta função: valida o token da empresa, persiste o evento, aplica tudo numa subtransação (falha deixa o evento pendente com o erro e
-- sem efeito parcial), nunca rebaixa estado final e repetição devolve duplicate sem refazer nada. Devolve jsonb; quem chama (função de
-- borda, service_role) traduz: TOKEN_INVALIDO -> 401; ok=false com retry=true -> 500 (o Asaas reenvia); demais -> 200.

create or replace function public.apply_asaas_webhook_event(
  p_company_id uuid, p_access_token text, p_event_id text, p_event_type text, p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_cred record;
  v_event_id uuid;
  v_ev record;
  v_err text;
  v_payment jsonb := p_payload -> 'payment';
  v_invoice jsonb := p_payload -> 'invoice';
  v_charge record;
  v_doc record;
begin
  if p_company_id is null or coalesce(p_access_token, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'TOKEN_INVALIDO');
  end if;
  select id, environment, is_active into v_cred
    from public.company_integration_credentials
   where company_id = p_company_id and provider = 'ASAAS' and webhook_token = p_access_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'TOKEN_INVALIDO');
  end if;
  if coalesce(p_event_id, '') = '' or coalesce(p_event_type, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'EVENTO_INVALIDO');
  end if;

  insert into public.asaas_webhook_events (company_id, event_id, event_type, payload, environment, credential_id)
  values (p_company_id, p_event_id, p_event_type, coalesce(p_payload, '{}'::jsonb), v_cred.environment, v_cred.id)
  on conflict (event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select id, company_id, processed_at into v_ev from public.asaas_webhook_events where event_id = p_event_id for update;
    if v_ev.company_id is distinct from p_company_id then
      return jsonb_build_object('ok', false, 'error', 'EVENTO_DE_OUTRA_EMPRESA');
    end if;
    if v_ev.processed_at is not null then
      return jsonb_build_object('ok', true, 'duplicate', true);
    end if;
    v_event_id := v_ev.id;
  end if;

  begin
    if not v_cred.is_active then
      v_err := 'IGNORADO: ambiente ' || v_cred.environment || ' nao esta ativo nesta empresa';
    elsif p_event_type like 'INVOICE\_%' then
      if coalesce(v_invoice ->> 'id', '') = '' then
        v_err := 'evento sem invoice.id';
      else
        select id, status into v_doc from public.fiscal_documents
         where external_id = v_invoice ->> 'id' and company_id = p_company_id for update;
        if not found then
          v_err := 'nota fiscal nao encontrada para este invoice_id';
        elsif p_event_type in ('INVOICE_AUTHORIZED', 'INVOICE_SYNCHRONIZED') then
          update public.fiscal_documents
             set status = 'AUTORIZADA',
                 number = coalesce(v_invoice ->> 'rpsNumber', v_invoice ->> 'number', number),
                 pdf_ref = coalesce(v_invoice ->> 'pdfUrl', pdf_ref),
                 xml_ref = coalesce(v_invoice ->> 'xmlUrl', xml_ref)
           where id = v_doc.id and status <> 'CANCELADA';
        elsif p_event_type = 'INVOICE_ERROR' then
          update public.fiscal_documents set status = 'REJEITADA' where id = v_doc.id and status in ('NAO_EMITIDO', 'PROCESSANDO');
        elsif p_event_type in ('INVOICE_CANCELED', 'INVOICE_CANCELLED') then
          update public.fiscal_documents set status = 'CANCELADA' where id = v_doc.id;
        end if;
      end if;
    else
      if coalesce(v_payment ->> 'id', '') = '' then
        v_err := 'evento sem payment.id';
      else
        select id, installment_id into v_charge from public.charges
         where external_id = v_payment ->> 'id' and company_id = p_company_id for update;
        if not found then
          v_err := 'cobranca nao encontrada para este payment_id';
        elsif p_event_type in ('PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED') then
          update public.charges set status = 'PAGA', technical_state = 'SINCRONIZADO' where id = v_charge.id and status <> 'CANCELADA';
          update public.receivables
             set status = 'PAGO', paid_at = coalesce(paid_at, now())
           where installment_id = v_charge.installment_id and company_id = p_company_id and status in ('ABERTO', 'VENCIDO');
        elsif p_event_type = 'PAYMENT_OVERDUE' then
          update public.receivables set status = 'VENCIDO'
           where installment_id = v_charge.installment_id and company_id = p_company_id and status = 'ABERTO';
        elsif p_event_type in ('PAYMENT_DELETED', 'PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED') then
          update public.charges set technical_state = 'RECONCILIAR' where id = v_charge.id;
        end if;
      end if;
    end if;
  exception when others then
    update public.asaas_webhook_events set process_error = left(sqlerrm, 500) where id = v_event_id;
    return jsonb_build_object('ok', false, 'error', 'FALHA_APLICACAO', 'retry', true);
  end;

  update public.asaas_webhook_events set processed_at = now(), process_error = v_err where id = v_event_id;
  return jsonb_build_object('ok', true, 'duplicate', false, 'process_error', v_err);
end;
$$;

-- só o papel interno das funções de borda chama esta função: nenhum cliente da API pública
revoke all on function public.apply_asaas_webhook_event(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_asaas_webhook_event(uuid, text, text, text, jsonb) to service_role;
