// Emissão de NFS-e via Asaas (/v3/invoices) — reaproveita a MESMA credencial Asaas já conectada
// na Fase 5 (cobrança), sem exigir uma segunda chave por empresa. Cobre o caminho de empresas que
// vendem SERVIÇO. NF-e de produto (caso de empresas que vendem mercadoria) fica fora deste escopo —
// exige um provedor dedicado (certificado A1) e é decisão de produto registrada à parte.
//
// Padrão de segurança idêntico ao asaas-create-charge: service_role só server-side, chave lida via
// Vault (nunca exposta ao client), permissão checada com o JWT do usuário, idempotente por billing_id
// (fiscal_documents.status em PROCESSANDO/EMITIDA bloqueia reemissão).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

function asaasBaseUrl(environment: string) {
  return environment === "PRODUCAO" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

async function markFailure(fiscalDocId: string, companyId: string, message: string) {
  await serviceClient.from("fiscal_documents").update({ status: "REJEITADA" }).eq("id", fiscalDocId);
  await serviceClient.from("audit_events").insert({
    event_type: "fiscal_document.emission_failed",
    company_id: companyId,
    actor_type: "system",
    entity_type: "fiscal_document",
    entity_id: fiscalDocId,
    payload: { message },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "metodo nao suportado" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "nao autenticado" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "corpo invalido" }, 400);
  }

  const billingId = body.billing_id as string;
  if (!billingId) return jsonResponse({ error: "billing_id obrigatorio" }, 400);

  const { data: billing } = await serviceClient
    .from("billings")
    .select("id, order_id, customer_id, company_id, fiscal_choice")
    .eq("id", billingId)
    .maybeSingle();
  if (!billing) return jsonResponse({ error: "faturamento nao encontrado" }, 404);
  if (billing.fiscal_choice !== "EMITIR_NFE") return jsonResponse({ error: "este faturamento nao solicitou nota fiscal" }, 400);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: hasPermission } = await userClient.rpc("oris360_has_permission", {
    p_company_id: billing.company_id,
    p_permission_key: "billing.invoice_order",
  });
  if (!hasPermission) return jsonResponse({ error: "sem permissao para emitir nota fiscal" }, 403);

  const { data: fiscalDoc } = await serviceClient
    .from("fiscal_documents")
    .select("id, status, external_id")
    .eq("billing_id", billingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!fiscalDoc) return jsonResponse({ error: "registro fiscal nao encontrado para este faturamento" }, 404);
  if (fiscalDoc.status === "AUTORIZADA") return jsonResponse({ ok: true, status: "AUTORIZADA", external_id: fiscalDoc.external_id });
  if (fiscalDoc.status === "PROCESSANDO") {
    return jsonResponse({ error: "emissao em andamento ou com resultado incerto — conferir no painel Asaas antes de reemitir" }, 409);
  }

  const { data: order } = await serviceClient
    .from("orders")
    .select("id, order_number, total_amount")
    .eq("id", billing.order_id)
    .maybeSingle();
  if (!order) return jsonResponse({ error: "pedido nao encontrado" }, 404);

  const { data: customer } = await serviceClient
    .from("customers")
    .select("id, name, company_name, cnpj, email, phone, address, cep, asaas_customer_id")
    .eq("id", billing.customer_id)
    .maybeSingle();
  if (!customer) return jsonResponse({ error: "cliente nao encontrado" }, 404);
  if (!customer.asaas_customer_id) {
    await markFailure(fiscalDoc.id, billing.company_id, "Cliente ainda nao possui cadastro no Asaas — gere uma cobranca Asaas para este pedido antes de emitir a nota");
    return jsonResponse({ error: "cliente sem cadastro Asaas — gere uma cobranca primeiro" }, 400);
  }

  const { data: credential } = await serviceClient
    .from("company_integration_credentials")
    .select("id, environment, vault_secret_id, status")
    .eq("company_id", billing.company_id)
    .eq("provider", "ASAAS")
    .eq("is_active", true)
    .eq("status", "VALIDADO")
    .maybeSingle();
  if (!credential) {
    await markFailure(fiscalDoc.id, billing.company_id, "Nenhum ambiente Asaas ativo e validado para esta empresa");
    return jsonResponse({ error: "integracao Asaas nao ativa — ative um ambiente validado na Central de Integrações" }, 400);
  }

  const { data: apiKey } = await serviceClient.rpc("read_vault_secret", { p_secret_id: credential.vault_secret_id });
  if (!apiKey) {
    await markFailure(fiscalDoc.id, billing.company_id, "Nao foi possivel ler a credencial Asaas");
    return jsonResponse({ error: "credencial invalida" }, 400);
  }

  const baseUrl = asaasBaseUrl(credential.environment);
  await serviceClient.from("fiscal_documents").update({ status: "PROCESSANDO", provider: "ASAAS" }).eq("id", fiscalDoc.id);

  try {
    // NOTA: municipalServiceId/municipalServiceCode costumam ser obrigatórios e dependem da
    // configuração municipal feita no painel Asaas da própria empresa (cadastro de serviço prestado).
    // Sem esse cadastro a API retorna erro — o erro real fica salvo em fiscal_documents para o admin
    // corrigir pelo painel Asaas, em vez de o sistema adivinhar um código de serviço.
    const invoiceRes = await fetch(`${baseUrl}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: apiKey },
      body: JSON.stringify({
        customer: customer.asaas_customer_id,
        serviceDescription: `Pedido #${order.order_number}`,
        observations: `Faturamento ${billing.id} — Óris 360`,
        value: order.total_amount,
        deductions: 0,
        effectiveDate: new Date().toISOString().slice(0, 10),
        externalReference: billing.id,
      }),
    });
    const invoiceData = await invoiceRes.json();

    if (!invoiceRes.ok) {
      const message = invoiceData?.errors?.[0]?.description ?? `Erro HTTP ${invoiceRes.status} ao emitir nota fiscal`;
      await markFailure(fiscalDoc.id, billing.company_id, message);
      return jsonResponse({ error: message }, 502);
    }

    await serviceClient
      .from("fiscal_documents")
      .update({
        external_id: invoiceData.id,
        status: "PROCESSANDO",
        number: invoiceData.rpsNumber ?? invoiceData.number ?? null,
        pdf_ref: invoiceData.pdfUrl ?? null,
        xml_ref: invoiceData.xmlUrl ?? null,
      })
      .eq("id", fiscalDoc.id);

    return jsonResponse({ ok: true, status: "PROCESSANDO", external_id: invoiceData.id });
  } catch (err) {
    await serviceClient.from("audit_events").insert({
      event_type: "fiscal_document.emission_uncertain",
      company_id: billing.company_id,
      actor_type: "system",
      entity_type: "fiscal_document",
      entity_id: fiscalDoc.id,
      payload: { message: err instanceof Error ? err.message : "Erro desconhecido ao chamar o Asaas" },
    });
    return jsonResponse({ error: "falha de comunicacao com o Asaas — conferir no painel Asaas antes de reemitir" }, 502);
  }
});
