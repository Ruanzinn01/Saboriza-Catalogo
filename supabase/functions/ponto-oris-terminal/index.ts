// Ponto Óris — Terminal de Batida Online (V2)
// Regra inegociável: nenhuma batida é mostrada como concluída antes da confirmação do servidor.
// company_id/unit_id nunca vêm do payload — são resolvidos aqui a partir do dispositivo autorizado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const PUNCH_TYPES = ["ENTRADA", "INTERVALO", "RETORNO", "SAIDA"] as const;

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

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function resolveDevice(deviceId: string, deviceCredential: string) {
  const { data: device, error } = await serviceClient
    .from("time_devices")
    .select("id, company_id, unit_id, credential_hash, revoked_at")
    .eq("id", deviceId)
    .maybeSingle();

  if (error || !device || device.revoked_at) return null;

  const credentialHash = await sha256Hex(deviceCredential);
  if (credentialHash !== device.credential_hash) return null;

  return device;
}

// Ação administrativa: cadastra dispositivo e devolve a credencial em texto puro
// UMA ÚNICA VEZ (o hash é o que fica salvo). Requer permissão timesheet.devices.manage.
async function handleRegisterDevice(req: Request, body: Record<string, unknown>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "não autenticado" }, 401);

  const label = body.label as string;
  const unitId = (body.unit_id as string | undefined) ?? null;

  if (!label) return jsonResponse({ error: "label é obrigatório" }, 400);

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  // company_id nunca vem do payload — resolvido a partir da membership ativa de quem chama.
  const { data: userData } = await callerClient.auth.getUser();
  if (!userData?.user) return jsonResponse({ error: "não autenticado" }, 401);

  const { data: membership } = await serviceClient
    .from("memberships")
    .select("company_id")
    .eq("user_id", userData.user.id)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return jsonResponse({ error: "sem empresa ativa" }, 403);
  const companyId = membership.company_id;

  const { data: allowed } = await callerClient.rpc("oris360_has_permission", {
    p_company_id: companyId,
    p_permission_key: "timesheet.devices.manage",
  });

  if (!allowed) return jsonResponse({ error: "sem permissão" }, 403);

  const credential = crypto.randomUUID() + crypto.randomUUID();
  const credentialHash = await sha256Hex(credential);

  const { data: device, error } = await serviceClient
    .from("time_devices")
    .insert({ company_id: companyId, unit_id: unitId, label, credential_hash: credentialHash })
    .select("id")
    .single();

  if (error) return jsonResponse({ error: error.message }, 400);

  // A credencial só existe em texto puro nesta resposta — não é persistida em lugar nenhum.
  return jsonResponse({ device_id: device.id, device_credential: credential });
}

// Ação administrativa: define/redefine o PIN do ponto de um colaborador.
async function handleSetEmployeePin(req: Request, body: Record<string, unknown>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "não autenticado" }, 401);

  const employeeId = body.employee_id as string;
  const pin = body.pin as string;

  if (!employeeId || !pin || pin.length < 4) {
    return jsonResponse({ error: "employee_id e pin (mín. 4 dígitos) são obrigatórios" }, 400);
  }

  const { data: employee } = await serviceClient
    .from("employees")
    .select("id, company_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (!employee) return jsonResponse({ error: "colaborador não encontrado" }, 404);

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: allowed } = await callerClient.rpc("oris360_has_permission", {
    p_company_id: employee.company_id,
    p_permission_key: "timesheet.apuracao.manage",
  });

  if (!allowed) return jsonResponse({ error: "sem permissão" }, 403);

  const pinHash = await sha256Hex(pin);
  const { error } = await serviceClient
    .from("employees")
    .update({ timesheet_pin_hash: pinHash })
    .eq("id", employeeId);

  if (error) return jsonResponse({ error: error.message }, 400);

  return jsonResponse({ ok: true });
}

// Tela de Matrícula: resolve matrícula -> employee_id + primeiro nome, dentro do escopo do dispositivo.
async function handleIdentify(body: Record<string, unknown>) {
  const deviceId = body.device_id as string;
  const deviceCredential = body.device_credential as string;
  const employeeCode = body.employee_code as string;

  if (!deviceId || !deviceCredential || !employeeCode) {
    return jsonResponse({ error: "dispositivo e matrícula são obrigatórios" }, 400);
  }

  const device = await resolveDevice(deviceId, deviceCredential);
  if (!device) return jsonResponse({ error: "dispositivo inválido ou revogado" }, 401);

  let query = serviceClient
    .from("employees")
    .select("id, name, timesheet_pin_hash")
    .eq("company_id", device.company_id)
    .eq("code", employeeCode)
    .eq("status", "ATIVO");

  if (device.unit_id) query = query.eq("unit_id", device.unit_id);

  const { data: employee } = await query.maybeSingle();

  if (!employee || !employee.timesheet_pin_hash) {
    return jsonResponse({ error: "matrícula inválida" }, 404);
  }

  const firstName = employee.name.split(" ")[0];
  return jsonResponse({ employee_id: employee.id, first_name: firstName });
}

// Tela final: confirma a batida no servidor. Idempotente por idempotency_key.
async function handlePunch(body: Record<string, unknown>) {
  const deviceId = body.device_id as string;
  const deviceCredential = body.device_credential as string;
  const employeeId = body.employee_id as string;
  const pin = body.pin as string;
  const type = body.type as string;
  const photoBase64 = body.photo_base64 as string;
  const deviceReportedTime = body.device_reported_time as string | undefined;
  const idempotencyKey = body.idempotency_key as string;
  const location = (body.location as Record<string, unknown> | undefined) ?? null;

  if (!deviceId || !deviceCredential || !employeeId || !pin || !type || !photoBase64 || !idempotencyKey) {
    return jsonResponse({ error: "campos obrigatórios ausentes" }, 400);
  }

  if (!PUNCH_TYPES.includes(type as (typeof PUNCH_TYPES)[number])) {
    return jsonResponse({ error: "tipo de marcação inválido" }, 400);
  }

  const device = await resolveDevice(deviceId, deviceCredential);
  if (!device) return jsonResponse({ error: "dispositivo inválido ou revogado" }, 401);

  // Retry com a mesma chave: devolve a batida já confirmada, nunca duplica.
  const { data: existing } = await serviceClient
    .from("time_punches")
    .select("id, server_time, type")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing) {
    return jsonResponse({ punch_id: existing.id, server_time: existing.server_time, type: existing.type });
  }

  const { data: allowedAttempt } = await serviceClient.rpc("check_pin_rate_limit", { p_device_id: device.id });
  if (allowedAttempt === false) {
    return jsonResponse({ error: "muitas tentativas de PIN erradas — aguarde alguns minutos" }, 429);
  }

  const { data: employee } = await serviceClient
    .from("employees")
    .select("id, company_id, timesheet_pin_hash")
    .eq("id", employeeId)
    .eq("company_id", device.company_id)
    .maybeSingle();

  if (!employee || !employee.timesheet_pin_hash) {
    return jsonResponse({ error: "colaborador inválido" }, 404);
  }

  const pinHash = await sha256Hex(pin);
  if (pinHash !== employee.timesheet_pin_hash) {
    await serviceClient.rpc("record_pin_attempt", { p_device_id: device.id, p_employee_id: employee.id, p_success: false });
    return jsonResponse({ error: "PIN inválido" }, 401);
  }
  await serviceClient.rpc("record_pin_attempt", { p_device_id: device.id, p_employee_id: employee.id, p_success: true });

  const photoPath = `${employee.company_id}/ponto-oris/${employee.id}/${idempotencyKey}.jpg`;
  const { error: uploadError } = await serviceClient.storage
    .from("oris360-private")
    .upload(photoPath, base64ToBytes(photoBase64), { contentType: "image/jpeg" });

  if (uploadError) {
    return jsonResponse({ error: "falha ao salvar a foto — tente novamente" }, 502);
  }

  const { data: punch, error: insertError } = await serviceClient
    .from("time_punches")
    .insert({
      employee_id: employee.id,
      device_id: device.id,
      type,
      device_reported_time: deviceReportedTime ?? null,
      photo_path: photoPath,
      location,
      idempotency_key: idempotencyKey,
    })
    .select("id, server_time, type")
    .single();

  if (insertError) {
    // Corrida rara: outra requisição com a mesma chave venceu primeiro.
    const { data: race } = await serviceClient
      .from("time_punches")
      .select("id, server_time, type")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (race) return jsonResponse({ punch_id: race.id, server_time: race.server_time, type: race.type });
    return jsonResponse({ error: insertError.message }, 400);
  }

  return jsonResponse({ punch_id: punch.id, server_time: punch.server_time, type: punch.type });
}

// Gera URL assinada temporaria pra foto de evidencia de uma batida (bucket privado).
async function handleGetPhotoUrl(req: Request, body: Record<string, unknown>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "não autenticado" }, 401);

  const photoPath = body.photo_path as string;
  if (!photoPath) return jsonResponse({ error: "photo_path é obrigatório" }, 400);

  const companyId = photoPath.split("/")[0];

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: allowed } = await callerClient.rpc("oris360_has_permission", {
    p_company_id: companyId,
    p_permission_key: "timesheet.apuracao.read",
  });
  if (!allowed) return jsonResponse({ error: "sem permissão" }, 403);

  const { data, error } = await serviceClient.storage.from("oris360-private").createSignedUrl(photoPath, 300);
  if (error || !data) return jsonResponse({ error: "não foi possível gerar o link da foto" }, 400);

  return jsonResponse({ url: data.signedUrl });
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
    case "register-device":
      return handleRegisterDevice(req, body);
    case "set-employee-pin":
      return handleSetEmployeePin(req, body);
    case "identify":
      return handleIdentify(body);
    case "punch":
      return handlePunch(body);
    case "get-photo-url":
      return handleGetPhotoUrl(req, body);
    default:
      return jsonResponse({ error: "ação desconhecida" }, 400);
  }
});
