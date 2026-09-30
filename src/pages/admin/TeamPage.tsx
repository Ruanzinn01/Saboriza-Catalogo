import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, ShieldOff } from "lucide-react";
import { useTeamStore } from "@/store/team-store";
import { useEmployeesStore } from "@/store/employees-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  INVITED: "Convite pendente",
  SUSPENDED: "Suspenso",
  ENDED: "Encerrado",
};

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  INVITED: "bg-gold-500/20 text-gold-700",
  SUSPENDED: "bg-amber-100 text-amber-800",
  ENDED: "bg-ink-900/10 text-ink-muted",
};

function InviteForm({ onDone }: { onDone: () => void }) {
  const roles = useTeamStore((state) => state.roles);
  const inviteMember = useTeamStore((state) => state.inviteMember);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!email || !roleId) return;
    setSaving(true);
    const error = await inviteMember(email, roleId);
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Convite enviado");
    setEmail("");
    onDone();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-forest-950/10 bg-white p-4 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm text-ink-900">
        E-mail
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="pessoa@empresa.com"
          className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm outline-none focus:border-forest-700"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-900">
        Papel
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm outline-none focus:border-forest-700"
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </label>
      <Button onClick={() => void submit()} disabled={!email || !roleId || saving}>
        {saving ? "Enviando..." : "Enviar convite"}
      </Button>
    </div>
  );
}

export function TeamPage() {
  const members = useTeamStore((state) => state.members);
  const roles = useTeamStore((state) => state.roles);
  const status = useTeamStore((state) => state.status);
  const fetchTeam = useTeamStore((state) => state.fetchTeam);
  const revokeMember = useTeamStore((state) => state.revokeMember);
  const updateMemberRole = useTeamStore((state) => state.updateMemberRole);
  const employees = useEmployeesStore((state) => state.employees);
  const fetchEmployees = useEmployeesStore((state) => state.fetchEmployees);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  useEffect(() => {
    if (employees.length === 0) fetchEmployees();
  }, [employees.length, fetchEmployees]);

  function employeeIdForEmail(email: string) {
    return employees.find((e) => e.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
  }

  async function handleRevoke(membershipId: string) {
    if (!confirm("Revogar o acesso deste usuário?")) return;
    const error = await revokeMember(membershipId);
    if (error) toast.error(error);
    else toast.success("Acesso revogado");
  }

  async function handleRoleChange(membershipId: string, roleId: string) {
    const error = await updateMemberRole(membershipId, roleId);
    if (error) toast.error(error);
    else toast.success("Papel atualizado");
  }

  function currentRoleId(member: { roleNames: string[] }) {
    return roles.find((r) => member.roleNames.includes(r.name))?.id ?? "";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Usuários</h1>
          <p className="text-sm text-ink-muted">Quem tem acesso ao painel da sua empresa.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setShowInvite((v) => !v)}>
          <Plus size={18} /> Convidar usuário
        </Button>
      </div>

      {showInvite && <InviteForm onDone={() => setShowInvite(false)} />}

      {status === "loading" && members.length === 0 ? (
        <AdminState variant="loading" message="Carregando usuários..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar os usuários. Tente recarregar a página." />
      ) : members.length === 0 ? (
        <AdminState variant="empty" message="Nenhum usuário além de você por enquanto." />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-3xl border border-forest-950/10 bg-white lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Papel</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const employeeId = employeeIdForEmail(member.email);
                  return (
                  <tr key={member.membershipId} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                    <td className="px-4 py-3 font-semibold text-ink-900">
                      {employeeId ? (
                        <Link to={`/admin/colaboradores/${employeeId}`} className="hover:underline">
                          {member.email}
                        </Link>
                      ) : (
                        member.email
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {member.status === "ENDED" ? (
                        <span className="text-ink-700/70">{member.roleNames.join(", ") || "-----"}</span>
                      ) : (
                        <select
                          value={currentRoleId(member)}
                          onChange={(e) => void handleRoleChange(member.membershipId, e.target.value)}
                          className="h-9 rounded-lg border border-ink-900/15 px-2 text-sm"
                        >
                          <option value="" disabled>
                            {member.roleNames.join(", ") || "Selecionar"}
                          </option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[member.status] ?? ""}`}>
                        {STATUS_LABELS[member.status] ?? member.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {member.status !== "ENDED" && (
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => void handleRevoke(member.membershipId)}
                            aria-label="Revogar acesso"
                            className="flex h-9 w-9 items-center justify-center rounded-full text-red-700 hover:bg-red-50"
                          >
                            <ShieldOff size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 lg:hidden">
            {members.map((member) => {
              const employeeId = employeeIdForEmail(member.email);
              return (
              <div key={member.membershipId} className="rounded-2xl border border-forest-950/10 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-forest-950">
                      {employeeId ? (
                        <Link to={`/admin/colaboradores/${employeeId}`} className="hover:underline">
                          {member.email}
                        </Link>
                      ) : (
                        member.email
                      )}
                    </p>
                    <p className="text-sm text-ink-700/70">{member.roleNames.join(", ") || "-----"}</p>
                  </div>
                  {member.status !== "ENDED" && (
                    <button
                      onClick={() => void handleRevoke(member.membershipId)}
                      aria-label="Revogar acesso"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-red-700 hover:bg-red-50"
                    >
                      <ShieldOff size={16} />
                    </button>
                  )}
                </div>
                <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[member.status] ?? ""}`}>
                  {STATUS_LABELS[member.status] ?? member.status}
                </span>
              </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
