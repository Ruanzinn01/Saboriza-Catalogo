import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, LayoutGrid, PauseCircle, PlayCircle } from "lucide-react";
import { usePlatformStore } from "@/store/platform-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30",
  SUSPENSA: "bg-red-400/15 text-red-300 border border-red-400/30",
};

export function PlatformCompanyDetailPage() {
  const { companyId } = useParams();
  const detail = usePlatformStore((s) => s.detail);
  const status = usePlatformStore((s) => s.detailStatus);
  const fetchCompanyDetail = usePlatformStore((s) => s.fetchCompanyDetail);
  const setCompanyStatus = usePlatformStore((s) => s.setCompanyStatus);
  const myEmail = useAdminAuthStore((s) => s.session?.user.email ?? "");
  const [togglingStatus, setTogglingStatus] = useState(false);

  useEffect(() => {
    if (companyId) fetchCompanyDetail(companyId);
  }, [companyId, fetchCompanyDetail]);

  async function handleToggleStatus() {
    if (!companyId || !detail) return;
    const next = detail.status === "ACTIVE" ? "SUSPENSA" : "ACTIVE";
    const confirmMsg = next === "SUSPENSA" ? "Suspender esta empresa? Os usuários dela perdem acesso ao painel." : "Reativar esta empresa?";
    if (!confirm(confirmMsg)) return;
    setTogglingStatus(true);
    const err = await setCompanyStatus(companyId, next);
    setTogglingStatus(false);
    if (err) toast.error(err);
    else toast.success(next === "SUSPENSA" ? "Empresa suspensa" : "Empresa reativada");
  }

  if (status === "loading" || status === "idle") return <AdminState variant="loading" message="Carregando empresa..." />;
  if (status === "error" || !detail) return <AdminState variant="error" message="Não foi possível carregar esta empresa." />;

  const isMemberHere = detail.members.some((m) => m.email.toLowerCase() === myEmail.toLowerCase());

  return (
    <div className="flex flex-col gap-6">
      <Link to="/platform" className="flex w-fit items-center gap-1 text-sm text-cream-50/60 hover:text-cream-50">
        <ArrowLeft size={14} /> Voltar para empresas
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-cream-50">{detail.displayName}</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[detail.status] ?? "bg-cream-50/10 text-cream-50/70"}`}>
              {detail.status}
            </span>
          </div>
          <p className="text-sm text-cream-50/60">{detail.legalName ?? "Razão social não informada"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isMemberHere && (
            <Link to="/admin">
              <Button variant="outline" className="border-cream-50/20 text-cream-50 hover:bg-cream-50/10">
                <LayoutGrid size={16} /> Entrar no painel desta empresa
              </Button>
            </Link>
          )}
          <Button
            variant={detail.status === "ACTIVE" ? "outline" : "primary"}
            className={detail.status === "ACTIVE" ? "border-red-400/40 text-red-300 hover:bg-red-400/10" : ""}
            disabled={togglingStatus}
            onClick={() => void handleToggleStatus()}
          >
            {detail.status === "ACTIVE" ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
            {detail.status === "ACTIVE" ? "Suspender empresa" : "Reativar empresa"}
          </Button>
        </div>
      </div>
      {!isMemberHere && (
        <p className="text-xs text-cream-50/40">
          Você não é membro desta empresa, então não dá pra abrir o painel dela ainda — isso depende de um seletor de tenant que não existe hoje.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-cream-50/10 bg-cream-50/5 p-4">
          <p className="text-xs uppercase tracking-wide text-cream-50/50">Status</p>
          <p className="text-lg font-extrabold text-cream-50">{detail.status}</p>
        </div>
        <div className="rounded-3xl border border-cream-50/10 bg-cream-50/5 p-4">
          <p className="text-xs uppercase tracking-wide text-cream-50/50">Documento</p>
          <p className="text-lg font-extrabold text-cream-50">{detail.document ?? "-----"}</p>
        </div>
        <div className="rounded-3xl border border-cream-50/10 bg-cream-50/5 p-4">
          <p className="text-xs uppercase tracking-wide text-cream-50/50">Usuários ativos</p>
          <p className="text-lg font-extrabold text-cream-50">{detail.activeUsers}</p>
        </div>
        <div className="rounded-3xl border border-cream-50/10 bg-cream-50/5 p-4">
          <p className="text-xs uppercase tracking-wide text-cream-50/50">Pedidos no mês</p>
          <p className="text-lg font-extrabold text-cream-50">{detail.ordersThisMonth}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-cream-50/10 bg-cream-50/5">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-cream-50/10 text-xs uppercase tracking-wide text-cream-50/50">
            <tr>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Desde</th>
            </tr>
          </thead>
          <tbody>
            {detail.members.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-cream-50/50">
                  Nenhum usuário nesta empresa.
                </td>
              </tr>
            ) : (
              detail.members.map((m) => (
                <tr key={m.membershipId} className="border-b border-cream-50/5 last:border-none">
                  <td className="px-4 py-3 font-semibold text-cream-50">{m.email}</td>
                  <td className="px-4 py-3 text-cream-50/70">{m.status}</td>
                  <td className="px-4 py-3 text-cream-50/70">{formatDate(m.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
