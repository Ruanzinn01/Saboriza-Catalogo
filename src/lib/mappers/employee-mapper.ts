import type { Employee, EmployeeDocument, EmployeeStatus, PersonalAccessState, ToolLinks } from "@/types/employee";
import type { Database } from "@/types/supabase";

type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];
type EmployeeDocumentRow = Database["public"]["Tables"]["employee_documents"]["Row"];

export function employeeFromRow(row: EmployeeRow): Employee {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    socialName: row.social_name ?? "",
    cpf: row.cpf ?? "",
    rg: row.rg ?? "",
    rgIssuer: row.rg_issuer ?? "",
    maritalStatus: row.marital_status ?? "",
    nationality: row.nationality ?? "",
    birthplace: row.birthplace ?? "",
    birthDate: row.birth_date ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    photoUrl: row.photo_url ?? "",
    notes: row.notes ?? "",

    cep: row.cep ?? "",
    street: row.street ?? "",
    addressNumber: row.address_number ?? "",
    complement: row.complement ?? "",
    neighborhood: row.neighborhood ?? "",
    city: row.city ?? "",
    state: row.state ?? "",

    emergencyName: row.emergency_name ?? "",
    emergencyRelationship: row.emergency_relationship ?? "",
    emergencyPhone: row.emergency_phone ?? "",

    unitId: row.unit_id,
    employmentType: row.employment_type ?? "",
    employmentRegime: row.employment_regime ?? "",
    admissionDate: row.admission_date ?? "",
    employmentStartDate: row.employment_start_date ?? "",
    employmentEndDate: row.employment_end_date ?? "",
    employmentNotes: row.employment_notes ?? "",

    department: row.department ?? "",
    role: row.role ?? "",
    managerId: row.manager_id,
    costCenter: row.cost_center ?? "",
    workLocation: row.work_location ?? "",
    lotationEffectiveDate: row.lotation_effective_date ?? "",

    timesheetEnabled: row.timesheet_enabled,
    timesheetScheduleLabel: row.timesheet_schedule_label ?? "",
    timesheetWeeklyHours: row.timesheet_weekly_hours ?? "",
    timesheetBreak: row.timesheet_break ?? "",
    timesheetStandardHours: row.timesheet_standard_hours ?? "",
    timesheetOvertimeBank: row.timesheet_overtime_bank ?? "",
    timesheetOvertimeMode: row.timesheet_overtime_mode ?? "",
    timesheetFrom: row.timesheet_from ?? "",
    timesheetUntil: row.timesheet_until ?? "",
    timesheetExpectedStart: row.timesheet_expected_start ?? "",
    timesheetExpectedEnd: row.timesheet_expected_end ?? "",
    timesheetBreakMinutes: row.timesheet_break_minutes,
    timesheetToleranceMinutes: row.timesheet_tolerance_minutes,
    hasTimesheetPin: Boolean(row.timesheet_pin_hash),

    salaryBase: row.salary_base,
    monthlyDivisor: row.monthly_divisor,
    salaryAdditions: row.salary_additions,
    salaryBenefits: row.salary_benefits ?? "",
    pixKey: row.pix_key ?? "",
    salaryEffectiveDate: row.salary_effective_date ?? "",
    overtimeMinutesSample: row.overtime_minutes_sample,
    advancesSample: row.advances_sample,

    toolLinks: (row.tool_links as ToolLinks) ?? {},
    canOperateProduction: row.can_operate_production,

    meu360Enabled: row.meu360_enabled,
    personalEmail: row.personal_email ?? "",
    personalAccessState: row.personal_access_state as PersonalAccessState,

    adminAccessLinked: row.admin_access_linked,
    adminAccessStatus: row.admin_access_status ?? "",
    adminAccessRoleLabel: row.admin_access_role_label ?? "",
    adminAccessScope: row.admin_access_scope ?? "",

    status: row.status as EmployeeStatus,
    terminationDate: row.termination_date,
    terminationReason: row.termination_reason ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function employeeDocumentFromRow(row: EmployeeDocumentRow): EmployeeDocument {
  return {
    id: row.id,
    employeeId: row.employee_id,
    docType: row.doc_type,
    reference: row.reference,
    issuedAt: row.issued_at ?? "",
    expiresAt: row.expires_at ?? "",
    storagePath: row.storage_path,
    fileName: row.file_name ?? "",
    sharedMeu360: row.shared_meu360,
    createdAt: row.created_at,
  };
}
