// Gestão de usuários por empresa (IAM) — convite, revogação e troca de papel.
// Usa a Auth Admin API (exige service role) para criar/convidar o usuário no auth.users.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function resolveCallerCompany(authHeader: string) {
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData } = await callerClient.auth.getUser();
  if (!userData?.user) return null;

  const { data: membership } = await serviceClient
    .from("memberships")
    .select("company_id")
    .eq("user_id", userData.user.id)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  return { callerClient, companyId: membership.company_id as string };
}

async function handleInvite(req: Request, body: Record<string, unknown>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "não autenticado" }, 401);

  const email = (body.email as string)?.trim().toLowerCase();
  const roleId = body.role_id as string;

  if (!email || !roleId) return jsonResponse({ error: "email e role_id são obrigatórios" }, 400);

  const resolved = await resolveCallerCompany(authHeader);
  if (!resolved) return jsonResponse({ error: "sem empresa ativa" }, 403);
  const { callerClient, companyId } = resolved;

  const { data: allowed } = await callerClient.rpc("oris360_has_permission", {
    p_company_id: companyId,
    p_permission_key: "iam.memberships.manage",
  });
  if (!allowed) return jsonResponse({ error: "sem permissão" }, 403);

  const { data: role } = await serviceClient
    .from("roles")
    .select("id")
    .eq("id", roleId)
    .eq("company_id", companyId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (!role) return jsonResponse({ error: "papel inválido para esta empresa" }, 400);

  const { data: invite, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email);
  if (inviteError || !invite?.user) {
    return jsonResponse({ error: inviteError?.message ?? "não foi possível convidar este e-mail" }, 400);
  }

  const { data: membership, error: membershipError } = await serviceClient
    .from("memberships")
    .insert({ company_id: companyId, user_id: invite.user.id, status: "INVITED" })
    .select("id")
    .single();

  if (membershipError) return jsonResponse({ error: membershipError.message }, 400);

  const { error: roleError } = await serviceClient
    .from("membership_roles")
    .insert({ company_id: companyId, membership_id: membership.id, role_id: roleId });

  if (roleError) return jsonResponse({ error: roleError.message }, 400);

  return jsonResponse({ ok: true, membership_id: membership.id });
}

async function handleRevoke(req: Request, body: Record<string, unknown>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "não autenticado" }, 401);

  const membershipId = body.membership_id as string;
  if (!membershipId) return jsonResponse({ error: "membership_id é obrigatório" }, 400);

  const resolved = await resolveCallerCompany(authHeader);
  if (!resolved) return jsonResponse({ error: "sem empresa ativa" }, 403);
  const { callerClient, companyId } = resolved;

  const { data: allowed } = await callerClient.rpc("oris360_has_permission", {
    p_company_id: companyId,
    p_permission_key: "iam.memberships.manage",
  });
  if (!allowed) return jsonResponse({ error: "sem permissão" }, 403);

  const { error } = await serviceClient
    .from("memberships")
    .update({ status: "ENDED", ends_at: new Date().toISOString() })
    .eq("id", membershipId)
    .eq("company_id", companyId);

  if (error) return jsonResponse({ error: error.message }, 400);

  return jsonResponse({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "método não suportado" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "corpo inválido" }, 400);
  }

  switch (body.action) {
    case "invite":
      return handleInvite(req, body);
    case "revoke":
      return handleRevoke(req, body);
    default:
      return jsonResponse({ error: "ação desconhecida" }, 400);
  }
});
