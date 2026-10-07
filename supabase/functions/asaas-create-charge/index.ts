// Camada Mestre Asaas — unico lugar do sistema que fala com a API do Asaas pra criar cobranca.
// Despesas, Faturar e qualquer outro modulo nao chamam o Asaas direto (patch secao 2).
// Idempotencia: se o charge ja tem external_id, nao reenvia (patch secao 5).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAsaasFeeFields, hasValidDocument, type AsaasFeeConfig } from "../_shared/asaas-billing.ts";

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
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function asaasBaseUrl(environment: string) {
  return environment === "PRODUCAO" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

const BILLING_TYPE_BY_METHOD: Record<string, "PIX" | "BOLETO"> = { PIX: "PIX", BOLETO: "BOLETO" };

async function markFailure(chargeId: string, technicalState: string, message: string) {
  await serviceClient.from("charges").update({ technical_state: technicalState, last_error: message.slice(0, 300) }).eq("id", chargeId);
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

  const chargeId = body.charge_id as string;
  if (!chargeId) return jsonResponse({ error: "charge_id obrigatorio" }, 400);

  const { data: charge } = await serviceClient
    .from("charges")
    .select("id, installment_id, external_id, technical_state, provider")
    .eq("id", chargeId)
    .maybeSingle();
  if (!charge) return jsonResponse({ error: "cobranca nao encontrada" }, 404);

  const { data: installment } = await serviceClient
    .from("installments")
    .select("id, due_date, amount, payment_method_id")
    .eq("id", charge.installment_id)
    .maybeSingle();
  if (!installment) return jsonResponse({ error: "parcela nao encontrada" }, 404);

  const { data: paymentMethod } = await serviceClient
    .from("payment_methods")
    .select("id, type, billing_id, fees")
    .eq("id", installment.payment_method_id)
    .maybeSingle();
  if (!paymentMethod) return jsonResponse({ error: "forma de pagamento nao encontrada" }, 404);

  const { data: billing } = await serviceClient.from("billings").select("id, order_id, customer_id").eq("id", paymentMethod.billing_id).maybeSingle();
  if (!billing) return jsonResponse({ error: "faturamento nao encontrado" }, 404);

  const { data: order } = await serviceClient.from("orders").select("company_id").eq("id", billing.order_id).maybeSingle();
  if (!order) return jsonResponse({ error: "pedido nao encontrado" }, 404);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: hasPermission } = await userClient.rpc("oris360_has_permission", {
    p_company_id: order.company_id,
    p_permission_key: "billing.invoice_order",
  });
  if (!hasPermission) return jsonResponse({ error: "sem permissao para gerar cobranca" }, 403);
  if (charge.external_id) return jsonResponse({ ok: true, external_id: charge.external_id, technical_state: charge.technical_state });

  const billingType = BILLING_TYPE_BY_METHOD[paymentMethod.type as string];
  if (!billingType) return jsonResponse({ error: `forma de pagamento ${paymentMethod.type} nao suportada pela integracao Asaas` }, 400);

  // Juros/multa/desconto já vêm configurados em payment_methods.fees (Faturar). Mapeia aqui pros
  // nomes exatos da Asaas (discount/interest/fine) — nenhum fallback silencioso: configuração
  // fora do esperado derruba a cobrança com erro controlado, antes de qualquer chamada à Asaas.
  let feeFields: ReturnType<typeof buildAsaasFeeFields>;
  try {
    feeFields = buildAsaasFeeFields(paymentMethod.fees as AsaasFeeConfig | null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "configuracao de juros/multa/desconto invalida";
    await markFailure(chargeId, "FALHA_DEFINITIVA", `Configuração de cobrança inválida: ${message}`);
    return jsonResponse({ error: "configuracao de juros/multa/desconto invalida" }, 400);
  }

  const { data: customer } = await serviceClient
    .from("customers")
    .select("id, name, company_name, cnpj, email, phone, address, cep, city, state, asaas_customer_id")
    .eq("id", billing.customer_id)
    .maybeSingle();
  if (!customer) return jsonResponse({ error: "cliente nao encontrado" }, 404);

  // A Asaas exige name + cpfCnpj pra criar cliente (não tem exceção por boleto/Pix). Sem isso,
  // a chamada falharia lá e o erro só apareceria depois — aqui bloqueia antes, com mensagem clara.
  if (!customer.asaas_customer_id && !hasValidDocument(customer.cnpj)) {
    await markFailure(chargeId, "FALHA_DEFINITIVA", "Cliente sem CPF/CNPJ válido cadastrado");
    return jsonResponse({ error: "O cliente precisa ter CPF/CNPJ válido cadastrado para gerar esta cobrança." }, 400);
  }

  const { data: credential } = await serviceClient
    .from("company_integration_credentials")
    .select("id, environment, vault_secret_id, status")
    .eq("company_id", order.company_id)
    .eq("provider", "ASAAS")
    .eq("is_active", true)
    .eq("status", "VALIDADO")
    .maybeSingle();

  if (!credential) {
    await markFailure(chargeId, "FALHA_DEFINITIVA", "Nenhum ambiente Asaas ativo e validado para esta empresa");
    return jsonResponse({ error: "integracao Asaas nao ativa — ative um ambiente validado na Central de Integrações" }, 400);
  }

  const { data: apiKey } = await serviceClient.rpc("read_vault_secret", { p_secret_id: credential.vault_secret_id });
  if (!apiKey) {
    await markFailure(chargeId, "FALHA_DEFINITIVA", "Nao foi possivel ler a credencial Asaas");
    return jsonResponse({ error: "credencial invalida" }, 400);
  }
  const baseUrl = asaasBaseUrl(credential.environment);
  const { data: claimed } = await serviceClient
    .from("charges")
    .update({ technical_state: "ENVIANDO" })
    .eq("id", chargeId)
    .is("external_id", null)
    .neq("technical_state", "ENVIANDO")
    .select("id")
    .maybeSingle();
  if (!claimed) return jsonResponse({ error: "cobranca ja esta sendo processada" }, 409);

  try {
    let asaasCustomerId = customer.asaas_customer_id;
    if (!asaasCustomerId) {
      const custRes = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: apiKey },
        body: JSON.stringify({
          name: customer.company_name || customer.name,
          cpfCnpj: customer.cnpj || undefined,
          email: customer.email || undefined,
          phone: customer.phone || undefined,
          postalCode: customer.cep || undefined,
          address: customer.address || undefined,
        }),
      });
      const custData = await custRes.json();
      if (!custRes.ok) {
        await markFailure(chargeId, custRes.status >= 500 ? "FALHA_TEMPORARIA" : "FALHA_DEFINITIVA", custData?.errors?.[0]?.description ?? "Falha ao criar cliente no Asaas");
        return jsonResponse({ error: "falha ao criar cliente no Asaas" }, 502);
      }
      asaasCustomerId = custData.id;
      await serviceClient.from("customers").update({ asaas_customer_id: asaasCustomerId }).eq("id", customer.id);
    }

    const existingRes = await fetch(`${baseUrl}/payments?externalReference=${encodeURIComponent(charge.id)}`, {
      headers: { access_token: apiKey },
    });
    const existingData = existingRes.ok ? await existingRes.json() : null;
    let payData = existingData?.data?.[0];

    if (!payData) {
      const payRes = await fetch(`${baseUrl}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: apiKey },
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType,
          value: installment.amount,
          dueDate: installment.due_date,
          externalReference: charge.id,
          ...feeFields,
        }),
      });
      payData = await payRes.json();
      if (!payRes.ok) {
        await markFailure(chargeId, payRes.status >= 500 ? "FALHA_TEMPORARIA" : "FALHA_DEFINITIVA", payData?.errors?.[0]?.description ?? "Falha ao criar cobranca no Asaas");
        return jsonResponse({ error: "falha ao criar cobranca no Asaas" }, 502);
      }
    }

    await serviceClient
      .from("charges")
      .update({
        external_id: payData.id,
        technical_state: "AGUARDANDO_EVENTO",
        last_error: null,
        invoice_url: payData.invoiceUrl ?? null,
        bank_slip_url: payData.bankSlipUrl ?? null,
      })
      .eq("id", chargeId);

    return jsonResponse({ ok: true, external_id: payData.id, technical_state: "AGUARDANDO_EVENTO" });
  } catch (err) {
    await markFailure(chargeId, "FALHA_TEMPORARIA", err instanceof Error ? err.message : "Erro desconhecido ao chamar o Asaas");
    return jsonResponse({ error: "falha de comunicacao com o Asaas" }, 502);
  }
});
