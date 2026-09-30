// Meu 360 V4 — sessao pessoal do colaborador, view nativa do Chao de Fabrica (sem iframe).
// Reaproveita o mesmo esquema de dispositivo pareado do Ponto Oris (time_devices) em vez de
// inventar uma nova superficie de autenticacao. PIN = mesmo timesheet_pin_hash do Ponto.
// Nenhuma escrita aqui usa RLS do usuario logado — o dispositivo pareado + PIN e a fronteira
// de confianca, exatamente como no terminal de ponto.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function resolveDevice(deviceId: string, deviceCredential: string) {
  const { data: device } = await serviceClient
    .from("time_devices")
    .select("id, company_id, unit_id, credential_hash, revoked_at")
    .eq("id", deviceId)
    .maybeSingle();
  if (!device || device.revoked_at) return null;
  const credentialHash = await sha256Hex(deviceCredential);
  if (credentialHash !== device.credential_hash) return null;
  return device;
}

async function resolveEmployee(companyId: string, employeeId: string, pin: string) {
  const { data: employee } = await serviceClient
    .from("employees")
    .select("id, name, company_id, status, can_operate_production, timesheet_pin_hash, meu360_enabled")
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!employee || employee.status !== "ATIVO" || !employee.meu360_enabled || !employee.timesheet_pin_hash) return null;

  const pinHash = await sha256Hex(pin);
  if (pinHash !== employee.timesheet_pin_hash) return null;

  return employee;
}

// Tela de matricula: resolve codigo -> employee_id + primeiro nome, no escopo do dispositivo.
async function handleIdentify(body: Record<string, unknown>) {
  const deviceId = body.device_id as string;
  const deviceCredential = body.device_credential as string;
  const employeeCode = body.employee_code as string;

  if (!deviceId || !deviceCredential || !employeeCode) {
    return jsonResponse({ error: "dispositivo e matricula sao obrigatorios" }, 400);
  }

  const device = await resolveDevice(deviceId, deviceCredential);
  if (!device) return jsonResponse({ error: "dispositivo invalido ou revogado" }, 401);

  let query = serviceClient
    .from("employees")
    .select("id, name, meu360_enabled, timesheet_pin_hash")
    .eq("company_id", device.company_id)
    .eq("code", employeeCode)
    .eq("status", "ATIVO");
  if (device.unit_id) query = query.eq("unit_id", device.unit_id);

  const { data: employee } = await query.maybeSingle();
  if (!employee || !employee.meu360_enabled || !employee.timesheet_pin_hash) {
    return jsonResponse({ error: "matricula invalida ou Meu 360 nao habilitado" }, 404);
  }

  return jsonResponse({ employee_id: employee.id, first_name: employee.name.split(" ")[0] });
}

// Sessao pessoal: lista o trabalho do Chao de Fabrica (disponivel + assumido por este colaborador).
async function handleSession(body: Record<string, unknown>) {
  const deviceId = body.device_id as string;
  const deviceCredential = body.device_credential as string;
  const employeeId = body.employee_id as string;
  const pin = body.pin as string;

  if (!deviceId || !deviceCredential || !employeeId || !pin) {
    return jsonResponse({ error: "campos obrigatorios ausentes" }, 400);
  }

  const device = await resolveDevice(deviceId, deviceCredential);
  if (!device) return jsonResponse({ error: "dispositivo invalido ou revogado" }, 401);

  const employee = await resolveEmployee(device.company_id, employeeId, pin);
  if (!employee || !employee.can_operate_production) return jsonResponse({ error: "PIN invalido ou colaborador sem producao" }, 401);

  const { data: executions } = await serviceClient
    .from("floor_executions")
    .select("id, product_id, status, target_quantity, operational_quantity, route_version_label, assumed_by_employee_id")
    .eq("company_id", device.company_id)
    .in("status", ["DISPONIVEL", "EM_ANDAMENTO", "PAUSADO"])
    .order("created_at", { ascending: false });

  const { data: products } = await serviceClient.from("products").select("id, name").eq("company_id", device.company_id);

  return jsonResponse({
    employee_name: employee.name,
    executions: executions ?? [],
    products: products ?? [],
  });
}

// Acoes do Chao de Fabrica em nome do colaborador ja identificado (PIN validado a cada acao
// critica — mesma politica de seguranca do ponto).
async function handleAction(body: Record<string, unknown>) {
  const deviceId = body.device_id as string;
  const deviceCredential = body.device_credential as string;
  const employeeId = body.employee_id as string;
  const pin = body.pin as string;
  const floorExecutionId = body.floor_execution_id as string;
  const op = body.op as string;

  if (!deviceId || !deviceCredential || !employeeId || !pin || !floorExecutionId || !op) {
    return jsonResponse({ error: "campos obrigatorios ausentes" }, 400);
  }

  const device = await resolveDevice(deviceId, deviceCredential);
  if (!device) return jsonResponse({ error: "dispositivo invalido ou revogado" }, 401);

  const employee = await resolveEmployee(device.company_id, employeeId, pin);
  if (!employee || !employee.can_operate_production) return jsonResponse({ error: "PIN invalido ou colaborador sem producao" }, 401);

  const { data: exec } = await serviceClient.from("floor_executions").select("id, company_id").eq("id", floorExecutionId).maybeSingle();
  if (!exec || exec.company_id !== device.company_id) return jsonResponse({ error: "execucao nao encontrada" }, 404);

  if (op === "assumir") {
    const { data, error } = await serviceClient.rpc("floor_assume_execution", {
      p_floor_execution_id: floorExecutionId,
      p_employee_id: employee.id,
    });
    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ execution: data });
  }

  if (op === "avancar") {
    const delta = Number(body.quantity_delta);
    if (!delta || delta <= 0) return jsonResponse({ error: "quantidade invalida" }, 400);
    const { data, error } = await serviceClient.rpc("floor_advance_quantity", {
      p_floor_execution_id: floorExecutionId,
      p_quantity_delta: delta,
    });
    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ execution: data });
  }

  if (op === "concluir") {
    const { data, error } = await serviceClient.rpc("floor_complete_execution", { p_floor_execution_id: floorExecutionId });
    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ execution: data });
  }

  return jsonResponse({ error: "operacao desconhecida" }, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "metodo nao suportado" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "corpo invalido" }, 400);
  }

  switch (body.action) {
    case "identify":
      return handleIdentify(body);
    case "session":
      return handleSession(body);
    case "do":
      return handleAction(body);
    default:
      return jsonResponse({ error: "acao desconhecida" }, 400);
  }
});
