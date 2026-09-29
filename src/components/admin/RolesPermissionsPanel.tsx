import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";
import { useTeamStore } from "@/store/team-store";
import { Button } from "@/components/ui/Button";

const SENSITIVITY_TONE: Record<string, string> = {
  NORMAL: "text-ink-muted",
  SENSITIVE: "text-amber-700",
  CRITICAL: "text-red-700",
};

function groupLabel(prefix: string): string {
  const labels: Record<string, string> = {
    iam: "Usuários e acessos",
    saas: "Empresa e unidades",
    audit: "Auditoria",
    operations: "Fábrica",
    timesheet: "Ponto Óris",
    billing: "Faturamento",
    aportes: "Aportes de sócios",
    despesas: "Despesas",
    receitas: "Receitas",
    patrimonio: "Patrimônio",
    customer_credit: "Crédito de clientes",
  };
  return labels[prefix] ?? prefix;
}

export function RolesPermissionsPanel() {
  const roles = useTeamStore((s) => s.roles);
  const permissions = useTeamStore((s) => s.permissions);
  const fetchRolesCatalog = useTeamStore((s) => s.fetchRolesCatalog);
  const createRole = useTeamStore((s) => s.createRole);
  const saveRolePermissions = useTeamStore((s) => s.saveRolePermissions);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<Set<string>>(new Set());
  const [newRoleName, setNewRoleName] = useState("");
  const [creatingRole, setCreatingRole] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRolesCatalog();
  }, [fetchRolesCatalog]);

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) setSelectedRoleId(roles[0].id);
  }, [roles, selectedRoleId]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  useEffect(() => {
    if (selectedRole) setDraftPermissions(new Set(selectedRole.permissionKeys));
  }, [selectedRole]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof permissions>();
    permissions.forEach((p) => {
      const prefix = p.key.split(".")[0];
      const list = map.get(prefix) ?? [];
      list.push(p);
      map.set(prefix, list);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions]);

  function togglePermission(key: string) {
    setDraftPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleCreateRole() {
    if (!newRoleName.trim()) return;
    setCreatingRole(true);
    const error = await createRole(newRoleName.trim());
    setCreatingRole(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Papel criado");
    setNewRoleName("");
  }

  async function handleSave() {
    if (!selectedRoleId) return;
    setSaving(true);
    const error = await saveRolePermissions(selectedRoleId, [...draftPermissions]);
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Permissões salvas");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRoleId(role.id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                selectedRoleId === role.id ? "bg-forest-950 text-white" : "bg-forest-950/5 text-forest-800"
              }`}
            >
              {role.name}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-end gap-2">
          <input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="Nome do novo papel (ex.: Gerente)"
            className="h-10 rounded-lg border border-ink-900/15 px-3 text-sm"
          />
          <button
            onClick={() => void handleCreateRole()}
            disabled={creatingRole || !newRoleName.trim()}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-forest-950/15 px-3 text-sm font-semibold text-forest-800 hover:bg-forest-950/5"
          >
            <Plus size={16} /> Novo papel
          </button>
        </div>
      </div>

      {selectedRole && (
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-extrabold text-forest-950">Permissões de "{selectedRole.name}"</h3>
            <Button onClick={() => void handleSave()} disabled={saving}>
              <Save size={16} />
              {saving ? "Salvando..." : "Salvar permissões"}
            </Button>
          </div>

          <div className="flex flex-col divide-y divide-forest-950/5">
            {groups.map(([prefix, items]) => (
              <div key={prefix} className="py-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{groupLabel(prefix)}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {items.map((perm) => (
                    <label key={perm.key} className="flex items-start gap-2 rounded-lg p-2 text-sm hover:bg-forest-950/5">
                      <input
                        type="checkbox"
                        checked={draftPermissions.has(perm.key)}
                        onChange={() => togglePermission(perm.key)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-semibold text-ink-900">{perm.name}</span>{" "}
                        <span className={`text-xs ${SENSITIVITY_TONE[perm.sensitivity] ?? ""}`}>({perm.sensitivity})</span>
                        <br />
                        <span className="text-xs text-ink-700/70">{perm.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
