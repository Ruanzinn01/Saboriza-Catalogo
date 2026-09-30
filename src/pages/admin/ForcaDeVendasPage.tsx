import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useVendasStore } from "@/store/vendas-store";
import { AdminState } from "@/components/admin/AdminState";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString("pt-BR");

const STATUS_TONE: Record<string, string> = {
  PREVISTA: "bg-amber-100 text-amber-800",
  REALIZADA: "bg-emerald-100 text-emerald-800",
};

function SellersPanel() {
  const sellers = useVendasStore((s) => s.sellers);
  const fetchSellers = useVendasStore((s) => s.fetchSellers);
  const updateCommissionRate = useVendasStore((s) => s.updateCommissionRate);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftRate, setDraftRate] = useState("");

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  async function saveRate(employeeId: string) {
    const value = draftRate.trim() === "" ? null : Number(draftRate);
    if (value !== null && (Number.isNaN(value) || value < 0)) {
      toast.error("Informe uma taxa válida");
      return;
    }
    const ok = await updateCommissionRate(employeeId, value);
    if (ok) setEditingId(null);
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-4 py-3">Colaborador</th>
            <th className="px-4 py-3">Taxa de comissão</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {sellers.map((seller) => (
            <tr key={seller.id} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
              <td className="px-4 py-3 font-semibold text-ink-900">
                <Link to={`/admin/colaboradores/${seller.id}`} className="hover:underline">
                  {seller.name}
                </Link>
              </td>
              <td className="px-4 py-3">
                {editingId === seller.id ? (
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    autoFocus
                    value={draftRate}
                    onChange={(e) => setDraftRate(e.target.value)}
                    onBlur={() => void saveRate(seller.id)}
                    onKeyDown={(e) => e.key === "Enter" && void saveRate(seller.id)}
                    className="h-11 w-24 rounded-xl border border-ink-900/15 px-3 text-sm"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(seller.id);
                      setDraftRate(seller.commissionRatePercent?.toString() ?? "");
                    }}
                    className="flex h-11 items-center rounded-xl px-2 text-sm font-semibold text-ink-900 hover:bg-forest-950/5"
                  >
                    {seller.commissionRatePercent ? `${seller.commissionRatePercent}%` : "Definir taxa"}
                  </button>
                )}
              </td>
              <td className="px-4 py-3" />
            </tr>
          ))}
          {sellers.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-sm text-ink-muted">
                Nenhum colaborador ativo cadastrado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CommissionsPanel() {
  const sellers = useVendasStore((s) => s.sellers);
  const commissions = useVendasStore((s) => s.commissions);
  const status = useVendasStore((s) => s.status);
  const fetchCommissions = useVendasStore((s) => s.fetchCommissions);
  const [employeeFilter, setEmployeeFilter] = useState("");

  useEffect(() => {
    fetchCommissions(employeeFilter ? { employeeId: employeeFilter } : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeFilter]);

  const totalPrevista = commissions.filter((c) => c.status === "PREVISTA").reduce((sum, c) => sum + c.commissionAmount, 0);
  const totalRealizada = commissions.filter((c) => c.status === "REALIZADA").reduce((sum, c) => sum + c.commissionAmount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Comissão prevista</p>
          <p className="text-xl font-extrabold text-amber-700">{brl(totalPrevista)}</p>
        </div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Comissão realizada</p>
          <p className="text-xl font-extrabold text-emerald-700">{brl(totalRealizada)}</p>
        </div>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Filtrar por vendedor
          <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm">
            <option value="">Todos</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>

      {status === "loading" && commissions.length === 0 ? (
        <AdminState variant="loading" message="Carregando comissões..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar as comissões." />
      ) : commissions.length === 0 ? (
        <AdminState variant="empty" message="Nenhuma comissão prevista ainda. Defina um vendedor e uma taxa de comissão nos pedidos faturados." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Valor da venda</th>
                <th className="px-4 py-3">Comissão</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                  <td className="px-4 py-3 font-semibold text-ink-900">
                    <Link to={`/admin/colaboradores/${c.employeeId}`} className="hover:underline">{c.employeeName}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/pedidos/${c.orderId}`} className="text-forest-800 hover:underline">{c.orderNumber}</Link>
                  </td>
                  <td className="px-4 py-3 text-ink-700/70">{c.customerName}</td>
                  <td className="px-4 py-3 text-ink-700/70">{brDate(c.dueDate)}</td>
                  <td className="px-4 py-3 text-ink-700/70">{brl(c.saleAmount)}</td>
                  <td className="px-4 py-3 font-bold text-ink-900">{brl(c.commissionAmount)} <span className="text-xs font-normal text-ink-muted">({c.commissionRate}%)</span></td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[c.status]}`}>{c.status === "PREVISTA" ? "Prevista" : "Realizada"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ForcaDeVendasPage() {
  const [tab, setTab] = useState<"comissoes" | "vendedores">("comissoes");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Força de Vendas</h1>
        <p className="text-sm text-ink-muted">Comissões previstas e realizadas por vendedor, vinculadas ao faturamento de cada pedido.</p>
      </div>

      <div className="flex gap-2 rounded-full border border-forest-950/10 bg-white p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("comissoes")}
          className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors ${tab === "comissoes" ? "bg-forest-950 text-cream-50" : "text-ink-700/70"}`}
        >
          Comissões
        </button>
        <button
          type="button"
          onClick={() => setTab("vendedores")}
          className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors ${tab === "vendedores" ? "bg-forest-950 text-cream-50" : "text-ink-700/70"}`}
        >
          Vendedores e taxas
        </button>
      </div>

      {tab === "comissoes" ? <CommissionsPanel /> : <SellersPanel />}
    </div>
  );
}
