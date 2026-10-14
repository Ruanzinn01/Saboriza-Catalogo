import { fromUntyped, rpcUntyped } from "@/lib/supabase-rpc";
import type { EmployeeInput } from "@/types/employee";

/** Colunas de remuneração: após a fase 2 de segurança só as funções de banco as leem e gravam. */
export const EMPLOYEE_PUBLIC_COLUMNS =
  "address_number,admin_access_linked,admin_access_role_label,admin_access_scope,admin_access_status,admission_date,advances_sample,birth_date,birthplace,can_operate_production,cep,city,code,company_id,complement,cost_center,cpf,created_at,department,email,emergency_name,emergency_phone,emergency_relationship,employment_end_date,employment_notes,employment_regime,employment_start_date,employment_type,id,lotation_effective_date,manager_id,marital_status,meu360_enabled,name,nationality,neighborhood,notes,overtime_minutes_sample,personal_access_state,personal_email,phone,photo_url,rg,rg_issuer,role,social_name,state,status,street,termination_date,termination_reason,timesheet_break,timesheet_break_minutes,timesheet_enabled,timesheet_expected_end,timesheet_expected_start,timesheet_from,timesheet_overtime_bank,timesheet_overtime_mode,timesheet_pin_hash,timesheet_schedule_label,timesheet_standard_hours,timesheet_tolerance_minutes,timesheet_until,timesheet_weekly_hours,tool_links,unit_id,updated_at,work_location";

const COMPENSATION_COLUMNS = "id,salary_base,salary_additions,salary_benefits,salary_effective_date,monthly_divisor,timesheet_overtime_percent,pix_key";

/**
 * rpc: banco com as funções de remuneração (fase 1 aplicada).
 * legacy: banco anterior à fase 1, leitura e escrita direto nas colunas.
 * hidden: usuário sem permissão de remuneração; os campos não são lidos nem gravados.
 */
export type CompensationMode = "rpc" | "legacy" | "hidden";

export interface CompensationData {
  salary_base: number | null;
  salary_additions: number;
  salary_benefits: string | null;
  salary_effective_date: string | null;
  monthly_divisor: number;
  timesheet_overtime_percent: number;
  pix_key: string | null;
}

export const EMPTY_COMPENSATION: CompensationData = {
  salary_base: null,
  salary_additions: 0,
  salary_benefits: null,
  salary_effective_date: null,
  monthly_divisor: 0,
  timesheet_overtime_percent: 0,
  pix_key: null,
};

function functionMissing(message: string | undefined): boolean {
  return /Could not find the function|PGRST202|does not exist/i.test(message ?? "");
}

export async function fetchCompensation(): Promise<{ mode: CompensationMode; byEmployee: Record<string, CompensationData> }> {
  const rpc = await rpcUntyped("list_employee_compensation");
  if (!rpc.error) {
    const byEmployee: Record<string, CompensationData> = {};
    for (const row of (rpc.data as Array<CompensationData & { employee_id: string }> | null) ?? []) byEmployee[row.employee_id] = row;
    return { mode: "rpc", byEmployee };
  }
  if (!functionMissing(rpc.error.message)) return { mode: "hidden", byEmployee: {} };

  const legacy = await fromUntyped("employees").select(COMPENSATION_COLUMNS);
  if (legacy.error) return { mode: "hidden", byEmployee: {} };
  const byEmployee: Record<string, CompensationData> = {};
  for (const row of (legacy.data as Array<CompensationData & { id: string }> | null) ?? []) byEmployee[row.id] = row;
  return { mode: "legacy", byEmployee };
}

export function compensationFromInput(input: EmployeeInput): CompensationData {
  return {
    salary_base: input.salaryBase,
    salary_additions: input.salaryAdditions,
    salary_benefits: input.salaryBenefits || null,
    salary_effective_date: input.salaryEffectiveDate || null,
    monthly_divisor: input.monthlyDivisor,
    timesheet_overtime_percent: input.timesheetOvertimePercent,
    pix_key: input.pixKey || null,
  };
}

export function compensationChanges(before: CompensationData, after: CompensationData): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  (Object.keys(after) as Array<keyof CompensationData>).forEach((key) => {
    if ((before[key] ?? null) !== (after[key] ?? null)) changes[key] = after[key];
  });
  return changes;
}

/** Grava a remuneração no modo do banco. Retorna a mensagem de erro, ou null quando deu certo. */
export async function saveCompensation(
  mode: CompensationMode,
  employeeId: string,
  before: CompensationData,
  after: CompensationData,
  reason: string,
): Promise<string | null> {
  if (mode === "hidden") return null;
  const changes = compensationChanges(before, after);
  if (Object.keys(changes).length === 0) return null;

  if (mode === "rpc") {
    const { error } = await rpcUntyped("set_employee_compensation", {
      p_employee_id: employeeId,
      p_changes: changes,
      p_reason: reason.trim() || null,
    });
    return error ? error.message : null;
  }

  const { error } = await (fromUntyped("employees") as unknown as { update: (v: unknown) => { eq: (c: string, v: string) => PromiseLike<{ error: { message: string } | null }> } })
    .update(changes)
    .eq("id", employeeId);
  return error ? error.message : null;
}

export async function fetchCommissionRates(): Promise<{ mode: CompensationMode; byEmployee: Record<string, number | null> }> {
  const rpc = await rpcUntyped("list_commission_rates");
  if (!rpc.error) {
    const byEmployee: Record<string, number | null> = {};
    for (const row of (rpc.data as Array<{ employee_id: string; commission_rate_percent: number | null }> | null) ?? []) {
      byEmployee[row.employee_id] = row.commission_rate_percent;
    }
    return { mode: "rpc", byEmployee };
  }
  if (!functionMissing(rpc.error.message)) return { mode: "hidden", byEmployee: {} };

  const legacy = await fromUntyped("employees").select("id,commission_rate_percent");
  if (legacy.error) return { mode: "hidden", byEmployee: {} };
  const byEmployee: Record<string, number | null> = {};
  for (const row of (legacy.data as Array<{ id: string; commission_rate_percent: number | null }> | null) ?? []) {
    byEmployee[row.id] = row.commission_rate_percent;
  }
  return { mode: "legacy", byEmployee };
}
