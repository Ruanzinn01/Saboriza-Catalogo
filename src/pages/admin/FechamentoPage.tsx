import { useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useFechamentoStore, type MonthlyCloseStatus } from "@/store/fechamento-store";
import { AdminState } from "@/components/admin/AdminState";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthLabel = (m: string) => new Date(m + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

const STATUS_META: Record<MonthlyCloseStatus, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  EM_ANDAMENTO: { label: "Em andamento", tone: "bg-amber-100 text-amber-800", icon: Clock },
  PREPARANDO: { label: "Preparando", tone: "bg-amber-100 text-amber-800", icon: Clock },
  PRONTO: { label: "Pronto", tone: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  FECHADO_AUTOMATICAMENTE: { label: "Fechado automaticamente", tone: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  FECHADO_COM_PENDENCIA: { label: "Fechado com pendência", tone: "bg-gold-500/20 text-gold-700", icon: AlertTriangle },
  FALHA_TECNICA_FECHAMENTO: { label: "Falha técnica", tone: "bg-red-100 text-red-700", icon: XCircle },
};

export function FechamentoPage() {
  const closes = useFechamentoStore((s) => s.closes);
  const automationEnabled = useFechamentoStore((s) => s.automationEnabled);
  const status = useFechamentoStore((s) => s.status);
  const fetchAll = useFechamentoStore((s) => s.fetchAll);
  const setAutomation = useFechamentoStore((s) => s.setAutomation);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleToggle() {
    const err = await setAutomation(!automationEnabled);
    if (err) toast.error(err);
    else toast.success(!automationEnabled ? "Automação de fechamento ativada" : "Automação de fechamento desativada");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Fechamento Mensal</h1>
        <p className="text-sm text-ink-muted">Não existe botão para fechar o mês: a virada acontece sozinha, no fuso da empresa, quando a automação está ativa.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-forest-950/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-ink-900">Automação de fechamento</p>
          <p className="text-xs text-ink-muted">
            {automationEnabled ? "Ativa — o mês fecha sozinho na virada do calendário." : "Desativada — nenhum mês será fechado automaticamente."}
          </p>
        </div>
        <button
          onClick={() => void handleToggle()}
          className={`h-11 rounded-xl px-5 text-sm font-bold ${automationEnabled ? "bg-red-50 text-red-700" : "bg-forest-950 text-white"}`}
        >
          {automationEnabled ? "Desativar automação" : "Ativar automação"}
        </button>
      </div>

      {status === "loading" && closes.length === 0 ? (
        <AdminState variant="loading" message="Carregando fechamentos..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar os fechamentos." />
      ) : closes.length === 0 ? (
        <AdminState variant="empty" message="Nenhum mês fechado ainda." />
      ) : (
        <div className="flex flex-col gap-3">
          {closes.map((c) => {
            const meta = STATUS_META[c.status];
            const Icon = meta.icon;
            const resultado = c.snapshot.resultado as { resultado_operacional_gerencial?: number } | undefined;
            return (
              <div key={c.id} className="flex flex-col gap-3 rounded-2xl border border-forest-950/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-forest-950">{monthLabel(c.competence)}</p>
                  {resultado?.resultado_operacional_gerencial !== undefined && (
                    <p className="text-sm text-ink-muted">Resultado gerencial: {brl(resultado.resultado_operacional_gerencial)}</p>
                  )}
                  {c.pendencies.length > 0 && (
                    <p className="text-xs text-amber-700">Pendente: {c.pendencies.join(", ")}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${meta.tone}`}>
                    <Icon size={14} /> {meta.label}
                  </span>
                  <Link
                    to="/admin/dre"
                    state={{ month: c.competence }}
                    className="rounded-lg bg-forest-950/5 px-3 py-1.5 text-xs font-bold text-forest-800 hover:bg-forest-950/10"
                  >
                    Ver DRE
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
