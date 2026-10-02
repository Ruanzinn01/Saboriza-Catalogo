// Gestão de usuários por empresa (IAM) — convite, revogação e troca de papel.
// Usa a Auth Admin API (exige service role) para criar/convidar o usuário no auth.users.

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
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// Resolve a empresa do chamador. Se o front mandar company_id explicito (seletor de empresa),
// valida que o chamador e membership ACTIVE dessa empresa especifica. Sem company_id no corpo
// (chamadas antigas), cai no vinculo ACTIVE mais antigo, igual sempre foi.
async function resolveCallerCompany(authHeader: string, requestedCompanyId?: string | null) {
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData } = await callerClient.auth.getUser();
  if (!userData?.user) return null;

  let query = serviceClient
    .from("memberships")
    .select("company_id")
    .eq("user_id", userData.user.id)
    .eq("status", "ACTIVE");

  query = requestedCompanyId ? query.eq("company_id", requestedCompanyId) : query.order("created_at", { ascending: true });

  const { data: membership } = await query.limit(1).maybeSingle();

  if (!membership) return null;

  return { callerClient, companyId: membership.company_id as string };
}

async function handleInvite(req: Request, body: Record<string, unknown>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "não autenticado" }, 401);

  const email = (body.email as string)?.trim().toLowerCase();
  const roleId = body.role_id as string;

  if (!email || !roleId) return jsonResponse({ error: "email e role_id são obrigatórios" }, 400);

  const resolved = await resolveCallerCompany(authHeader, body.company_id as string | undefined);
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

  const resolved = await resolveCallerCompany(authHeader, body.company_id as string | undefined);
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

// Lista papeis da empresa (com as permissoes concedidas) + catalogo completo de permissoes disponiveis.
async function handleListRoles(req: Request, body: Record<string, unknown>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "não autenticado" }, 401);

  const resolved = await resolveCallerCompany(authHeader, body.company_id as string | undefined);
  if (!resolved) return jsonResponse({ error: "sem empresa ativa" }, 403);
  const { callerClient, companyId } = resolved;

  const { data: allowed } = await callerClient.rpc("oris360_has_permission", {
    p_company_id: companyId,
    p_permission_key: "iam.roles.read",
  });
  if (!allowed) return jsonResponse({ error: "sem permissão" }, 403);

  const [{ data: roles }, { data: rolePermissions }, { data: permissions }] = await Promise.all([
    serviceClient.from("roles").select("id, name, status").eq("company_id", companyId).eq("status", "ACTIVE"),
    serviceClient.from("role_permissions").select("role_id, permission_key").eq("company_id", companyId),
    serviceClient.from("permissions").select("key, name, description, sensitivity").order("key"),
  ]);

  const grantedByRole = new Map<string, string[]>();
  (rolePermissions ?? []).forEach((rp) => {
    const list = grantedByRole.get(rp.role_id) ?? [];
    list.push(rp.permission_key);
    grantedByRole.set(rp.role_id, list);
  });

  return jsonResponse({
    roles: (roles ?? []).map((r) => ({ id: r.id, name: r.name, permission_keys: grantedByRole.get(r.id) ?? [] })),
    permissions: permissions ?? [],
  });
}

// Cria um novo papel (vazio, sem permissoes) para a empresa.
async function handleCreateRole(req: Request, body: Record<string, unknown>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "não autenticado" }, 401);

  const name = (body.name as string)?.trim();
  if (!name) return jsonResponse({ error: "nome é obrigatório" }, 400);

  const resolved = await resolveCallerCompany(authHeader, body.company_id as string | undefined);
  if (!resolved) return jsonResponse({ error: "sem empresa ativa" }, 403);
  const { callerClient, companyId } = resolved;

  const { data: allowed } = await callerClient.rpc("oris360_has_permission", {
    p_company_id: companyId,
    p_permission_key: "iam.roles.manage",
  });
  if (!allowed) return jsonResponse({ error: "sem permissão" }, 403);

  const { data: role, error } = await serviceClient
    .from("roles")
    .insert({ company_id: companyId, name })
    .select("id")
    .single();

  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ ok: true, role_id: role.id });
}

// Substitui o conjunto de permissoes de um papel pelo enviado (checkboxes marcados = permission_keys).
async function handleUpdateRolePermissions(req: Request, body: Record<string, unknown>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "não autenticado" }, 401);

  const roleId = body.role_id as string;
  const permissionKeys = (body.permission_keys as string[]) ?? [];
  if (!roleId) return jsonResponse({ error: "role_id é obrigatório" }, 400);

  const resolved = await resolveCallerCompany(authHeader, body.company_id as string | undefined);
  if (!resolved) return jsonResponse({ error: "sem empresa ativa" }, 403);
  const { callerClient, companyId } = resolved;

  const { data: allowed } = await callerClient.rpc("oris360_has_permission", {
    p_company_id: companyId,
    p_permission_key: "iam.roles.manage",
  });
  if (!allowed) return jsonResponse({ error: "sem permissão" }, 403);

  const { data: role } = await serviceClient
    .from("roles")
    .select("id")
    .eq("id", roleId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!role) return jsonResponse({ error: "papel inválido para esta empresa" }, 400);

  const { error: deleteError } = await serviceClient.from("role_permissions").delete().eq("role_id", roleId).eq("company_id", companyId);
  if (deleteError) return jsonResponse({ error: deleteError.message }, 400);

  if (permissionKeys.length > 0) {
    const { error: insertError } = await serviceClient
      .from("role_permissions")
      .insert(permissionKeys.map((key) => ({ company_id: companyId, role_id: roleId, permission_key: key })));
    if (insertError) return jsonResponse({ error: insertError.message }, 400);
  }

  return jsonResponse({ ok: true });
}

// Troca o papel de um membro existente (remove os papeis atuais, atribui o novo).
async function handleUpdateMemberRole(req: Request, body: Record<string, unknown>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "não autenticado" }, 401);

  const membershipId = body.membership_id as string;
  const roleId = body.role_id as string;
  if (!membershipId || !roleId) return jsonResponse({ error: "membership_id e role_id são obrigatórios" }, 400);

  const resolved = await resolveCallerCompany(authHeader, body.company_id as string | undefined);
  if (!resolved) return jsonResponse({ error: "sem empresa ativa" }, 403);
  const { callerClient, companyId } = resolved;

  const { data: allowed } = await callerClient.rpc("oris360_has_permission", {
    p_company_id: companyId,
    p_permission_key: "iam.memberships.manage",
  });
  if (!allowed) return jsonResponse({ error: "sem permissão" }, 403);

  const { error: deleteError } = await serviceClient
    .from("membership_roles")
    .delete()
    .eq("membership_id", membershipId)
    .eq("company_id", companyId);
  if (deleteError) return jsonResponse({ error: deleteError.message }, 400);

  const { error: insertError } = await serviceClient
    .from("membership_roles")
    .insert({ company_id: companyId, membership_id: membershipId, role_id: roleId });
  if (insertError) return jsonResponse({ error: insertError.message }, 400);

  return jsonResponse({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
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
    case "list-roles":
      return handleListRoles(req, body);
    case "create-role":
      return handleCreateRole(req, body);
    case "update-role-permissions":
      return handleUpdateRolePermissions(req, body);
    case "update-member-role":
      return handleUpdateMemberRole(req, body);
    default:
      return jsonResponse({ error: "ação desconhecida" }, 400);
  }
});
