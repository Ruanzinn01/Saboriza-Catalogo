import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useEmployeesStore } from "@/store/employees-store";
import { usePontoOrisApuracaoStore } from "@/store/ponto-oris-apuracao-store";
import { AdminState } from "@/components/admin/AdminState";

const INCONSISTENCY_LABELS: Record<string, string> = {
  SEQUENCIA_INVALIDA: "Sequência inválida",
  ABERTURA_SEM_FECHAMENTO: "Sessão aberta sem fechamento",
  PRIMEIRO_EVENTO_INESPERADO: "Primeiro evento inesperado",
  BATIDA_AUSENTE: "Batida ausente",
  BATIDA_DUPLICADA: "Batida duplicada",
  HORARIO_INCOERENTE: "Horário incoerente",
  SOLICITACAO_AJUSTE: "Solicitação de ajuste",
};

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

function monthLabel(competencia: Date): string {
  return competencia.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function EmployeeTimesheetPage() {
  const { employeeId } = useParams();
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const days = usePontoOrisApuracaoStore((s) => s.days);
  const status = usePontoOrisApuracaoStore((s) => s.status);
  const fetchMonth = usePontoOrisApuracaoStore((s) => s.fetchMonth);

  const [competencia, setCompetencia] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const employee = useMemo(() => employees.find((e) => e.id === employeeId), [employees, employeeId]);

  useEffect(() => {
    if (employees.length === 0) fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    const competenciaIso = competencia.toISOString().slice(0, 10);
    fetchMonth(employeeId, competenciaIso);
  }, [employeeId, competencia, fetchMonth]);

  const totalMinutes = days.reduce((sum, d) => sum + d.workedMinutes, 0);
  const pendingCount = days.filter((d) => d.inconsistencyType).length;

  function changeMonth(delta: number) {
    setCompetencia((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to={employeeId ? `/admin/colaboradores/${employeeId}` : "/admin/colaboradores"}
            className="mb-2 flex items-center gap-1 text-sm text-ink-muted hover:text-forest-950"
          >
            <ArrowLeft size={14} /> Voltar ao cadastro
          </Link>
          <h1 className="text-2xl font-extrabold text-forest-950">
            Espelho de Ponto {employee ? `· ${employee.name}` : ""}
          </h1>
          <p className="text-sm text-ink-muted">Matrícula {employee?.code ?? "-----"}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-forest-950/10 bg-white px-3 py-2">
          <button onClick={() => changeMonth(-1)} aria-label="Mês anterior" className="text-forest-800 hover:text-forest-950">
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-32 text-center text-sm font-semibold capitalize text-ink-900">{monthLabel(competencia)}</span>
          <button onClick={() => changeMonth(1)} aria-label="Próximo mês" className="text-forest-800 hover:text-forest-950">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Trabalhado no mês</p>
          <p className="text-xl font-extrabold text-forest-950">{formatMinutes(totalMinutes)}</p>
        </div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Dias com ocorrência</p>
          <p className={`text-xl font-extrabold ${pendingCount > 0 ? "text-red-600" : "text-forest-950"}`}>{pendingCount}</p>
        </div>
      </div>

      {status === "loading" && days.length === 0 ? (
        <AdminState variant="loading" message="Calculando apuração..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível calcular a apuração deste mês." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Trabalhado</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const date = new Date(`${day.date}T00:00:00`);
                const weekday = date.toLocaleDateString("pt-BR", { weekday: "short" });
                const isOpen = Boolean(day.openSessionStart);
                return (
                  <tr key={day.date} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                    <td className="px-4 py-3 text-ink-900">
                      {date.toLocaleDateString("pt-BR")} <span className="capitalize text-ink-muted">{weekday}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink-900">
                      {day.workedMinutes > 0 ? formatMinutes(day.workedMinutes) : "-----"}
                    </td>
                    <td className="px-4 py-3">
                      {day.inconsistencyType ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                          {INCONSISTENCY_LABELS[day.inconsistencyType] ?? day.inconsistencyType}
                        </span>
                      ) : isOpen ? (
                        <span className="rounded-full bg-gold-500/20 px-2.5 py-1 text-xs font-semibold text-gold-700">
                          Em andamento
                        </span>
                      ) : day.workedMinutes > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">OK</span>
                      ) : (
                        <span className="text-ink-muted">-----</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
