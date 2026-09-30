import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Archive } from "lucide-react";
import { usePatrimonioStore } from "@/store/patrimonio-store";
import { useEmployeesStore } from "@/store/employees-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_TONE: Record<string, string> = {
  ATIVO: "bg-emerald-100 text-emerald-800",
  BAIXADO: "bg-ink-900/10 text-ink-muted",
};

function NewAssetForm({ onDone }: { onDone: () => void }) {
  const createAsset = usePatrimonioStore((s) => s.createAsset);
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const [modelName, setModelName] = useState("");
  const [category, setCategory] = useState("OUTRO");
  const [acquisitionValue, setAcquisitionValue] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employees.length === 0) fetchEmployees();
  }, [employees.length, fetchEmployees]);

  async function submit() {
    if (!modelName || !acquisitionValue) {
      toast.error("Preencha nome do bem e valor de aquisição");
      return;
    }
    setSaving(true);
    const err = await createAsset({
      modelName,
      category,
      acquisitionValue: Number(acquisitionValue),
      acquisitionDate: acquisitionDate || undefined,
      responsibleId: responsibleId || undefined,
    });
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Bem cadastrado");
    onDone();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-forest-950/10 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Nome do bem
          <input value={modelName} onChange={(e) => setModelName(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Categoria
          <input value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Valor de aquisição
          <input type="number" value={acquisitionValue} onChange={(e) => setAcquisitionValue(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Data de aquisição
          <input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Responsável (opcional)
          <select value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm">
            <option value="">-----</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
      </div>
      <Button onClick={() => void submit()} disabled={saving} className="self-start">
        {saving ? "Salvando..." : "Cadastrar bem"}
      </Button>
    </div>
  );
}

export function PatrimonioPage() {
  const assets = usePatrimonioStore((s) => s.assets);
  const status = usePatrimonioStore((s) => s.status);
  const fetchAll = usePatrimonioStore((s) => s.fetchAll);
  const writeOffAsset = usePatrimonioStore((s) => s.writeOffAsset);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleWriteOff(id: string) {
    const err = await writeOffAsset(id);
    if (err) toast.error(err);
    else toast.success("Bem baixado");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Patrimônio</h1>
          <p className="text-sm text-ink-muted">Cadastro de bens da empresa e seus responsáveis.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setShowForm((v) => !v)}>
          <Plus size={18} /> Novo bem
        </Button>
      </div>

      {showForm && <NewAssetForm onDone={() => setShowForm(false)} />}

      {status === "loading" && assets.length === 0 ? (
        <AdminState variant="loading" message="Carregando patrimônio..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar o patrimônio." />
      ) : assets.length === 0 ? (
        <AdminState variant="empty" message="Nenhum bem cadastrado ainda." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Bem</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                  <td className="px-4 py-3 font-semibold text-ink-900">{a.modelName}</td>
                  <td className="px-4 py-3 text-ink-700/70">{a.category}</td>
                  <td className="px-4 py-3 font-semibold text-ink-900">{brl(a.acquisitionValue)}</td>
                  <td className="px-4 py-3 text-ink-700/70">{a.responsibleName ?? "-----"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[a.status]}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {a.status !== "BAIXADO" && (
                      <button
                        onClick={() => void handleWriteOff(a.id)}
                        aria-label="Dar baixa no bem"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-red-700 hover:bg-red-50"
                      >
                        <Archive size={16} />
                      </button>
                    )}
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
