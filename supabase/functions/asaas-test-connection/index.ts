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
  return environment === "PRODUCAO" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
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

  try {
    const res = await fetch(`${asaasBaseUrl(credential.environment)}/finance/balance`, {
      headers: { access_token: apiKey as string },
    });
    const data = await res.json();

    if (!res.ok) {
      const message = data?.errors?.[0]?.description ?? `Erro HTTP ${res.status}`;
      await serviceClient.from("company_integration_credentials").update({ status: "ERRO", last_validated_at: new Date().toISOString(), last_error: message.slice(0, 300) }).eq("id", credentialId);
      return jsonResponse({ ok: false, error: message });
    }

    await serviceClient.from("company_integration_credentials").update({ status: "CONFIGURADO", last_validated_at: new Date().toISOString(), last_error: null }).eq("id", credentialId);
    return jsonResponse({ ok: true, balance: data.balance });
  } catch (err) {
    const message = err instanceof Error ? err.message : "falha de comunicacao com o Asaas";
    await serviceClient.from("company_integration_credentials").update({ status: "ERRO", last_validated_at: new Date().toISOString(), last_error: message.slice(0, 300) }).eq("id", credentialId);
    return jsonResponse({ ok: false, error: message });
  }
});
