import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { useDespesasStore } from "@/store/despesas-store";
import { useEmployeesStore } from "@/store/employees-store";
import { AdminState } from "@/components/admin/AdminState";
import { DetailHeader, brl, withContext } from "@/pages/admin/despesas/shared";
import { useDespesasFilters } from "@/pages/admin/despesas/useDespesasFilters";
import { DESPESAS_COLORS } from "@/pages/admin/despesas/theme";

const C = DESPESAS_COLORS;

/** Perfil financeiro do colaborador — tela de acompanhamento, NÃO edita salário-base (PRD §5.8/DRT §5.3). */
export function DespesasColaboradorPage() {
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  const { params } = useDespesasFilters();
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const obligations = useDespesasStore((s) => s.obligations);
  const advances = useDespesasStore((s) => s.advances);
  const fetchAll = useDespesasStore((s) => s.fetchAll);
  const createAdvance = useDespesasStore((s) => s.createAdvance);
  const payAdvance = useDespesasStore((s) => s.payAdvance);
  const reverseAdvance = useDespesasStore((s) => s.reverseAdvance);
  const [advanceValue, setAdvanceValue] = useState("");

  useEffect(() => {
    if (employees.length === 0) fetchEmployees();
    fetchAll();
  }, [employees.length, fetchEmployees, fetchAll]);

  const employee = employees.find((e) => e.id === employeeId);
  const employeeObligations = obligations.filter((o) => o.employeeId === employeeId).sort((a, b) => b.competence.localeCompare(a.competence));
  const current = employeeObligations[0];
  const currentAdvances = current ? advances.filter((a) => a.obligationId === current.id) : [];

  if (!employee) return <AdminState variant="empty" message="Colaborador não encontrado." />;

  async function handleAdvance() {
    if (!current) return;
    const value = Number(advanceValue);
    if (!value) return;
    const err = await createAdvance(current.id, value);
    if (err) toast.error(err);
    else {
      toast.success("Vale solicitado");
      setAdvanceValue("");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        crumb={employee.name}
        title={employee.name}
        subtitle={`Composição individual da remuneração · ${employee.role}`}
        params={params}
        action={
          <button onClick={() => navigate(withContext("/admin/despesas/pessoal", params))} className="rounded-xl border px-3 py-2.5 text-sm font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>
            Todos os colaboradores
          </button>
        }
      />

      <div className="grid grid-cols-[100px_1fr] gap-[18px] rounded-3xl border bg-white p-5" style={{ borderColor: C.line }}>
        <div className="flex h-[110px] w-[96px] items-center justify-center rounded-[18px] text-2xl font-extrabold" style={{ background: "linear-gradient(145deg,#e1ebe2,#c8d9ca)", color: "#315d49", border: "1px solid #cad8ca" }}>
          {employee.photoUrl ? <img src={employee.photoUrl} alt={employee.name} className="h-full w-full rounded-[18px] object-cover" /> : employee.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-[11px]" style={{ color: C.muted }}>A foto real vem do cadastro de Colaboradores.</p>
          <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="rounded-[10px] p-[11px]" style={{ background: "#f7f9f4" }}><span className="block text-[9px] uppercase" style={{ color: C.muted }}>Matrícula</span><strong className="text-xs">{employee.code}</strong></div>
            <div className="rounded-[10px] p-[11px]" style={{ background: "#f7f9f4" }}><span className="block text-[9px] uppercase" style={{ color: C.muted }}>Função</span><strong className="text-xs">{employee.role}</strong></div>
            {current && <div className="rounded-[10px] p-[11px]" style={{ background: "#f7f9f4" }}><span className="block text-[9px] uppercase" style={{ color: C.muted }}>Competência</span><strong className="text-xs">{current.competence.slice(0, 7)}</strong></div>}
          </div>
        </div>
      </div>

      {!current ? (
        <AdminState variant="empty" message="Nenhuma obrigação salarial gerada para este colaborador ainda." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[14px] border bg-white p-[15px]" style={{ borderColor: C.line }}><span className="text-[10px] uppercase" style={{ color: C.muted }}>Salário-base vigente</span><strong className="mt-[7px] block text-xl" style={{ color: C.green }}>{brl(current.baseSalary)}</strong></div>
            <div className="rounded-[14px] border bg-white p-[15px]" style={{ borderColor: C.line }}><span className="text-[10px] uppercase" style={{ color: C.muted }}>Adiantamentos</span><strong className="mt-[7px] block text-xl" style={{ color: C.green }}>{brl(current.advancesPaid)}</strong></div>
            <div className="rounded-[14px] border bg-white p-[15px]" style={{ borderColor: C.line }}><span className="text-[10px] uppercase" style={{ color: C.muted }}>Saldo atual</span><strong className="mt-[7px] block text-xl" style={{ color: C.green }}>{brl(current.remaining)}</strong></div>
            <div className="rounded-[14px] border bg-white p-[15px]" style={{ borderColor: C.line }}><span className="text-[10px] uppercase" style={{ color: C.muted }}>Situação</span><strong className="mt-[7px] block text-xl" style={{ color: C.green }}>{current.status}</strong></div>
          </div>

          <div className="rounded-3xl border bg-white" style={{ borderColor: C.line }}>
            <div className="border-b p-4" style={{ borderColor: C.line }}>
              <h2 className="text-[19px] font-bold" style={{ color: C.green }}>Linha do tempo da competência</h2>
              <p className="text-[11px]" style={{ color: C.muted }}>Sem duplicar salário e vale</p>
            </div>
            <div className="px-4">
              {currentAdvances.length === 0 && <p className="py-3 text-sm" style={{ color: C.muted }}>Sem vales nesta competência.</p>}
              {currentAdvances.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 border-b py-3 text-sm last:border-none" style={{ borderColor: "#edf0ea" }}>
                  <div>
                    <strong style={{ color: C.green }}>{brl(a.amount)}</strong>
                    <p className="text-xs" style={{ color: C.muted }}>{a.status === "SOLICITADO" ? "Solicitado" : a.status === "PAGO" ? "Pago" : "Estornado"} · {a.requestedAt.slice(0, 10)}</p>
                  </div>
                  <div className="flex gap-1">
                    {a.status === "SOLICITADO" && (
                      <button onClick={() => void payAdvance(a.id).then((e) => (e ? toast.error(e) : toast.success("Vale pago")))} className="flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
                        <CheckCircle2 size={12} /> Pagar
                      </button>
                    )}
                    {a.status === "PAGO" && (
                      <button onClick={() => void reverseAdvance(a.id).then((e) => (e ? toast.error(e) : toast.success("Vale estornado")))} className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50">
                        <RotateCcw size={12} /> Estornar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 border-t p-4" style={{ borderColor: "#edf0ea" }}>
              <input
                type="number"
                value={advanceValue}
                onChange={(e) => setAdvanceValue(e.target.value)}
                placeholder="Novo vale (R$)"
                className="h-10 w-40 rounded-lg border px-3 text-sm"
                style={{ borderColor: C.line }}
              />
              <button onClick={() => void handleAdvance()} className="rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>
                Registrar vale
              </button>
            </div>
            <p className="px-4 pb-4 text-[11px]" style={{ color: C.muted }}>Vale pago reduz o saldo financeiro a pagar; a despesa econômica da folha permanece integral. Fonte: Cadastro de Colaboradores / Gestão Salarial.</p>
          </div>
        </>
      )}
    </div>
  );
}
