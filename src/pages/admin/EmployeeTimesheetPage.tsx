import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
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

const PUNCH_LABELS: Record<string, string> = {
  ENTRADA: "Entrada",
  INTERVALO: "Intervalo",
  RETORNO: "Retorno",
  SAIDA: "Saída",
};

function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h${m.toString().padStart(2, "0")}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function monthLabel(competencia: Date): string {
  return competencia.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function DayDetailRow({ employeeId, date }: { employeeId: string; date: string }) {
  const dayDetail = usePontoOrisApuracaoStore((s) => s.dayDetail);
  const dayDetailStatus = usePontoOrisApuracaoStore((s) => s.dayDetailStatus);

  if (dayDetailStatus === "loading") {
    return (
      <tr>
        <td colSpan={5} className="bg-forest-950/5 px-6 py-4 text-sm text-ink-muted">
          Carregando batidas de {new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR")}...
        </td>
      </tr>
    );
  }

  if (dayDetailStatus === "error" || !dayDetail) {
    return (
      <tr>
        <td colSpan={5} className="bg-forest-950/5 px-6 py-4 text-sm text-red-600">
          Não foi possível carregar as batidas deste dia.
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={5} className="bg-forest-950/5 px-6 py-4">
        {dayDetail.punches.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhuma batida registrada neste dia.</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {dayDetail.punches.map((punch) => (
              <div key={punch.id} className="flex items-center gap-3 rounded-xl border border-forest-950/10 bg-white p-3">
                {punch.photoUrl ? (
                  <img src={punch.photoUrl} alt={`Evidência da batida de ${PUNCH_LABELS[punch.type]}`} className="h-14 w-14 rounded-lg object-cover" />
                ) : (
                  <div className="h-14 w-14 animate-pulse rounded-lg bg-forest-950/10" />
                )}
                <div>
                  <p className="text-sm font-bold text-forest-950">{PUNCH_LABELS[punch.type]}</p>
                  <p className="text-xs text-ink-muted">{formatTime(punch.serverTime)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-muted">
          <span>Normal: <b className="text-ink-900">{formatMinutes(dayDetail.normalMinutes)}</b></span>
          <span>Extra: <b className="text-emerald-700">{formatMinutes(dayDetail.extraMinutes)}</b></span>
          <span>Atraso: <b className="text-red-600">{formatMinutes(dayDetail.lateMinutes)}</b></span>
        </div>
      </td>
    </tr>
  );
}

export function EmployeeTimesheetPage() {
  const { employeeId } = useParams();
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const days = usePontoOrisApuracaoStore((s) => s.days);
  const status = usePontoOrisApuracaoStore((s) => s.status);
  const fetchMonth = usePontoOrisApuracaoStore((s) => s.fetchMonth);
  const expandedDate = usePontoOrisApuracaoStore((s) => s.expandedDate);
  const toggleDay = usePontoOrisApuracaoStore((s) => s.toggleDay);

  const [competencia, setCompetencia] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const employee = useMemo(() => employees.find((e) => e.id === employeeId), [employees, employeeId]);
  const hasSchedule = Boolean(employee?.timesheetExpectedStart && employee?.timesheetExpectedEnd);

  useEffect(() => {
    if (employees.length === 0) fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    const competenciaIso = competencia.toISOString().slice(0, 10);
    fetchMonth(employeeId, competenciaIso);
  }, [employeeId, competencia, fetchMonth]);

  const totals = days.reduce(
    (acc, d) => ({
      worked: acc.worked + d.workedMinutes,
      normal: acc.normal + d.normalMinutes,
      extra: acc.extra + d.extraMinutes,
      late: acc.late + d.lateMinutes,
    }),
    { worked: 0, normal: 0, extra: 0, late: 0 }
  );
  const pendingCount = days.filter((d) => d.inconsistencyType).length;

  function changeMonth(delta: number) {
    setCompetencia((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {employee?.photoUrl && (
            <img src={employee.photoUrl} alt={employee.name} className="h-14 w-14 rounded-full object-cover" />
          )}
          <div>
            <Link
              to={employeeId ? `/admin/colaboradores/${employeeId}` : "/admin/colaboradores"}
              className="mb-1 flex items-center gap-1 text-sm text-ink-muted hover:text-forest-950"
            >
              <ArrowLeft size={14} /> Voltar ao cadastro
            </Link>
            <h1 className="text-2xl font-extrabold text-forest-950">
              Espelho de Ponto {employee ? `· ${employee.name}` : ""}
            </h1>
            <p className="text-sm text-ink-muted">Matrícula {employee?.code ?? "-----"}</p>
          </div>
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

      {!hasSchedule && (
        <div className="rounded-2xl border border-gold-500/30 bg-gold-500/10 p-4 text-sm text-gold-800">
          Este colaborador não tem jornada esperada configurada (entrada/saída/tolerância) — o sistema calcula o total
          trabalhado, mas ainda não classifica normal/extra/atraso. Configure na ficha do colaborador, seção "Jornada e ponto".
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Trabalhado</p>
          <p className="text-xl font-extrabold text-forest-950">{formatMinutes(totals.worked)}</p>
        </div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Normal</p>
          <p className="text-xl font-extrabold text-forest-950">{formatMinutes(totals.normal)}</p>
        </div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Extra</p>
          <p className="text-xl font-extrabold text-emerald-700">{formatMinutes(totals.extra)}</p>
        </div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Atrasos</p>
          <p className="text-xl font-extrabold text-red-600">{formatMinutes(totals.late)}</p>
        </div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Ocorrências</p>
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
                <th className="px-4 py-3">Extra / Atraso</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const date = new Date(`${day.date}T00:00:00`);
                const weekday = date.toLocaleDateString("pt-BR", { weekday: "short" });
                const isOpen = Boolean(day.openSessionStart);
                const isExpanded = expandedDate === day.date;
                return (
                  <Fragment key={day.date}>
                    <tr
                      onClick={() => employeeId && day.workedMinutes + (isOpen ? 1 : 0) > 0 && toggleDay(employeeId, day.date)}
                      className="cursor-pointer border-b border-forest-950/5 last:border-none hover:bg-forest-950/5"
                    >
                      <td className="px-4 py-3 text-ink-900">
                        {date.toLocaleDateString("pt-BR")} <span className="capitalize text-ink-muted">{weekday}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink-900">
                        {day.workedMinutes > 0 ? formatMinutes(day.workedMinutes) : "-----"}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-700/70">
                        {day.extraMinutes > 0 && <span className="text-emerald-700">+{formatMinutes(day.extraMinutes)}</span>}
                        {day.extraMinutes > 0 && day.lateMinutes > 0 && " · "}
                        {day.lateMinutes > 0 && <span className="text-red-600">atraso {formatMinutes(day.lateMinutes)}</span>}
                        {day.extraMinutes === 0 && day.lateMinutes === 0 && "-----"}
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
                      <td className="px-4 py-3 text-ink-muted">
                        {(day.workedMinutes > 0 || isOpen) && (isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
                      </td>
                    </tr>
                    {isExpanded && employeeId && <DayDetailRow employeeId={employeeId} date={day.date} />}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
