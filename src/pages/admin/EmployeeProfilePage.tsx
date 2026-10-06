import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";
import { useEmployeesStore } from "@/store/employees-store";
import { useAdminCompanyStore } from "@/store/admin-company-store";
import {
  EMPLOYEE_TOOLS,
  EMPLOYEE_TOOL_LABELS,
  defaultToolLink,
  formatCpf,
  hourValue,
  isValidCpf,
  normalizeCpfDigits,
  overtimeHourValue,
  overtimeSampleValue,
  type Employee,
  type EmployeeInput,
  type EmployeeToolKey,
  type ToolLink,
} from "@/types/employee";

// Paleta fiel ao HTML aprovado: ORIS360_Central_Colaboradores_V4_REFERENCIA_VISUAL_RECONCILIADA.html
const c = {
  page: "bg-[#f4f7fb] text-[#172033]",
  card: "rounded-[14px] border border-[#dfe6ef] bg-white shadow-[0_2px_8px_#22324b0b]",
  cardPad: "p-[18px]",
  label: "block text-xs font-bold text-[#566278] mb-1.5",
  input:
    "w-full rounded-[9px] border border-[#ccd6e3] bg-white px-[11px] py-2.5 text-sm text-[#172033] outline-none focus:border-[#1769d2]",
  muted: "text-[#69758a]",
  brand: "text-[#1769d2]",
  primaryBtn: "bg-[#1769d2] text-white border border-[#1769d2] hover:brightness-95",
  btn: "border border-[#cbd6e4] bg-white px-[13px] py-2 rounded-[9px] font-bold text-sm cursor-pointer hover:brightness-[0.98]",
  navBtn: "w-full text-left px-2.5 py-2.5 rounded-[9px] my-0.5 text-[#354156] hover:bg-[#eaf3ff]",
  navBtnActive: "bg-[#eaf3ff] text-[#0f4fa4] font-extrabold",
  notice: "bg-[#fff8e7] border border-[#f2d28d] p-[11px] rounded-[9px] text-[#79520b] text-sm",
  okbox: "bg-[#ecf8f1] border border-[#bfe5ce] p-[11px] rounded-[9px] text-[#176b3f] text-sm",
  pill: "text-[11px] px-[7px] py-1 rounded-full bg-[#eef3f8] text-[#5e6b80]",
};

const SECTIONS: [string, string][] = [
  ["identificacao", "1. Identificação"],
  ["vinculo", "2. Vínculo profissional"],
  ["lotacao", "3. Departamento, cargo e gestor"],
  ["jornada", "4. Jornada e ponto"],
  ["remuneracao", "5. Remuneração"],
  ["ferramentas", "6. Ferramentas vinculadas"],
  ["meu360", "7. Meu 360"],
  ["documentos", "8. Documentos"],
  ["acesso", "9. Acesso administrativo"],
  ["historico", "10. Histórico e auditoria"],
  ["ficha360", "Ficha 360 / Resumo"],
];

const REQUIRED_KEYS: (keyof EmployeeInput)[] = [
  "name",
  "cpf",
  "phone",
  "unitId" as keyof EmployeeInput,
  "employmentType",
  "admissionDate",
  "employmentStartDate",
  "department",
  "role",
  "lotationEffectiveDate",
];

function Card({ title, action, children, id }: { title: string; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className={`${c.card} ${c.cardPad} mb-3.5 scroll-mt-4`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-[#172033] m-0">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  span = 1,
  error,
  readOnly,
  placeholder,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  span?: 1 | 2 | 3;
  error?: string;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : span === 3 ? "sm:col-span-3" : ""}>
      <label className={c.label}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={`${c.input} ${error ? "border-2 border-[#b42318]" : ""} ${readOnly ? "cursor-not-allowed bg-[#f4f7fb]" : ""}`}
      />
      {error && <span className="mt-1 block text-xs text-[#b42318]">{error}</span>}
    </div>
  );
}

function PinSetter({ employeeId, hasPin }: { employeeId: string | undefined; hasPin: boolean }) {
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!employeeId) return;
    if (pin.length < 4) {
      toast.error("PIN precisa ter pelo menos 4 dígitos");
      return;
    }
    if (pin !== confirmPin) {
      toast.error("Os PINs não conferem");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("ponto-oris-terminal", {
      body: { action: "set-employee-pin", employee_id: employeeId, pin },
    });
    setSaving(false);
    if (error || !data?.ok) {
      toast.error(data?.error ?? "Não foi possível definir o PIN");
      return;
    }
    toast.success("PIN do ponto definido");
    setOpen(false);
    setPin("");
    setConfirmPin("");
    fetchEmployees();
  }

  if (!employeeId) {
    return <Field label="PIN do ponto" value="" readOnly placeholder="Salve o cadastro antes de definir o PIN" />;
  }

  if (!open) {
    return (
      <div>
        <label className={c.label}>PIN do ponto</label>
        <div className="flex items-center gap-2">
          <span className={hasPin ? c.okbox : c.notice} style={{ padding: "8px 11px", flex: 1 }}>
            {hasPin ? "PIN definido" : "Nenhum PIN definido"}
          </span>
          <button type="button" onClick={() => setOpen(true)} className={c.btn}>
            {hasPin ? "Redefinir" : "Definir"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sm:col-span-2">
      <label className={c.label}>Novo PIN do ponto</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="PIN (4-6 dígitos)"
          className={c.input}
          style={{ maxWidth: 160 }}
        />
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
          placeholder="Confirmar PIN"
          className={c.input}
          style={{ maxWidth: 160 }}
        />
        <button type="button" disabled={saving} onClick={() => void submit()} className={`${c.btn} ${c.primaryBtn}`}>
          Salvar
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPin("");
            setConfirmPin("");
          }}
          className={c.btn}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  span = 1,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  span?: 1 | 2 | 3;
  placeholder?: string;
}) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : span === 3 ? "sm:col-span-3" : ""}>
      <label className={c.label}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={c.input}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-[#1769d2]" : "bg-[#b9c3d0]"}`}
    >
      <span className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all ${on ? "left-[23px]" : "left-[3px]"}`} />
    </button>
  );
}

function ReadOnlyCode({ value }: { value: string }) {
  return (
    <div>
      <label className={c.label}>Matrícula</label>
      <div className="relative">
        <input
          value={value}
          disabled
          placeholder={value ? "" : "Gerada ao salvar"}
          className={`${c.input} cursor-not-allowed bg-[#f4f7fb] pr-10 text-[#69758a]`}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(value);
              toast.success("Matrícula copiada");
            }}
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#69758a] hover:bg-black/5"
          >
            <Copy size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

const emptyForm: EmployeeInput = {
  name: "",
  socialName: "",
  cpf: "",
  rg: "",
  rgIssuer: "",
  maritalStatus: "",
  nationality: "Brasileira",
  birthplace: "",
  birthDate: "",
  phone: "",
  email: "",
  photoUrl: "",
  notes: "",
  cep: "",
  street: "",
  addressNumber: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  emergencyName: "",
  emergencyRelationship: "",
  emergencyPhone: "",
  unitId: null,
  employmentType: "",
  employmentRegime: "",
  admissionDate: "",
  employmentStartDate: "",
  employmentEndDate: "",
  employmentNotes: "",
  department: "",
  role: "",
  managerId: null,
  costCenter: "",
  workLocation: "",
  lotationEffectiveDate: "",
  timesheetEnabled: false,
  timesheetScheduleLabel: "",
  timesheetWeeklyHours: "",
  timesheetBreak: "",
  timesheetStandardHours: "",
  timesheetOvertimeBank: "",
  timesheetOvertimeMode: "",
  timesheetFrom: "",
  timesheetUntil: "",
  timesheetExpectedStart: "",
  timesheetExpectedEnd: "",
  timesheetBreakMinutes: 60,
  timesheetToleranceMinutes: 10,
  timesheetOvertimePercent: 50,
  salaryBase: null,
  monthlyDivisor: 220,
  salaryAdditions: 0,
  salaryBenefits: "",
  pixKey: "",
  salaryEffectiveDate: "",
  overtimeMinutesSample: 0,
  advancesSample: 0,
  toolLinks: {},
  canOperateProduction: true,
  meu360Enabled: false,
  personalEmail: "",
  personalAccessState: "PENDENTE",
  adminAccessLinked: false,
  adminAccessStatus: "",
  adminAccessRoleLabel: "",
  adminAccessScope: "",
  status: "ATIVO",
  terminationReason: "",
};

function toInput(e: Employee): EmployeeInput {
  const { id: _id, code: _code, terminationDate: _t, createdAt: _c, updatedAt: _u, ...rest } = e;
  return rest;
}

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function EmployeeProfilePage() {
  const { employeeId } = useParams();
  const isEditing = employeeId !== undefined;
  const navigate = useNavigate();
  const companyName = useAdminCompanyStore((s) => s.company?.display_name) || "Empresa";
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const createEmployee = useEmployeesStore((s) => s.createEmployee);
  const updateEmployee = useEmployeesStore((s) => s.updateEmployee);
  const documentsByEmployee = useEmployeesStore((s) => s.documentsByEmployee);
  const fetchDocuments = useEmployeesStore((s) => s.fetchDocuments);
  const addDocument = useEmployeesStore((s) => s.addDocument);
  const toggleDocumentShare = useEmployeesStore((s) => s.toggleDocumentShare);
  const historyByEmployee = useEmployeesStore((s) => s.historyByEmployee);
  const fetchHistory = useEmployeesStore((s) => s.fetchHistory);
  const sendPersonalInvite = useEmployeesStore((s) => s.sendPersonalInvite);

  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const existing = useMemo(() => employees.find((e) => e.id === employeeId), [employees, employeeId]);
  const [form, setForm] = useState<EmployeeInput>(() => (isEditing && existing ? toInput(existing) : emptyForm));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [section, setSection] = useState("identificacao");
  const [saving, setSaving] = useState(false);
  const hydrated = useRef<string | undefined>(isEditing ? existing?.id : undefined);
  const docDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    fetchEmployees();
    resolveCurrentCompanyId().then((companyId) => {
      if (!companyId) return;
      supabase
        .from("units")
        .select("id, name")
        .eq("company_id", companyId)
        .then(({ data }) => data && setUnits(data));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEditing || !existing || hydrated.current === existing.id) return;
    hydrated.current = existing.id;
    setForm(toInput(existing));
  }, [isEditing, existing]);

  useEffect(() => {
    if (employeeId) {
      fetchDocuments(employeeId);
      fetchHistory(employeeId);
    }
  }, [employeeId, fetchDocuments, fetchHistory]);

  function set<K extends keyof EmployeeInput>(key: K, value: EmployeeInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toolLink(key: EmployeeToolKey): ToolLink {
    return form.toolLinks[key] ?? defaultToolLink(false);
  }
  function setToolLink(key: EmployeeToolKey, patch: Partial<ToolLink>) {
    setForm((prev) => ({ ...prev, toolLinks: { ...prev.toolLinks, [key]: { ...toolLink(key), ...patch } } }));
  }

  const otherEmployees = employees.filter((e) => e.id !== employeeId);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Informe o nome";
    const cpfDigits = normalizeCpfDigits(form.cpf);
    if (cpfDigits && !isValidCpf(cpfDigits)) next.cpf = "CPF inválido";
    if (form.birthDate && form.birthDate > new Date().toISOString().slice(0, 10)) next.birthDate = "Não pode ser futura";
    if (form.employmentEndDate && form.employmentStartDate && form.employmentEndDate < form.employmentStartDate) {
      next.employmentEndDate = "Fim anterior ao início";
    }
    if (form.status === "INATIVO" && !form.employmentEndDate) next.employmentEndDate = "Informe a data do desligamento";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function changeSummary(before: EmployeeInput | null): string {
    if (!before) return "Cadastro criado";
    const changed: string[] = [];
    (Object.keys(form) as (keyof EmployeeInput)[]).forEach((key) => {
      if (JSON.stringify(before[key]) !== JSON.stringify(form[key])) changed.push(String(key));
    });
    return changed.length ? `Campos alterados: ${changed.join(", ")}` : "Nenhuma alteração de conteúdo";
  }

  async function persist(): Promise<Employee | null> {
    if (!validate()) {
      toast.error("Confira os campos destacados");
      return null;
    }
    setSaving(true);
    let result: Employee | null = null;
    if (isEditing && existing) {
      const ok = await updateEmployee(existing.id, form, changeSummary(toInput(existing)));
      result = ok ? { ...existing, ...form } as Employee : null;
    } else {
      result = await createEmployee(form);
      if (result) {
        hydrated.current = result.id;
        navigate(`/admin/colaboradores/${result.id}`, { replace: true });
      }
    }
    setSaving(false);
    return result;
  }

  async function handleSaveDraft() {
    await persist();
  }
  async function handleSaveAndContinue() {
    const ok = await persist();
    if (ok) {
      const i = SECTIONS.findIndex(([id]) => id === section);
      setSection(SECTIONS[Math.min(i + 1, SECTIONS.length - 1)][0]);
    }
  }
  async function handleFinish() {
    const ok = await persist();
    if (ok) navigate("/admin/colaboradores");
  }

  const hourVal = hourValue(form.salaryBase, form.monthlyDivisor);
  const overtimeVal = overtimeHourValue(form.salaryBase, form.monthlyDivisor);
  const overtimeSample = overtimeSampleValue(form.salaryBase, form.monthlyDivisor, form.overtimeMinutesSample);
  const totalEstimate = (form.salaryBase ?? 0) + overtimeSample + form.salaryAdditions - form.advancesSample;

  const progress = Math.round(
    (REQUIRED_KEYS.filter((key) => {
      const value = form[key];
      return typeof value === "string" ? value.trim() !== "" : value !== null && value !== undefined;
    }).length /
      REQUIRED_KEYS.length) *
      100
  );

  const documents = employeeId ? documentsByEmployee[employeeId] ?? [] : [];
  const history = employeeId ? historyByEmployee[employeeId] ?? [] : [];

  async function handleDocUpload(formEl: HTMLFormElement) {
    if (!employeeId) return;
    const data = new FormData(formEl);
    const file = data.get("file") as File | null;
    const docType = String(data.get("docType") || "");
    const reference = String(data.get("reference") || "").trim();
    const issuedAt = String(data.get("issuedAt") || "");
    const expiresAt = String(data.get("expiresAt") || "");
    if (!reference || !issuedAt || !file || file.size === 0) {
      toast.error("Preencha referência, emissão e selecione um arquivo");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo maior que 10MB");
      return;
    }
    const path = `${employeeId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("employee-documents").upload(path, file);
    if (error) {
      toast.error("Não foi possível enviar o arquivo");
      return;
    }
    await addDocument(employeeId, {
      docType,
      reference,
      issuedAt,
      expiresAt,
      storagePath: path,
      fileName: file.name,
      sharedMeu360: false,
    });
    docDialogRef.current?.close();
    formEl.reset();
  }

  return (
    <div className={`${c.page} -m-4 min-h-full p-4 sm:-m-6 sm:p-6`}>
      <div className="mb-4 flex items-center gap-3">
        <div className={`text-lg font-extrabold ${c.brand}`}>
          ÓRIS 360 <span className="text-xs font-semibold text-[#69758a]">• Colaboradores</span>
        </div>
        <div className="flex-1" />
        <span className="rounded-full bg-[#e8f5ee] px-2.5 py-1.5 text-xs font-bold text-[#17864b]">
          {form.status === "ATIVO" ? "● Ativo" : "● Inativo"}
        </span>
        <button type="button" className={`${c.btn} text-xs`} onClick={() => setSection("ficha360")}>
          Ficha 360
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <aside className={`${c.card} h-fit p-3.5 lg:sticky lg:top-4`}>
          <div className="border-b border-[#dfe6ef] px-2 pb-4 pt-2 text-center">
            <div className="mx-auto grid h-[70px] w-[70px] place-items-center rounded-full bg-gradient-to-br from-[#d8e9ff] to-[#f5f9ff] text-xl font-extrabold text-[#1769d2]">
              {form.photoUrl ? (
                <img src={form.photoUrl} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                form.name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"
              )}
            </div>
            <h3 className="mt-2 mb-0.5 text-sm font-bold">{form.name || "Novo colaborador"}</h3>
            <p className={`text-xs ${c.muted}`}>Matrícula {existing?.code ?? "—"}</p>
            <div className="my-2.5 h-2 overflow-hidden rounded-full bg-[#e8edf4]">
              <div className="h-full bg-[#1769d2] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <small className={c.muted}>Cadastro {progress}% completo</small>
          </div>
          <nav className="mt-2 flex flex-col gap-0.5 lg:block overflow-x-auto lg:overflow-visible">
            <div className="flex gap-1 lg:block">
              {SECTIONS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={`${c.navBtn} ${section === id ? c.navBtnActive : ""} whitespace-nowrap text-sm`}
                >
                  {label}
                </button>
              ))}
            </div>
          </nav>
        </aside>

        <main className="min-w-0">
          <div className={`${c.card} ${c.cardPad} mb-3.5`}>
            <h1 className="m-0 mb-1 text-xl font-extrabold">Cadastro de Colaborador</h1>
            <p className={`m-0 text-sm ${c.muted}`}>
              Identidade única conectando Ponto, Meu 360, Missões, Produção, Vendas, Entrega e demais ferramentas.
            </p>
            <div className={`mt-3 ${c.notice}`}>
              <b>Empresa ativa: {companyName}.</b> Este cadastro pertence a uma única empresa (tenant). Pessoas podem ter vínculos em
              mais de uma empresa quando aplicável; cada empresa mantém seu próprio histórico e isolamento.
            </div>
            <div className={`mt-2.5 ${c.okbox}`}>
              <b>Regra de produção:</b> a confirmação pelo registrador autorizado conclui o registro e atualiza estoque e ficha
              técnica uma única vez. Não há segunda aprovação humana obrigatória.
            </div>
          </div>

          {section === "identificacao" && (
            <>
              <Card title="Identificação">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Nome completo *" value={form.name} onChange={(v) => set("name", v)} span={2} error={errors.name} />
                  <Field label="Nome social" value={form.socialName} onChange={(v) => set("socialName", v)} />
                  <Field label="CPF" value={formatCpf(form.cpf)} onChange={(v) => set("cpf", v)} error={errors.cpf} />
                  <Field label="RG" value={form.rg} onChange={(v) => set("rg", v)} />
                  <Field label="Órgão emissor" value={form.rgIssuer} onChange={(v) => set("rgIssuer", v)} />
                  <Field label="Data de nascimento" type="date" value={form.birthDate} onChange={(v) => set("birthDate", v)} error={errors.birthDate} />
                  <Select
                    label="Estado civil"
                    value={form.maritalStatus}
                    onChange={(v) => set("maritalStatus", v)}
                    placeholder="Selecionar"
                    options={["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"].map((v) => ({ value: v, label: v }))}
                  />
                  <Field label="Nacionalidade" value={form.nationality} onChange={(v) => set("nationality", v)} />
                  <Field label="Naturalidade" value={form.birthplace} onChange={(v) => set("birthplace", v)} />
                  <Field label="Telefone" value={form.phone} onChange={(v) => set("phone", v)} />
                  <Field label="E-mail pessoal" type="email" value={form.email} onChange={(v) => set("email", v)} span={2} />
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <label className={c.label}>Foto</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error("Imagem até 5MB");
                        return;
                      }
                      const path = `employees/${crypto.randomUUID()}-${file.name}`;
                      const { error } = await supabase.storage.from("product-images").upload(path, file);
                      if (error) {
                        toast.error("Não foi possível enviar a foto");
                        return;
                      }
                      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
                      set("photoUrl", data.publicUrl);
                    }}
                  />
                </div>
                <div className="mt-3">
                  <label className={c.label}>Observações cadastrais</label>
                  <textarea
                    maxLength={2000}
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    className={`${c.input} min-h-[76px]`}
                  />
                </div>
              </Card>

              <Card title="Endereço">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="CEP" value={form.cep} onChange={(v) => set("cep", v)} />
                  <Field label="Logradouro" value={form.street} onChange={(v) => set("street", v)} span={2} />
                  <Field label="Número" value={form.addressNumber} onChange={(v) => set("addressNumber", v)} />
                  <Field label="Complemento" value={form.complement} onChange={(v) => set("complement", v)} />
                  <Field label="Bairro" value={form.neighborhood} onChange={(v) => set("neighborhood", v)} />
                  <Field label="Cidade" value={form.city} onChange={(v) => set("city", v)} />
                  <Field label="UF" value={form.state} onChange={(v) => set("state", v)} />
                </div>
              </Card>

              <Card title="Contato de emergência">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Nome" value={form.emergencyName} onChange={(v) => set("emergencyName", v)} />
                  <Select
                    label="Parentesco"
                    value={form.emergencyRelationship}
                    onChange={(v) => set("emergencyRelationship", v)}
                    placeholder="Selecionar"
                    options={["Cônjuge", "Pai/Mãe", "Irmão(ã)", "Filho(a)", "Outro"].map((v) => ({ value: v, label: v }))}
                  />
                  <Field label="Telefone" value={form.emergencyPhone} onChange={(v) => set("emergencyPhone", v)} />
                </div>
              </Card>
            </>
          )}

          {section === "vinculo" && (
            <>
              <Card title="Vínculo profissional">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Select
                    label="Unidade"
                    value={form.unitId ?? ""}
                    onChange={(v) => set("unitId", v || null)}
                    placeholder="Selecionar"
                    options={units.map((u) => ({ value: u.id, label: u.name }))}
                  />
                  <ReadOnlyCode value={existing?.code ?? ""} />
                  <Field label="Data de admissão" type="date" value={form.admissionDate} onChange={(v) => set("admissionDate", v)} />
                  <Select
                    label="Tipo de vínculo"
                    value={form.employmentType}
                    onChange={(v) => set("employmentType", v)}
                    placeholder="Selecionar"
                    options={["CLT", "Prestador", "Temporário", "Estágio", "Outro"].map((v) => ({ value: v, label: v }))}
                  />
                  <Select
                    label="Situação profissional"
                    value={form.status}
                    onChange={(v) => set("status", v as EmployeeInput["status"])}
                    options={[
                      { value: "ATIVO", label: "Ativo" },
                      { value: "INATIVO", label: "Desligado" },
                    ]}
                  />
                  <Select
                    label="Regime"
                    value={form.employmentRegime}
                    onChange={(v) => set("employmentRegime", v)}
                    placeholder="Selecionar"
                    options={["Mensalista", "Horista", "Outro"].map((v) => ({ value: v, label: v }))}
                  />
                  <Field label="Início do vínculo" type="date" value={form.employmentStartDate} onChange={(v) => set("employmentStartDate", v)} />
                  <Field
                    label="Fim do vínculo"
                    type="date"
                    value={form.employmentEndDate}
                    onChange={(v) => set("employmentEndDate", v)}
                    error={errors.employmentEndDate}
                  />
                </div>
              </Card>
              <Card title="Observações do vínculo">
                <textarea
                  value={form.employmentNotes}
                  onChange={(e) => set("employmentNotes", e.target.value)}
                  className={`${c.input} min-h-[76px]`}
                />
              </Card>
            </>
          )}

          {section === "lotacao" && (
            <>
              <Card title="Lotação e função">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Departamento / Setor" value={form.department} onChange={(v) => set("department", v)} />
                  <Field label="Cargo / Função" value={form.role} onChange={(v) => set("role", v)} />
                  <Select
                    label="Gestor imediato"
                    value={form.managerId ?? ""}
                    onChange={(v) => set("managerId", v || null)}
                    placeholder="Nenhum"
                    options={otherEmployees.map((e) => ({ value: e.id, label: `${e.name} — ${e.role || "sem cargo"}` }))}
                  />
                  <Field label="Centro de custo" value={form.costCenter} onChange={(v) => set("costCenter", v)} />
                  <Field label="Local de trabalho" value={form.workLocation} onChange={(v) => set("workLocation", v)} />
                  <Field label="Vigência atual" type="date" value={form.lotationEffectiveDate} onChange={(v) => set("lotationEffectiveDate", v)} />
                </div>
              </Card>
              <div className={c.okbox}>
                A alteração de departamento, cargo ou gestor deve criar novo registro de histórico (ver seção 10). O estado
                anterior não é apagado.
              </div>
            </>
          )}

          {section === "jornada" && (
            <>
              <Card
                title="Jornada e ponto"
                action={<Switch on={form.timesheetEnabled} onToggle={() => set("timesheetEnabled", !form.timesheetEnabled)} />}
              >
                {form.timesheetEnabled && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Jornada / Escala" value={form.timesheetScheduleLabel} onChange={(v) => set("timesheetScheduleLabel", v)} />
                    <Field label="Carga semanal" value={form.timesheetWeeklyHours} onChange={(v) => set("timesheetWeeklyHours", v)} />
                    <Field label="Intervalo" value={form.timesheetBreak} onChange={(v) => set("timesheetBreak", v)} />
                    <Field label="Horário padrão" value={form.timesheetStandardHours} onChange={(v) => set("timesheetStandardHours", v)} />
                    <Select
                      label="Banco de horas"
                      value={form.timesheetOvertimeBank}
                      onChange={(v) => set("timesheetOvertimeBank", v)}
                      placeholder="Selecionar"
                      options={["Ativo", "Não utiliza"].map((v) => ({ value: v, label: v }))}
                    />
                    <Select
                      label="Horas extras"
                      value={form.timesheetOvertimeMode}
                      onChange={(v) => set("timesheetOvertimeMode", v)}
                      placeholder="Selecionar"
                      options={["Calcula e acompanha", "Somente registra"].map((v) => ({ value: v, label: v }))}
                    />
                    <ReadOnlyCode value={existing?.code ?? ""} />
                    <PinSetter employeeId={existing?.id} hasPin={existing?.hasTimesheetPin ?? false} />
                    <Field label="Controlar ponto a partir de" type="date" value={form.timesheetFrom} onChange={(v) => set("timesheetFrom", v)} />
                    <Field label="Controlar ponto até" type="date" value={form.timesheetUntil} onChange={(v) => set("timesheetUntil", v)} />
                    <Field label="Entrada esperada" type="time" value={form.timesheetExpectedStart} onChange={(v) => set("timesheetExpectedStart", v)} />
                    <Field label="Saída esperada" type="time" value={form.timesheetExpectedEnd} onChange={(v) => set("timesheetExpectedEnd", v)} />
                    <div>
                      <label className={c.label}>Intervalo (minutos)</label>
                      <input
                        type="number"
                        value={form.timesheetBreakMinutes}
                        onChange={(e) => set("timesheetBreakMinutes", Number(e.target.value))}
                        className={c.input}
                      />
                    </div>
                    <div>
                      <label className={c.label}>Tolerância de atraso (minutos)</label>
                      <input
                        type="number"
                        value={form.timesheetToleranceMinutes}
                        onChange={(e) => set("timesheetToleranceMinutes", Number(e.target.value))}
                        className={c.input}
                      />
                    </div>
                    <div>
                      <label className={c.label}>Adicional de hora extra (%)</label>
                      <input
                        type="number"
                        value={form.timesheetOvertimePercent}
                        onChange={(e) => set("timesheetOvertimePercent", Number(e.target.value))}
                        className={c.input}
                      />
                    </div>
                  </div>
                )}
                <div className={`mt-3 ${c.notice}`}>
                  Operação de ponto é 100% online. O servidor confirma cada registro; sem conexão, a interface informa
                  indisponibilidade — nunca inventa batidas.
                </div>
                {existing?.id && (
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/colaboradores/${existing.id}/espelho`)}
                    className={`${c.btn} ${c.primaryBtn} mt-3`}
                  >
                    Ver espelho de ponto
                  </button>
                )}
              </Card>
            </>
          )}

          {section === "remuneracao" && (
            <>
              <Card title="Remuneração atual">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field
                    label="Salário base"
                    type="number"
                    value={form.salaryBase?.toString() ?? ""}
                    onChange={(v) => set("salaryBase", v ? Number(v) : null)}
                  />
                  <Field
                    label="Divisor / jornada mensal de referência"
                    type="number"
                    value={form.monthlyDivisor.toString()}
                    onChange={(v) => set("monthlyDivisor", Number(v) || 220)}
                  />
                  <Field label="Valor-hora normal (automático)" value={money(hourVal)} readOnly onChange={() => {}} />
                  <Field label="Adicional de hora extra" value="50%" readOnly onChange={() => {}} />
                  <Field label="Valor da hora extra +50% (automático)" value={money(overtimeVal)} readOnly onChange={() => {}} />
                  <Field label="Vigência remuneratória" type="date" value={form.salaryEffectiveDate} onChange={(v) => set("salaryEffectiveDate", v)} />
                  <Field label="Adicionais (R$)" type="number" value={form.salaryAdditions.toString()} onChange={(v) => set("salaryAdditions", Number(v) || 0)} />
                  <Field label="Benefícios" value={form.salaryBenefits} onChange={(v) => set("salaryBenefits", v)} />
                  <Field label="Chave Pix" value={form.pixKey} onChange={(v) => set("pixKey", v)} span={2} />
                </div>
                <div className={`mt-3 ${c.notice}`}>
                  <b>Regra automática aprovada:</b> Valor-hora = salário-base ÷ divisor. Hora extra = valor-hora × 1,50. Os dois
                  valores são calculados pelo sistema e nunca digitados manualmente.
                </div>
              </Card>

              <Card title="Amostra — horas extras e adiantamentos">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label="Horas extras da amostra (minutos)"
                    type="number"
                    value={form.overtimeMinutesSample.toString()}
                    onChange={(v) => set("overtimeMinutesSample", Math.max(0, Number(v) || 0))}
                  />
                  <Field
                    label="Adiantamentos da amostra (R$)"
                    type="number"
                    value={form.advancesSample.toString()}
                    onChange={(v) => set("advancesSample", Math.max(0, Number(v) || 0))}
                  />
                </div>
              </Card>

              <Card title="Meu Dinheiro — prévia">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[
                    ["Base", form.salaryBase ?? 0],
                    ["Extras estimadas", overtimeSample],
                    ["Adiantamentos", form.advancesSample],
                    ["Estimativa demonstrativa", totalEstimate],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-[11px] border border-[#dfe6ef] p-3.5">
                      <span className="text-xs text-[#69758a]">{label}</span>
                      <b className="mt-1 block text-lg">{money(value as number)}</b>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[#69758a]">
                  Amostra aritmética. Não representa salário líquido, folha fechada ou valores devidos.
                </p>
              </Card>

              {existing?.id && (
                <Card title="Força de Vendas e Tarefas">
                  <p className={`mb-3 text-sm ${c.muted}`}>Taxa de comissão e tarefas atribuídas são gerenciadas nas telas dedicadas.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => navigate("/admin/vendas")} className={`${c.btn} ${c.primaryBtn}`}>
                      Ver comissões
                    </button>
                    <button type="button" onClick={() => navigate("/admin/tarefas")} className={`${c.btn} ${c.primaryBtn}`}>
                      Ver tarefas
                    </button>
                  </div>
                </Card>
              )}
            </>
          )}

          {section === "ferramentas" && (
            <Card title="Ferramentas vinculadas">
              <p className={`mb-3 text-sm ${c.muted}`}>Participar de uma ferramenta não significa possuir acesso administrativo a ela.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {EMPLOYEE_TOOLS.map((key) => {
                  const link = toolLink(key);
                  const meta = EMPLOYEE_TOOL_LABELS[key];
                  return (
                    <div key={key} className="rounded-xl border border-[#dfe6ef] p-3.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="m-0 text-sm font-bold">{meta.name}</h3>
                          <span className={c.pill}>{meta.role}</span>
                        </div>
                        <Switch on={link.participates} onToggle={() => setToolLink(key, { participates: !link.participates })} />
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {(
                          [
                            ["participates", "Participa"],
                            ["selectable", "Aparece para seleção"],
                            ["receivesWork", "Recebe trabalho"],
                            ["canOperate", "Pode operar"],
                          ] as [keyof ToolLink, string][]
                        ).map(([field, label]) => (
                          <label key={field} className="flex items-center gap-1.5 text-xs text-[#4d596d]">
                            <input
                              type="checkbox"
                              checked={link[field]}
                              onChange={(e) => setToolLink(key, { [field]: e.target.checked })}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={form.canOperateProduction}
                  onChange={(e) => set("canOperateProduction", e.target.checked)}
                />
                Atalho: pode participar de registros de Produziu Registra
              </label>
            </Card>
          )}

          {section === "meu360" && (
            <Card title="Meu 360 — Portal do Colaborador" action={<Switch on={form.meu360Enabled} onToggle={() => set("meu360Enabled", !form.meu360Enabled)} />}>
              {form.meu360Enabled && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="E-mail de acesso pessoal" type="email" value={form.personalEmail} onChange={(v) => set("personalEmail", v)} />
                  <Select
                    label="Estado do acesso pessoal"
                    value={form.personalAccessState}
                    onChange={(v) => set("personalAccessState", v as EmployeeInput["personalAccessState"])}
                    options={[
                      { value: "PENDENTE", label: "Pendente de ativação" },
                      { value: "ATIVO", label: "Ativo" },
                      { value: "BLOQUEADO", label: "Bloqueado" },
                    ]}
                  />
                </div>
              )}
              <button
                type="button"
                className={`${c.btn} mt-3`}
                onClick={() => employeeId && sendPersonalInvite(employeeId)}
                disabled={!employeeId || !form.meu360Enabled}
              >
                Simular convite de ativação
              </button>
              <p className="mt-2 text-xs text-[#69758a]">
                Nenhum e-mail real é enviado nesta versão. Em produção: link de uso único, validade de 24h.
              </p>
            </Card>
          )}

          {section === "documentos" && (
            <Card title="Documentos">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#dfe6ef] text-left text-xs font-bold text-[#566278]">
                      <th className="py-2">Documento</th>
                      <th className="py-2">Referência</th>
                      <th className="py-2">Validade</th>
                      <th className="py-2">Meu 360</th>
                      <th className="py-2">Arquivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-[#69758a]">
                          Nenhum documento adicionado.
                        </td>
                      </tr>
                    ) : (
                      documents.map((doc) => (
                        <tr key={doc.id} className="border-b border-[#dfe6ef]">
                          <td className="py-2">
                            {doc.docType}
                            <br />
                            <small className="text-[#69758a]">{doc.reference}</small>
                          </td>
                          <td className="py-2">{doc.reference}</td>
                          <td className="py-2">{doc.expiresAt || "—"}</td>
                          <td className="py-2">
                            <input
                              type="checkbox"
                              checked={doc.sharedMeu360}
                              onChange={(e) => employeeId && toggleDocumentShare(doc.id, employeeId, e.target.checked)}
                            />
                          </td>
                          <td className="py-2">
                            <button
                              type="button"
                              className="text-[#1769d2] underline"
                              onClick={async () => {
                                const { data } = await supabase.storage
                                  .from("employee-documents")
                                  .createSignedUrl(doc.storagePath, 300);
                                if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                              }}
                            >
                              Baixar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className={`${c.btn} mt-3`}
                disabled={!employeeId}
                onClick={() => docDialogRef.current?.showModal()}
              >
                + Adicionar documento
              </button>
              {!employeeId && <p className="mt-2 text-xs text-[#69758a]">Salve o cadastro antes de anexar documentos.</p>}

              <dialog ref={docDialogRef} className="rounded-2xl border border-[#ccd6e3] p-6 backdrop:bg-[#10243b88]">
                <form
                  method="dialog"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleDocUpload(e.currentTarget);
                  }}
                  className="flex w-[min(480px,80vw)] flex-col gap-3"
                >
                  <h2 className="m-0 text-base font-bold">Adicionar documento</h2>
                  <div>
                    <label className={c.label}>Tipo</label>
                    <select name="docType" className={c.input}>
                      <option>RG</option>
                      <option>Contrato</option>
                      <option>ASO</option>
                      <option>Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className={c.label}>Referência</label>
                    <input name="reference" className={c.input} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={c.label}>Emissão</label>
                      <input name="issuedAt" type="date" className={c.input} />
                    </div>
                    <div>
                      <label className={c.label}>Validade</label>
                      <input name="expiresAt" type="date" className={c.input} />
                    </div>
                  </div>
                  <div>
                    <label className={c.label}>Arquivo</label>
                    <input name="file" type="file" accept="application/pdf,image/png,image/jpeg" />
                  </div>
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" className={c.btn} onClick={() => docDialogRef.current?.close()}>
                      Cancelar
                    </button>
                    <button type="submit" className={`${c.btn} ${c.primaryBtn}`}>
                      Adicionar
                    </button>
                  </div>
                </form>
              </dialog>
            </Card>
          )}

          {section === "acesso" && (
            <Card
              title="Acesso administrativo ao Óris 360"
              action={<Switch on={form.adminAccessLinked} onToggle={() => set("adminAccessLinked", !form.adminAccessLinked)} />}
            >
              {form.adminAccessLinked && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Select
                    label="Status"
                    value={form.adminAccessStatus}
                    onChange={(v) => set("adminAccessStatus", v)}
                    placeholder="Selecionar"
                    options={["Ativo", "Inativo", "Bloqueado"].map((v) => ({ value: v, label: v }))}
                  />
                  <Field label="Perfil base" value={form.adminAccessRoleLabel} onChange={(v) => set("adminAccessRoleLabel", v)} />
                  <Select
                    label="Escopo"
                    value={form.adminAccessScope}
                    onChange={(v) => set("adminAccessScope", v)}
                    placeholder="Selecionar"
                    options={[
                      "OWN · Próprios registros",
                      "TEAM · Equipe autorizada",
                      "UNIT · Unidade autorizada",
                      "ORGANIZATION · Empresa autorizada",
                      "GROUP · Grupo autorizado",
                    ].map((v) => ({ value: v, label: v }))}
                  />
                </div>
              )}
              <div className={`mt-3 ${c.notice}`}>
                A matriz detalhada de permissões pertence ao módulo Usuários e Acessos. Esta ficha apenas mostra e vincula o
                acesso.
              </div>
            </Card>
          )}

          {section === "historico" && (
            <Card title="Histórico e auditoria">
              {history.length === 0 ? (
                <p className={c.muted}>Nenhum evento registrado ainda.</p>
              ) : (
                <div className="border-l-2 border-[#dce6f2] pl-5">
                  {history.map((event) => (
                    <div key={event.id} className="relative mb-4">
                      <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-[3px] border-[#eaf3ff] bg-[#1769d2]" />
                      <b className="text-sm">
                        {new Date(event.occurredAt).toLocaleString("pt-BR")} • {event.type}
                      </b>
                      <p className="my-1 whitespace-pre-wrap text-sm">{event.detail}</p>
                      <small className={c.muted}>{event.actor}</small>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {section === "ficha360" && (
            <>
              <Card title={`Ficha 360 — ${form.name || "Colaborador"}`}>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[
                    ["Situação", form.status === "ATIVO" ? "Ativo" : "Desligado"],
                    ["Departamento", form.department || "—"],
                    ["Cargo", form.role || "—"],
                    ["Admissão", form.admissionDate || "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[11px] border border-[#dfe6ef] p-3.5">
                      <span className="text-xs text-[#69758a]">{label}</span>
                      <b className="mt-1 block text-base">{value}</b>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Visão 360">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-bold">Remuneração</h3>
                    <p className="text-xl font-extrabold">{money(form.salaryBase ?? 0)}</p>
                    <small className={c.muted}>Base vigente</small>
                    <h3 className="mt-3 text-sm font-bold">Ferramentas</h3>
                    <p className="text-sm">
                      {EMPLOYEE_TOOLS.filter((k) => toolLink(k).participates).map((k) => EMPLOYEE_TOOL_LABELS[k].name).join(" • ") ||
                        "Nenhuma"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Documentos</h3>
                    <p className="text-sm">{documents.length} documento(s) registrado(s).</p>
                    <h3 className="mt-3 text-sm font-bold">Acessos independentes</h3>
                    <p className="text-sm">
                      Meu 360: {form.meu360Enabled ? "habilitado" : "desabilitado"}
                      <br />
                      Administrativo: {form.adminAccessLinked ? form.adminAccessStatus || "vinculado" : "sem usuário"}
                    </p>
                  </div>
                </div>
              </Card>
            </>
          )}

          <div className="sticky bottom-0 mt-2 flex flex-wrap justify-end gap-2 rounded-[12px] border border-[#dfe6ef] bg-white/95 p-2.5 backdrop-blur">
            <button type="button" className={c.btn} onClick={() => navigate("/admin/colaboradores")}>
              Voltar
            </button>
            <button type="button" className={c.btn} disabled={saving} onClick={() => void handleSaveDraft()}>
              Salvar rascunho
            </button>
            <button type="button" className={c.btn} disabled={saving} onClick={() => void handleSaveAndContinue()}>
              Salvar e continuar
            </button>
            <button type="button" className={`${c.btn} ${c.primaryBtn}`} disabled={saving} onClick={() => void handleFinish()}>
              {saving ? "Salvando..." : "Finalizar cadastro"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
