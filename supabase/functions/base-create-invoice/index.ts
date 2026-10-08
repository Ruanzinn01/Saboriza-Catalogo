// Emissão de NF-e de PRODUTO via Base ERP (Base by Asaas, docs.baseerp.com.br) — provider BASE,
// separado do provider ASAAS que só cobre pagamento e NFS-e. Fluxo documentado: cliente -> produto
// -> pedido de venda -> POST /salesOrders/{id}/invoice. É assíncrono: a resposta imediata só confirma
// que a Sefaz recebeu (invoiceStatus inicial "GRAVADA"); o resultado real (autorizada/rejeitada, com
// pdfUrl/xmlUrl) chega depois pelo base-webhook.
//
// Campos fiscais do produto confirmados na documentação oficial: name/code/ncm/unit (obrigatórios) +
// cClassTrib (opcional). CFOP/CST/CSOSN/ICMS/IPI/PIS/COFINS NÃO existem como campo de API — ficam
// 100% na configuração fiscal da empresa, dentro do painel do Base. Não inventamos esses campos aqui.
//
// Chave de acesso e protocolo de autorização NÃO aparecem em nenhum endpoint nem payload de webhook
// documentado publicamente — fiscal_documents.key fica sempre null para este provider.

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

function baseUrl(environment: string) {
  return environment === "PRODUCAO" ? "https://api.baseerp.com.br/api/v1" : "https://api-sandbox.baseerp.com.br/api/v1";
}

// Mesmo algoritmo de src/lib/cpf.ts e src/lib/cnpj.ts — Edge Function (Deno) não importa de src/.
function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}
function isValidCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(d[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}
function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  function checkDigit(base: string): number {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.split("").reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  }
  const firstCheck = checkDigit(digits.slice(0, 12));
  const secondCheck = checkDigit(digits.slice(0, 12) + firstCheck);
  return digits === digits.slice(0, 12) + String(firstCheck) + String(secondCheck);
}
function hasValidDocument(value: string | null | undefined): boolean {
  if (!value) return false;
  const digits = onlyDigits(value);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
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
  if (billing.fiscal_choice !== "EMITIR_NFE_PRODUTO") return jsonResponse({ error: "este faturamento nao solicitou NF-e de produto" }, 400);

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
    return jsonResponse({ error: "emissao em andamento ou com resultado incerto — conferir no painel Base antes de reemitir" }, 409);
  }

  const { data: order } = await serviceClient.from("orders").select("id, order_number").eq("id", billing.order_id).maybeSingle();
  if (!order) return jsonResponse({ error: "pedido nao encontrado" }, 404);

  const { data: orderItems } = await serviceClient
    .from("order_items")
    .select("product_id, total_units, unit_price")
    .eq("order_id", billing.order_id);
  if (!orderItems || orderItems.length === 0) {
    await markFailure(fiscalDoc.id, billing.company_id, "Pedido sem itens — nao e possivel montar o pedido de venda no Base");
    return jsonResponse({ error: "pedido sem itens" }, 400);
  }

  const { data: customer } = await serviceClient
    .from("customers")
    .select("id, name, company_name, cnpj, email, phone, address, cep, city, state, ie, base_customer_id")
    .eq("id", billing.customer_id)
    .maybeSingle();
  if (!customer) return jsonResponse({ error: "cliente nao encontrado" }, 404);
  if (!customer.base_customer_id && !hasValidDocument(customer.cnpj)) {
    await markFailure(fiscalDoc.id, billing.company_id, "Cliente sem CPF/CNPJ valido cadastrado");
    return jsonResponse({ error: "O cliente precisa ter CPF/CNPJ válido cadastrado para emitir esta NF-e." }, 400);
  }

  const productIds = [...new Set(orderItems.map((i) => i.product_id as string))];
  const { data: products } = await serviceClient
    .from("products")
    .select("id, name, code, ncm, sale_unit, gtin, base_product_id")
    .in("id", productIds);
  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  for (const id of productIds) {
    const p = productById.get(id);
    if (!p) {
      await markFailure(fiscalDoc.id, billing.company_id, `Produto ${id} nao encontrado`);
      return jsonResponse({ error: "produto do pedido nao encontrado" }, 404);
    }
    if (!p.base_product_id) {
      if (!p.ncm) {
        await markFailure(fiscalDoc.id, billing.company_id, `Produto "${p.name}" sem NCM cadastrado`);
        return jsonResponse({ error: `O produto "${p.name}" precisa ter NCM cadastrado para emitir NF-e.` }, 400);
      }
      if (!p.sale_unit) {
        await markFailure(fiscalDoc.id, billing.company_id, `Produto "${p.name}" sem unidade de venda cadastrada`);
        return jsonResponse({ error: `O produto "${p.name}" precisa ter a unidade de venda (ex: UN, CX, KG) cadastrada para emitir NF-e.` }, 400);
      }
    }
  }

  const { data: credential } = await serviceClient
    .from("company_integration_credentials")
    .select("id, environment, vault_secret_id, status")
    .eq("company_id", billing.company_id)
    .eq("provider", "BASE")
    .eq("is_active", true)
    .eq("status", "VALIDADO")
    .maybeSingle();
  if (!credential) {
    await markFailure(fiscalDoc.id, billing.company_id, "Nenhum ambiente Base ativo e validado para esta empresa");
    return jsonResponse({ error: "integracao Base nao ativa — ative um ambiente validado na Central de Integrações" }, 400);
  }

  const { data: apiKey } = await serviceClient.rpc("read_vault_secret", { p_secret_id: credential.vault_secret_id });
  if (!apiKey) {
    await markFailure(fiscalDoc.id, billing.company_id, "Nao foi possivel ler a credencial Base");
    return jsonResponse({ error: "credencial invalida" }, 400);
  }

  const url = baseUrl(credential.environment);
  const headers = { "Content-Type": "application/json", access_token: apiKey as string };

  await serviceClient.from("fiscal_documents").update({ status: "PROCESSANDO", provider: "BASE" }).eq("id", fiscalDoc.id);

  try {
    // 1. Cliente no Base
    let baseCustomerId = customer.base_customer_id as string | null;
    if (!baseCustomerId) {
      const custRes = await fetch(`${url}/customers`, {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": `customer-${customer.id}` },
        body: JSON.stringify({
          name: customer.company_name || customer.name,
          cpfCnpj: onlyDigits(customer.cnpj as string),
          email: customer.email || undefined,
          phone: customer.phone || undefined,
          billingAddress: {
            postalCode: customer.cep ? onlyDigits(customer.cep) : undefined,
            address: customer.address || undefined,
            cityName: customer.city || undefined,
            stateAbbrev: customer.state || undefined,
          },
          taxInformation: customer.ie ? { stateInscription: customer.ie } : undefined,
        }),
      });
      const custData = await custRes.json();
      if (!custRes.ok) {
        await markFailure(fiscalDoc.id, billing.company_id, custData?.message ?? `Falha ao criar cliente no Base (HTTP ${custRes.status})`);
        return jsonResponse({ error: "falha ao criar cliente no Base" }, 502);
      }
      baseCustomerId = String(custData.id);
      await serviceClient.from("customers").update({ base_customer_id: baseCustomerId }).eq("id", customer.id);
    }

    // 2. Produtos no Base (um por vez, reaproveitando os já sincronizados)
    const baseProductIdByLocalId = new Map<string, string>();
    for (const localId of productIds) {
      const p = productById.get(localId)!;
      if (p.base_product_id) {
        baseProductIdByLocalId.set(localId, p.base_product_id);
        continue;
      }
      const item = orderItems.find((i) => i.product_id === localId)!;
      const prodRes = await fetch(`${url}/products`, {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": `product-${p.id}` },
        body: JSON.stringify({
          name: p.name,
          code: p.code || p.id,
          ncm: p.ncm,
          unit: p.sale_unit,
          barcode: p.gtin || undefined,
          salePrice: item.unit_price,
        }),
      });
      const prodData = await prodRes.json();
      if (!prodRes.ok) {
        await markFailure(fiscalDoc.id, billing.company_id, prodData?.message ?? `Falha ao criar produto "${p.name}" no Base (HTTP ${prodRes.status})`);
        return jsonResponse({ error: `falha ao criar produto "${p.name}" no Base` }, 502);
      }
      const baseProductId = String(prodData.id);
      await serviceClient.from("products").update({ base_product_id: baseProductId }).eq("id", p.id);
      baseProductIdByLocalId.set(localId, baseProductId);
    }

    // 3. Pedido de venda
    const soRes = await fetch(`${url}/salesOrders`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": `salesorder-${fiscalDoc.id}` },
      body: JSON.stringify({
        customerId: Number(baseCustomerId),
        issueDate: new Date().toISOString().slice(0, 10),
        externalReference: billing.id,
        orderItems: orderItems.map((i) => ({
          productId: Number(baseProductIdByLocalId.get(i.product_id as string)),
          quantity: i.total_units,
          unitPrice: i.unit_price,
        })),
      }),
    });
    const soData = await soRes.json();
    if (!soRes.ok) {
      await markFailure(fiscalDoc.id, billing.company_id, soData?.message ?? `Falha ao criar pedido de venda no Base (HTTP ${soRes.status})`);
      return jsonResponse({ error: "falha ao criar pedido de venda no Base" }, 502);
    }
    const salesOrderId = soData.id;

    // 4. Emissão da NF-e — assíncrona. invoiceStatus inicial não é o resultado final.
    const invRes = await fetch(`${url}/salesOrders/${salesOrderId}/invoice`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": `invoice-${fiscalDoc.id}` },
      body: JSON.stringify({}),
    });
    const invData = await invRes.json();
    if (!invRes.ok) {
      await markFailure(fiscalDoc.id, billing.company_id, invData?.message ?? `Falha ao emitir NF-e no Base (HTTP ${invRes.status})`);
      return jsonResponse({ error: "falha ao emitir NF-e no Base" }, 502);
    }

    await serviceClient
      .from("fiscal_documents")
      .update({ external_id: String(invData.invoiceId), status: "PROCESSANDO", number: invData.invoiceNumber != null ? String(invData.invoiceNumber) : null, provider: "BASE" })
      .eq("id", fiscalDoc.id);

    return jsonResponse({ ok: true, status: "PROCESSANDO", external_id: String(invData.invoiceId) });
  } catch (err) {
    await serviceClient.from("audit_events").insert({
      event_type: "fiscal_document.emission_uncertain",
      company_id: billing.company_id,
      actor_type: "system",
      entity_type: "fiscal_document",
      entity_id: fiscalDoc.id,
      payload: { message: err instanceof Error ? err.message : "Erro desconhecido ao chamar o Base" },
    });
    return jsonResponse({ error: "falha de comunicacao com o Base — conferir no painel Base antes de reemitir" }, 502);
  }
});
