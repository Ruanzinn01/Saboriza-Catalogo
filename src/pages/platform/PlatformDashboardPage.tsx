import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Building2, Plus, Search, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { usePlatformStore } from "@/store/platform-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30",
  SUSPENSA: "bg-red-400/15 text-red-300 border border-red-400/30",
};

function StatCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-4 rounded-3xl border border-cream-50/10 bg-cream-50/[0.04] p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-500/15 text-gold-400">
        <Icon size={20} />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-cream-50/50">{label}</p>
        <p className="text-2xl font-extrabold text-cream-50">{value}</p>
      </div>
    </div>
  );
}

function NewCompanyForm({ onDone }: { onDone: () => void }) {
  const createCompany = usePlatformStore((s) => s.createCompany);
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [document, setDocument] = useState("");
  const [segment, setSegment] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!displayName.trim()) {
      toast.error("Nome da empresa é obrigatório");
      return;
    }
    setSaving(true);
    const err = await createCompany({ displayName, legalName, document, segment });
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Empresa criada");
    setDisplayName("");
    setLegalName("");
    setDocument("");
    setSegment("");
    onDone();
  }

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-cream-50/10 bg-cream-50/[0.04] p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-cream-50/80">
          Nome fantasia
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-11 rounded-xl border border-cream-50/15 bg-transparent px-3 text-sm text-cream-50 outline-none focus:border-gold-400"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-cream-50/80">
          Razão social (opcional)
          <input
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            className="h-11 rounded-xl border border-cream-50/15 bg-transparent px-3 text-sm text-cream-50 outline-none focus:border-gold-400"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-cream-50/80">
          CNPJ (opcional)
          <input
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            className="h-11 rounded-xl border border-cream-50/15 bg-transparent px-3 text-sm text-cream-50 outline-none focus:border-gold-400"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-cream-50/80">
          Segmento
          <input
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            placeholder="Ex: Alimentação"
            className="h-11 rounded-xl border border-cream-50/15 bg-transparent px-3 text-sm text-cream-50 outline-none focus:border-gold-400"
          />
        </label>
      </div>
      <Button onClick={() => void submit()} disabled={saving} className="self-start">
        {saving ? "Criando..." : "Criar empresa"}
      </Button>
    </div>
  );
}

export function PlatformDashboardPage() {
  const companies = usePlatformStore((s) => s.companies);
  const status = usePlatformStore((s) => s.listStatus);
  const fetchCompanies = usePlatformStore((s) => s.fetchCompanies);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.displayName.toLowerCase().includes(q));
  }, [companies, search]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-cream-50">Empresas na plataforma</h1>
          <p className="text-sm text-cream-50/60">Visão geral de todos os tenants do Oris360.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setShowForm((v) => !v)}>
          <Plus size={18} /> Nova empresa
        </Button>
      </div>

      {showForm && <NewCompanyForm onDone={() => setShowForm(false)} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Building2} label="Total de empresas" value={companies.length} />
        <StatCard icon={Users} label="Usuários ativos (soma)" value={companies.reduce((s, c) => s + c.activeUsers, 0)} />
        <StatCard icon={TrendingUp} label="Pedidos no mês (soma)" value={companies.reduce((s, c) => s + c.ordersThisMonth, 0)} />
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cream-50/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empresa..."
          className="h-11 w-full rounded-xl border border-cream-50/15 bg-cream-50/[0.04] pl-11 pr-4 text-sm text-cream-50 outline-none focus:border-gold-400"
        />
      </div>

      {status === "loading" && companies.length === 0 ? (
        <AdminState variant="loading" message="Carregando empresas..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar as empresas." onRetry={fetchCompanies} />
      ) : filtered.length === 0 ? (
        <AdminState variant="empty" message={search ? "Nenhuma empresa encontrada com esse filtro." : "Nenhuma empresa cadastrada ainda."} />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-cream-50/10 bg-cream-50/[0.04]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-cream-50/10 text-xs uppercase tracking-wide text-cream-50/50">
              <tr>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Usuários ativos</th>
                <th className="px-4 py-3">Pedidos no mês</th>
                <th className="px-4 py-3">Criada em</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-cream-50/5 last:border-none hover:bg-cream-50/5">
                  <td className="px-4 py-3 font-semibold text-cream-50">
                    <Link to={`/platform/empresas/${c.id}`} className="flex items-center gap-3 hover:underline">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-gold-400">
                        <Building2 size={15} />
                      </span>
                      {c.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[c.status] ?? "bg-cream-50/10 text-cream-50/70"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cream-50/70">{c.activeUsers}</td>
                  <td className="px-4 py-3 text-cream-50/70">{c.ordersThisMonth}</td>
                  <td className="px-4 py-3 text-cream-50/70">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-cream-50/40">
        <ShieldCheck size={13} /> Acesso restrito a administradores da plataforma.
      </p>
    </div>
  );
}
