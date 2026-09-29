import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { employeeDocumentFromRow, employeeFromRow } from "@/lib/mappers/employee-mapper";
import { normalizeCpfDigits } from "@/types/employee";
import type { Employee, EmployeeDocument, EmployeeDocumentInput, EmployeeInput } from "@/types/employee";
import type { Json } from "@/types/supabase";

export interface EmployeeAuditEvent {
  id: string;
  type: string;
  detail: string;
  actor: string;
  occurredAt: string;
}

function toRow(input: EmployeeInput) {
  return {
    name: input.name,
    social_name: input.socialName || null,
    cpf: normalizeCpfDigits(input.cpf) || null,
    rg: input.rg || null,
    rg_issuer: input.rgIssuer || null,
    marital_status: input.maritalStatus || null,
    nationality: input.nationality || null,
    birthplace: input.birthplace || null,
    birth_date: input.birthDate || null,
    phone: input.phone || null,
    email: input.email || null,
    photo_url: input.photoUrl || null,
    notes: input.notes || null,

    cep: input.cep || null,
    street: input.street || null,
    address_number: input.addressNumber || null,
    complement: input.complement || null,
    neighborhood: input.neighborhood || null,
    city: input.city || null,
    state: input.state || null,

    emergency_name: input.emergencyName || null,
    emergency_relationship: input.emergencyRelationship || null,
    emergency_phone: input.emergencyPhone || null,

    unit_id: input.unitId,
    employment_type: input.employmentType || null,
    employment_regime: input.employmentRegime || null,
    admission_date: input.admissionDate || null,
    employment_start_date: input.employmentStartDate || null,
    employment_end_date: input.employmentEndDate || null,
    employment_notes: input.employmentNotes || null,

    department: input.department || null,
    role: input.role || null,
    manager_id: input.managerId,
    cost_center: input.costCenter || null,
    work_location: input.workLocation || null,
    lotation_effective_date: input.lotationEffectiveDate || null,

    timesheet_enabled: input.timesheetEnabled,
    timesheet_schedule_label: input.timesheetScheduleLabel || null,
    timesheet_weekly_hours: input.timesheetWeeklyHours || null,
    timesheet_break: input.timesheetBreak || null,
    timesheet_standard_hours: input.timesheetStandardHours || null,
    timesheet_overtime_bank: input.timesheetOvertimeBank || null,
    timesheet_overtime_mode: input.timesheetOvertimeMode || null,
    timesheet_from: input.timesheetFrom || null,
    timesheet_until: input.timesheetUntil || null,
    timesheet_expected_start: input.timesheetExpectedStart || null,
    timesheet_expected_end: input.timesheetExpectedEnd || null,
    timesheet_break_minutes: input.timesheetBreakMinutes,
    timesheet_tolerance_minutes: input.timesheetToleranceMinutes,
    timesheet_overtime_percent: input.timesheetOvertimePercent,

    salary_base: input.salaryBase,
    monthly_divisor: input.monthlyDivisor,
    salary_additions: input.salaryAdditions,
    salary_benefits: input.salaryBenefits || null,
    pix_key: input.pixKey || null,
    salary_effective_date: input.salaryEffectiveDate || null,
    overtime_minutes_sample: input.overtimeMinutesSample,
    advances_sample: input.advancesSample,

    tool_links: input.toolLinks as unknown as Json,
    can_operate_production: input.canOperateProduction,

    meu360_enabled: input.meu360Enabled,
    personal_email: input.personalEmail || null,
    personal_access_state: input.personalAccessState,

    admin_access_linked: input.adminAccessLinked,
    admin_access_status: input.adminAccessStatus || null,
    admin_access_role_label: input.adminAccessRoleLabel || null,
    admin_access_scope: input.adminAccessScope || null,

    status: input.status,
    termination_reason: input.terminationReason || null,
  };
}

async function logAudit(companyId: string, employeeId: string, eventType: string, detail: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("audit_events").insert({
    company_id: companyId,
    entity_type: "employee",
    entity_id: employeeId,
    event_type: eventType,
    actor_type: "USER",
    actor_user_id: user?.id ?? null,
    payload: { detail },
  });
}

interface EmployeesState {
  employees: Employee[];
  status: "idle" | "loading" | "ready" | "error";
  documentsByEmployee: Record<string, EmployeeDocument[]>;
  historyByEmployee: Record<string, EmployeeAuditEvent[]>;
  fetchEmployees: () => Promise<void>;
  createEmployee: (input: EmployeeInput) => Promise<Employee | null>;
  updateEmployee: (id: string, input: EmployeeInput, changeSummary?: string) => Promise<boolean>;
  fetchDocuments: (employeeId: string) => Promise<void>;
  addDocument: (employeeId: string, input: EmployeeDocumentInput) => Promise<boolean>;
  toggleDocumentShare: (documentId: string, employeeId: string, shared: boolean) => Promise<void>;
  fetchHistory: (employeeId: string) => Promise<void>;
  sendPersonalInvite: (employeeId: string) => Promise<void>;
}

export const useEmployeesStore = create<EmployeesState>()((set, get) => ({
  employees: [],
  status: "idle",
  documentsByEmployee: {},
  historyByEmployee: {},

  fetchEmployees: async () => {
    set({ status: "loading" });
    const { data, error } = await supabase.from("employees").select("*").order("name", { ascending: true });

    if (error) {
      toast.error("Não foi possível carregar os colaboradores");
      set({ status: "error" });
      return;
    }

    set({ employees: data.map(employeeFromRow), status: "ready" });
  },

  createEmployee: async (input) => {
    const { data, error } = await supabase.from("employees").insert(toRow(input)).select("*").single();

    if (error || !data) {
      toast.error(error?.code === "23505" ? "Já existe colaborador com esse CPF" : "Não foi possível cadastrar o colaborador");
      return null;
    }

    const employee = employeeFromRow(data);
    set((state) => ({ employees: [...state.employees, employee].sort((a, b) => a.name.localeCompare(b.name)) }));
    await logAudit(employee.id, employee.id, "Admissão", `Cadastro criado — ${employee.role || "sem cargo"} • ${employee.department || "sem departamento"}`);
    toast.success("Colaborador cadastrado");
    return employee;
  },

  updateEmployee: async (id, input, changeSummary) => {
    const { data, error } = await supabase.from("employees").update(toRow(input)).eq("id", id).select("*").single();

    if (error || !data) {
      toast.error(error?.code === "23505" ? "Já existe colaborador com esse CPF" : "Não foi possível atualizar o colaborador");
      return false;
    }

    const employee = employeeFromRow(data);
    set((state) => ({
      employees: state.employees.map((item) => (item.id === id ? employee : item)).sort((a, b) => a.name.localeCompare(b.name)),
    }));
    if (changeSummary) await logAudit(employee.id, id, "Alteração cadastral", changeSummary);
    toast.success("Colaborador atualizado");
    return true;
  },

  fetchDocuments: async (employeeId) => {
    const { data, error } = await supabase
      .from("employee_documents")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });
    if (error || !data) return;
    set((state) => ({ documentsByEmployee: { ...state.documentsByEmployee, [employeeId]: data.map(employeeDocumentFromRow) } }));
  },

  addDocument: async (employeeId, input) => {
    const { data, error } = await supabase
      .from("employee_documents")
      .insert({
        employee_id: employeeId,
        doc_type: input.docType,
        reference: input.reference,
        issued_at: input.issuedAt || null,
        expires_at: input.expiresAt || null,
        storage_path: input.storagePath,
        file_name: input.fileName || null,
        shared_meu360: input.sharedMeu360,
      })
      .select("*")
      .single();

    if (error || !data) {
      toast.error("Não foi possível adicionar o documento");
      return false;
    }

    const doc = employeeDocumentFromRow(data);
    set((state) => ({
      documentsByEmployee: { ...state.documentsByEmployee, [employeeId]: [doc, ...(state.documentsByEmployee[employeeId] ?? [])] },
    }));
    await logAudit(employeeId, employeeId, "Documento", `${doc.docType} (${doc.reference}) adicionado`);
    toast.success("Documento adicionado");
    return true;
  },

  toggleDocumentShare: async (documentId, employeeId, shared) => {
    const { error } = await supabase.from("employee_documents").update({ shared_meu360: shared }).eq("id", documentId);
    if (error) {
      toast.error("Não foi possível atualizar o compartilhamento");
      return;
    }
    set((state) => ({
      documentsByEmployee: {
        ...state.documentsByEmployee,
        [employeeId]: (state.documentsByEmployee[employeeId] ?? []).map((doc) => (doc.id === documentId ? { ...doc, sharedMeu360: shared } : doc)),
      },
    }));
    await logAudit(employeeId, employeeId, "Documento", `Disponibilidade no Meu 360 ${shared ? "liberada" : "revogada"}`);
  },

  fetchHistory: async (employeeId) => {
    const { data, error } = await supabase
      .from("audit_events")
      .select("id, event_type, payload, occurred_at")
      .eq("entity_type", "employee")
      .eq("entity_id", employeeId)
      .order("occurred_at", { ascending: false })
      .limit(50);
    if (error || !data) return;
    set((state) => ({
      historyByEmployee: {
        ...state.historyByEmployee,
        [employeeId]: data.map((row) => ({
          id: row.id,
          type: row.event_type,
          detail: (row.payload as { detail?: string } | null)?.detail ?? "",
          actor: "Administrador",
          occurredAt: row.occurred_at,
        })),
      },
    }));
  },

  sendPersonalInvite: async (employeeId) => {
    const employee = get().employees.find((item) => item.id === employeeId);
    if (!employee || !employee.personalEmail) {
      toast.error("Informe um e-mail pessoal válido antes de convidar");
      return;
    }
    await get().updateEmployee(employeeId, { ...employee, personalAccessState: "PENDENTE" }, "Convite de ativação do Meu 360 enviado");
    toast.success("Convite simulado — nenhum e-mail real foi enviado nesta versão");
  },
}));
