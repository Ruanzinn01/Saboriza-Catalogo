export const EMPLOYEE_STATUSES = ["ATIVO", "INATIVO"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const PERSONAL_ACCESS_STATES = ["PENDENTE", "ATIVO", "BLOQUEADO"] as const;
export type PersonalAccessState = (typeof PERSONAL_ACCESS_STATES)[number];

export const EMPLOYEE_TOOLS = ["producao", "missoes", "separacao", "entrega", "vendas", "ponto"] as const;
export type EmployeeToolKey = (typeof EMPLOYEE_TOOLS)[number];

export const EMPLOYEE_TOOL_LABELS: Record<EmployeeToolKey, { name: string; role: string }> = {
  producao: { name: "Produziu Registra", role: "Participante" },
  missoes: { name: "Minhas Missões", role: "Executor" },
  separacao: { name: "Separa Confere", role: "Separador" },
  entrega: { name: "Entrega Registra", role: "Entregador" },
  vendas: { name: "App Vendas", role: "Vendedor" },
  ponto: { name: "Sistema de Ponto", role: "Colaborador" },
};

export interface ToolLink {
  participates: boolean;
  selectable: boolean;
  receivesWork: boolean;
  canOperate: boolean;
}

export type ToolLinks = Partial<Record<EmployeeToolKey, ToolLink>>;

export const defaultToolLink = (on: boolean): ToolLink => ({
  participates: on,
  selectable: on,
  receivesWork: on,
  canOperate: on,
});

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  docType: string;
  reference: string;
  issuedAt: string;
  expiresAt: string;
  storagePath: string;
  fileName: string;
  sharedMeu360: boolean;
  createdAt: string;
}

export type EmployeeDocumentInput = Omit<EmployeeDocument, "id" | "employeeId" | "createdAt">;

export interface Employee {
  id: string;
  code: string;
  name: string;
  socialName: string;
  cpf: string;
  rg: string;
  rgIssuer: string;
  maritalStatus: string;
  nationality: string;
  birthplace: string;
  birthDate: string;
  phone: string;
  email: string;
  photoUrl: string;
  notes: string;

  cep: string;
  street: string;
  addressNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;

  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;

  unitId: string | null;
  employmentType: string;
  employmentRegime: string;
  admissionDate: string;
  employmentStartDate: string;
  employmentEndDate: string;
  employmentNotes: string;

  department: string;
  role: string;
  managerId: string | null;
  costCenter: string;
  workLocation: string;
  lotationEffectiveDate: string;

  timesheetEnabled: boolean;
  timesheetScheduleLabel: string;
  timesheetWeeklyHours: string;
  timesheetBreak: string;
  timesheetStandardHours: string;
  timesheetOvertimeBank: string;
  timesheetOvertimeMode: string;
  timesheetFrom: string;
  timesheetUntil: string;
  hasTimesheetPin: boolean;

  salaryBase: number | null;
  monthlyDivisor: number;
  salaryAdditions: number;
  salaryBenefits: string;
  pixKey: string;
  salaryEffectiveDate: string;
  overtimeMinutesSample: number;
  advancesSample: number;

  toolLinks: ToolLinks;
  canOperateProduction: boolean;

  meu360Enabled: boolean;
  personalEmail: string;
  personalAccessState: PersonalAccessState;

  adminAccessLinked: boolean;
  adminAccessStatus: string;
  adminAccessRoleLabel: string;
  adminAccessScope: string;

  status: EmployeeStatus;
  terminationDate: string | null;
  terminationReason: string;
  createdAt: string;
  updatedAt: string;
}

export type EmployeeInput = Omit<Employee, "id" | "code" | "terminationDate" | "createdAt" | "updatedAt" | "hasTimesheetPin">;

export function normalizeCpfDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCpf(value: string): string {
  const digits = normalizeCpfDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpfDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let n = 9; n < 11; n++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(cpf[i]) * (n + 1 - i);
    let digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    if (digit !== Number(cpf[n])) return false;
  }
  return true;
}

export function hourValue(salaryBase: number | null, monthlyDivisor: number): number {
  if (!salaryBase || salaryBase < 0 || !monthlyDivisor || monthlyDivisor <= 0) return 0;
  return salaryBase / monthlyDivisor;
}

export function overtimeHourValue(salaryBase: number | null, monthlyDivisor: number): number {
  return hourValue(salaryBase, monthlyDivisor) * 1.5;
}

export function overtimeSampleValue(salaryBase: number | null, monthlyDivisor: number, minutes: number): number {
  const rate = overtimeHourValue(salaryBase, monthlyDivisor);
  return Math.round(((minutes / 60) * rate) * 100) / 100;
}
