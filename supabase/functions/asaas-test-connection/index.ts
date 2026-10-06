// Testa a credencial Asaas salva (GET /finance/balance) sem expor a API key ao frontend.
// So atualiza last_validated_at/last_error — nao cria dashboard nenhum (patch secao 10).

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

  const credentialId = body.credential_id as string;
  if (!credentialId) return jsonResponse({ error: "credential_id obrigatorio" }, 400);

  const { data: credential } = await serviceClient
    .from("company_integration_credentials")
    .select("id, company_id, environment, vault_secret_id, provider")
    .eq("id", credentialId)
    .maybeSingle();
  if (!credential || credential.provider !== "ASAAS") return jsonResponse({ error: "credencial nao encontrada" }, 404);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: hasPermission } = await userClient.rpc("oris360_has_permission", {
    p_company_id: credential.company_id,
    p_permission_key: "financeiro.integracoes.manage",
  });
  if (!hasPermission) return jsonResponse({ error: "sem permissao" }, 403);

  const { data: apiKey } = await serviceClient.rpc("read_vault_secret", { p_secret_id: credential.vault_secret_id });
  if (!apiKey) return jsonResponse({ error: "credencial invalida" }, 400);

  const now = new Date().toISOString();
  const credentialsTable = serviceClient.from("company_integration_credentials");

  try {
    const res = await fetch(`${asaasBaseUrl(credential.environment)}/finance/balance`, {
      headers: { access_token: apiKey as string },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      await credentialsTable.update({ status: "VALIDADO", last_validated_at: now, last_error: null }).eq("id", credentialId);
      return jsonResponse({ ok: true, balance: data.balance });
    }

    const providerMessage = data?.errors?.[0]?.description ?? `Erro HTTP ${res.status}`;

    // 401/403: o Asaas recusou a chave. Ela deixa de valer e o ambiente sai do ar até nova validação.
    if (res.status === 401 || res.status === 403) {
      await credentialsTable
        .update({ status: "ERRO", is_active: false, activated_at: null, last_validated_at: now, last_error: providerMessage.slice(0, 300) })
        .eq("id", credentialId);
      return jsonResponse({ ok: false, kind: "CREDENTIAL", error: "A credencial não foi aceita pelo Asaas. Gere uma nova chave e teste novamente." });
    }

    // Demais erros (5xx, 429...) são instabilidade do provedor: a credencial anterior continua válida.
    await credentialsTable.update({ last_error: `Instabilidade temporária: ${providerMessage}`.slice(0, 300) }).eq("id", credentialId);
    return jsonResponse({ ok: false, kind: "CONNECTION", error: "Não foi possível conectar ao Asaas neste momento. Tente novamente em instantes." });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "falha de comunicacao";
    await credentialsTable.update({ last_error: `Instabilidade temporária: ${detail}`.slice(0, 300) }).eq("id", credentialId);
    return jsonResponse({ ok: false, kind: "CONNECTION", error: "Não foi possível conectar ao Asaas neste momento. Tente novamente em instantes." });
  }
});
