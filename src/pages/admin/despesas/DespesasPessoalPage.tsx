import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDespesasStore } from "@/store/despesas-store";
import { useEmployeesStore } from "@/store/employees-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";
import { DetailHeader, DetailKpis, brl, withContext } from "@/pages/admin/despesas/shared";
import { useDespesasFilters } from "@/pages/admin/despesas/useDespesasFilters";
import { DESPESAS_COLORS } from "@/pages/admin/despesas/theme";

const C = DESPESAS_COLORS;

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export function DespesasPessoalPage() {
  const navigate = useNavigate();
  const { params, monthRef } = useDespesasFilters();
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const obligations = useDespesasStore((s) => s.obligations);
  const generateObligation = useDespesasStore((s) => s.generateObligation);
  const fetchAll = useDespesasStore((s) => s.fetchAll);
  const [competence, setCompetence] = useState(monthRef + "-01");

  useEffect(() => {
    if (employees.length === 0) fetchEmployees();
    fetchAll();
  }, [employees.length, fetchEmployees, fetchAll]);

  const monthObligations = obligations.filter((o) => o.competence === competence);
  const employeesWithoutObligation = employees.filter(
    (e) => e.salaryBase && !monthObligations.some((o) => o.employeeId === e.id)
  );

  const brutaTotal = monthObligations.reduce((s, o) => s + o.baseSalary, 0);
  const pagoTotal = monthObligations.reduce((s, o) => s + (o.baseSalary - o.remaining), 0);
  const adiantamentosTotal = monthObligations.reduce((s, o) => s + o.advancesPaid, 0);

  async function handleGenerateAll() {
    for (const e of employeesWithoutObligation) {
      await generateObligation(e.id, e.name, competence, e.salaryBase ?? 0);
    }
    toast.success("Obrigações salariais geradas a partir da vigência vigente em Colaboradores");
  }

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        crumb="Pessoal e remuneração"
        title="Pessoal e remuneração"
        subtitle="Folha salarial por colaborador. Salário-base não é digitado aqui — vem da vigência vigente em Colaboradores."
        params={params}
        action={
          <button onClick={() => navigate(withContext("/admin/despesas/comissoes", params))} className="rounded-xl border px-3 py-2.5 text-sm font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>
            Ver comissões
          </button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm" style={{ color: C.green }}>
          Competência
          <input type="month" value={competence.slice(0, 7)} onChange={(e) => setCompetence(e.target.value + "-01")} className="h-11 rounded-xl border px-3 text-sm" style={{ borderColor: C.line }} />
        </label>
        {employeesWithoutObligation.length > 0 && (
          <Button size="sm" onClick={() => void handleGenerateAll()}>
            Gerar obrigações ({employeesWithoutObligation.length})
          </Button>
        )}
      </div>

      <DetailKpis items={[
        { label: "Folha bruta", value: brl(brutaTotal) },
        { label: "Adiantamentos", value: brl(adiantamentosTotal) },
        { label: "Já pago", value: brl(pagoTotal) },
        { label: "Saldo a pagar", value: brl(brutaTotal - pagoTotal) },
      ]} />

      {monthObligations.length === 0 ? (
        <AdminState variant="empty" message="Nenhuma obrigação salarial gerada para esta competência ainda." />
      ) : (
        <div className="rounded-3xl border bg-white" style={{ borderColor: C.line }}>
          <div className="flex items-center justify-between gap-2 border-b p-4" style={{ borderColor: C.line }}>
            <div>
              <h2 className="text-[19px] font-bold" style={{ color: C.green }}>{monthObligations.length} colaborador(es)</h2>
              <p className="text-[11px]" style={{ color: C.muted }}>Clique em cada card para ver a composição individual.</p>
            </div>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#faf0d7", color: "#977021" }}>foto do cadastro</span>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {monthObligations.map((o) => (
              <button
                key={o.id}
                onClick={() => navigate(withContext(`/admin/despesas/pessoal/${o.employeeId}`, params))}
                className="rounded-[15px] border bg-white p-[14px] text-left transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderColor: C.line }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[14px] text-sm font-extrabold" style={{ background: "linear-gradient(145deg,#e1ebe2,#c8d9ca)", color: "#315d49", border: "1px solid #cad8ca" }}>
                    {initials(o.employeeName)}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: C.green }}>{o.employeeName}</p>
                    <p className="text-[11px]" style={{ color: C.muted }}>Competência {o.competence.slice(0, 7)}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-1.5 text-[11px]">
                  <div className="flex justify-between"><span style={{ color: C.muted }}>Salário</span><strong style={{ color: C.green }}>{brl(o.baseSalary)}</strong></div>
                  <div className="flex justify-between"><span style={{ color: C.muted }}>Adiantado</span><strong style={{ color: C.green }}>{brl(o.advancesPaid)}</strong></div>
                  <div className="flex justify-between"><span style={{ color: C.muted }}>Saldo</span><strong style={{ color: C.green }}>{brl(o.remaining)}</strong></div>
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: o.remaining <= 0 ? "#e7f4e9" : "#eef0ed", color: o.remaining <= 0 ? "#2e754b" : "#68726b" }}>
                    {o.remaining <= 0 ? "Pago" : "A pagar"}
                  </span>
                  <span className="text-[11px]" style={{ color: C.muted }}>Abrir ›</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
