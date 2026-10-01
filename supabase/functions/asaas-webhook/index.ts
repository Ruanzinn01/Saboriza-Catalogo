// Recebe eventos do Asaas (PAYMENT_RECEIVED, PAYMENT_OVERDUE, etc). Endpoint publico por natureza
// (o Asaas nao manda JWT do Supabase) — autenticacao e feita pelo header asaas-access-token,
// configurado por empresa, comparado contra o token gerado em save_integration_credential.
// Persiste o payload ANTES de aplicar qualquer regra de negocio, com event_id UNIQUE, pra um
// evento duplicado (retry do proprio Asaas) nunca repetir uma baixa (patch secao 4).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

async function applyPaymentEvent(companyId: string, eventType: string, payment: Record<string, unknown> | undefined) {
  if (!payment?.id) return null;

  const { data: charge } = await serviceClient
    .from("charges")
    .select("id, installment_id")
    .eq("external_id", payment.id as string)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!charge) return "cobranca nao encontrada para este payment_id";

  if (eventType === "PAYMENT_RECEIVED" || eventType === "PAYMENT_CONFIRMED") {
    await serviceClient.from("charges").update({ status: "PAGO", technical_state: "SINCRONIZADO" }).eq("id", charge.id);
    await serviceClient.from("receivables").update({ status: "PAGO", paid_at: new Date().toISOString() }).eq("installment_id", charge.installment_id);
  } else if (eventType === "PAYMENT_OVERDUE") {
    await serviceClient.from("receivables").update({ status: "VENCIDO" }).eq("installment_id", charge.installment_id);
  } else if (eventType === "PAYMENT_DELETED" || eventType === "PAYMENT_REFUNDED" || eventType === "PAYMENT_CHARGEBACK_REQUESTED") {
    await serviceClient.from("charges").update({ technical_state: "RECONCILIAR" }).eq("id", charge.id);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "metodo nao suportado" }, 405);

  const url = new URL(req.url);
  const companyId = url.searchParams.get("company");
  const accessToken = req.headers.get("asaas-access-token");
  if (!companyId || !accessToken) return jsonResponse({ error: "requisicao invalida" }, 400);

  const { data: credential } = await serviceClient
    .from("company_integration_credentials")
    .select("id")
    .eq("company_id", companyId)
    .eq("provider", "ASAAS")
    .eq("webhook_token", accessToken)
    .maybeSingle();
  if (!credential) return jsonResponse({ error: "token invalido" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "corpo invalido" }, 400);
  }

  const eventType = (body.event as string) ?? "DESCONHECIDO";
  const payment = body.payment as Record<string, unknown> | undefined;
  const eventId = (body.id as string) || `${eventType}:${payment?.id ?? "sem_payment"}:${payment?.status ?? ""}:${payment?.dueDate ?? ""}`;

  const { error: insertError } = await serviceClient.from("asaas_webhook_events").insert({
    company_id: companyId,
    event_id: eventId,
    event_type: eventType,
    payload: body,
  });

  if (insertError) {
    if (insertError.code === "23505") return jsonResponse({ ok: true, duplicate: true });
    return jsonResponse({ error: "falha ao persistir evento" }, 500);
  }

  const processError = await applyPaymentEvent(companyId, eventType, payment);
  await serviceClient
    .from("asaas_webhook_events")
    .update({ processed_at: new Date().toISOString(), process_error: processError })
    .eq("event_id", eventId);

  return jsonResponse({ ok: true });
});
