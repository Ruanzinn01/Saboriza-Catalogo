// Recebe eventos do Base ERP (docs.baseerp.com.br/docs/webhooks) sobre NF-e de produto. Endpoint
// publico por natureza (o Base nao manda JWT do Supabase) — autenticacao pelo header
// asaas-access-token, confirmado literalmente na documentacao oficial do Base (nao e confusao com o
// Asaas Payments: e o mesmo nome de header, mas e o Base quem documenta usar esse nome).
// Payload de INVOICE_NFE_AUTHORIZED confirmado na doc oficial traz pdfUrl/xmlUrl dentro de
// "invoiceNfe" — nao existe chave de acesso nem protocolo documentados publicamente, entao
// fiscal_documents.key fica sempre null pra esse provider.

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

interface InvoiceNfe {
  invoiceId?: string | number;
  number?: string | number;
  pdfUrl?: string;
  xmlUrl?: string;
  status?: string;
}

async function applyInvoiceEvent(companyId: string, eventType: string, invoiceNfe: InvoiceNfe | undefined) {
  if (!invoiceNfe?.invoiceId) return "payload sem invoiceNfe.invoiceId";

  const { data: fiscalDoc } = await serviceClient
    .from("fiscal_documents")
    .select("id")
    .eq("external_id", String(invoiceNfe.invoiceId))
    .eq("company_id", companyId)
    .maybeSingle();
  if (!fiscalDoc) return "nota fiscal nao encontrada para este invoiceId";

  if (eventType === "INVOICE_NFE_AUTHORIZED") {
    await serviceClient
      .from("fiscal_documents")
      .update({
        status: "AUTORIZADA",
        number: invoiceNfe.number != null ? String(invoiceNfe.number) : null,
        pdf_ref: invoiceNfe.pdfUrl ?? null,
        xml_ref: invoiceNfe.xmlUrl ?? null,
      })
      .eq("id", fiscalDoc.id);
  } else if (eventType === "INVOICE_NFE_ERROR") {
    await serviceClient.from("fiscal_documents").update({ status: "REJEITADA" }).eq("id", fiscalDoc.id);
  } else if (eventType === "INVOICE_NFE_CANCELED") {
    await serviceClient.from("fiscal_documents").update({ status: "CANCELADA" }).eq("id", fiscalDoc.id);
  }
  // Carta de correção, inutilização e cancelamento com erro são registrados no evento (abaixo), mas
  // não têm campo próprio em fiscal_documents hoje — fora do escopo desta etapa.
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
    .select("id, environment, is_active")
    .eq("company_id", companyId)
    .eq("provider", "BASE")
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
  const invoiceNfe = body.invoiceNfe as InvoiceNfe | undefined;
  const eventId = (body.id as string) || `${eventType}:${invoiceNfe?.invoiceId ?? "sem_invoice"}`;

  const { error: insertError } = await serviceClient.from("base_webhook_events").insert({
    company_id: companyId,
    event_id: eventId,
    event_type: eventType,
    payload: body,
    environment: credential.environment,
    credential_id: credential.id,
  });

  if (insertError) {
    if (insertError.code !== "23505") return jsonResponse({ error: "falha ao persistir evento" }, 500);
    const { data: existing } = await serviceClient
      .from("base_webhook_events")
      .select("processed_at")
      .eq("event_id", eventId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (existing?.processed_at) return jsonResponse({ ok: true, duplicate: true });
  }

  // Evento de ambiente inativo fica registrado, mas nunca altera documento fiscal — mesma regra do
  // asaas-webhook, pra Sandbox nunca mexer em dado de Produção (e vice-versa).
  const processError = !credential.is_active
    ? `IGNORADO: ambiente ${credential.environment} nao esta ativo nesta empresa`
    : await applyInvoiceEvent(companyId, eventType, invoiceNfe);

  await serviceClient
    .from("base_webhook_events")
    .update({ processed_at: new Date().toISOString(), process_error: processError })
    .eq("event_id", eventId)
    .eq("company_id", companyId);

  return jsonResponse({ ok: true });
});
