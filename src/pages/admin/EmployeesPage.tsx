import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, UserCheck } from "lucide-react";
import { useEmployeesStore } from "@/store/employees-store";
import { AdminState } from "@/components/admin/AdminState";
import { Pagination } from "@/components/admin/Pagination";
import { Button } from "@/components/ui/Button";
import { paginate } from "@/lib/pagination";
import { useRefreshOnFocus } from "@/lib/use-refresh-on-focus";
import { formatCpf } from "@/types/employee";

const selectClasses =
  "h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700 xl:h-12";

export function EmployeesPage() {
  const employees = useEmployeesStore((state) => state.employees);
  const status = useEmployeesStore((state) => state.status);
  const fetchEmployees = useEmployeesStore((state) => state.fetchEmployees);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ATIVO" | "INATIVO">("ATIVO");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRefreshOnFocus(() => void fetchEmployees());

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((employee) => {
      if (statusFilter !== "all" && employee.status !== statusFilter) return false;
      if (!term) return true;
      return (
        employee.name.toLowerCase().includes(term) ||
        employee.code.toLowerCase().includes(term) ||
        formatCpf(employee.cpf).includes(term) ||
        employee.role.toLowerCase().includes(term)
      );
    });
  }, [employees, search, statusFilter]);

  const pageData = paginate(visible, page, pageSize);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950 sm:text-3xl">Colaboradores</h1>
          <p className="text-sm text-ink-muted">Cadastro laboral central — identidade e vínculo dos colaboradores da empresa.</p>
        </div>
        <Link to="/admin/colaboradores/novo">
          <Button size="lg">
            <Plus size={18} /> Novo colaborador
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="relative flex-1">
          <label htmlFor="colaboradores-busca" className="sr-only">
            Buscar por nome, matrícula, CPF ou cargo
          </label>
          <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            id="colaboradores-busca"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome, matrícula, CPF ou cargo..."
            className="h-12 w-full rounded-xl border border-ink-900/15 bg-white pl-12 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          />
        </div>
        <select
          aria-label="Situação"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            setPage(1);
          }}
          className={selectClasses}
        >
          <option value="ATIVO">Ativos</option>
          <option value="INATIVO">Inativos</option>
          <option value="all">Todos</option>
        </select>
      </div>

      {status === "loading" && employees.length === 0 ? (
        <AdminState variant="loading" message="Carregando colaboradores..." />
      ) : status === "error" && employees.length === 0 ? (
        <AdminState variant="error" message="Não foi possível carregar os colaboradores." onRetry={fetchEmployees} />
      ) : pageData.items.length === 0 ? (
        <AdminState
          variant="empty"
          message={employees.length === 0 ? "Nenhum colaborador cadastrado ainda." : "Nenhum colaborador encontrado com esse filtro."}
        />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-forest-950/10 bg-white">
          <table className="hidden w-full text-sm md:table">
            <thead className="border-b border-forest-950/10 bg-forest-950/[0.03] text-left text-xs font-bold uppercase tracking-wide text-ink-700">
              <tr>
                <th className="px-4 py-3">Colaborador</th>
                <th className="px-4 py-3">Matrícula</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-950/5">
              {pageData.items.map((employee) => (
                <tr key={employee.id} className="hover:bg-forest-950/[0.02]">
                  <td className="px-4 py-3">
                    <Link to={`/admin/colaboradores/${employee.id}`} className="flex items-center gap-3 font-semibold text-forest-900 hover:underline">
                      {employee.photoUrl ? (
                        <img src={employee.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-950/10 text-forest-700">
                          <UserCheck size={14} />
                        </span>
                      )}
                      {employee.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{employee.code}</td>
                  <td className="px-4 py-3 text-ink-700">{employee.role || "—"}</td>
                  <td className="px-4 py-3 text-ink-700">{employee.cpf ? formatCpf(employee.cpf) : "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        employee.status === "ATIVO" ? "bg-forest-700/10 text-forest-800" : "bg-ink-900/5 text-ink-700"
                      }`}
                    >
                      {employee.status === "ATIVO" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="divide-y divide-forest-950/5 md:hidden">
            {pageData.items.map((employee) => (
              <li key={employee.id}>
                <Link to={`/admin/colaboradores/${employee.id}`} className="flex items-center gap-3 px-4 py-3">
                  {employee.photoUrl ? (
                    <img src={employee.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-950/10 text-forest-700">
                      <UserCheck size={16} />
                    </span>
                  )}
                  <span className="flex-1">
                    <span className="block font-semibold text-forest-900">{employee.name}</span>
                    <span className="block text-xs text-ink-muted">
                      {employee.code} · {employee.role || "sem cargo"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={pageData.page}
            totalPages={pageData.totalPages}
            pageSize={pageSize}
            total={visible.length}
            itemLabel="colaboradores"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
