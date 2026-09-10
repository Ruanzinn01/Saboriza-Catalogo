import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Plus, Search } from "lucide-react";
import { useCustomersStore } from "@/store/customers-store";
import { useOrdersStore } from "@/store/orders-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";

export function CustomersPage() {
  const customers = useCustomersStore((state) => state.customers);
  const status = useCustomersStore((state) => state.status);
  const fetchCustomers = useCustomersStore((state) => state.fetchCustomers);
  const orders = useOrdersStore((state) => state.orders);
  const fetchOrders = useOrdersStore((state) => state.fetchOrders);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchCustomers();
    fetchOrders();
  }, [fetchCustomers, fetchOrders]);

  const orderCountByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((order) => {
      if (!order.customerId) return;
      map.set(order.customerId, (map.get(order.customerId) ?? 0) + 1);
    });
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.companyName, customer.tradeName, customer.cnpj, customer.phone].some((field) =>
        field.toLowerCase().includes(query)
      )
    );
  }, [customers, search]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Clientes</h1>
          <p className="text-sm text-ink-700/60">Clientes B2B cadastrados, reutilizáveis na criação de pedidos.</p>
        </div>
        <Link to="/admin/clientes/novo">
          <Button className="w-full sm:w-auto">
            <Plus size={18} /> Novo cliente
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, empresa, CNPJ ou telefone..."
          className="h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
        />
      </div>

      {status === "loading" && customers.length === 0 ? (
        <AdminState variant="loading" message="Carregando clientes..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar os clientes. Tente recarregar a página." />
      ) : filtered.length === 0 ? (
        <AdminState
          variant="empty"
          message={customers.length === 0 ? "Nenhum cliente cadastrado ainda." : "Nenhum cliente encontrado com esse filtro."}
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-3xl border border-forest-950/10 bg-white lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-700/50">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">CNPJ</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Pedidos</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr key={customer.id} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                    <td className="px-4 py-3">
                      <Link to={`/admin/clientes/${customer.id}`} className="font-semibold text-ink-900 hover:underline">
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-700/70">{customer.companyName}</td>
                    <td className="px-4 py-3 text-ink-700/70">{customer.cnpj || "-----"}</td>
                    <td className="px-4 py-3 text-ink-700/70">{customer.phone}</td>
                    <td className="px-4 py-3 text-ink-700/70">{orderCountByCustomer.get(customer.id) ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <Link
                          to={`/admin/clientes/${customer.id}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5"
                        >
                          <Eye size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.map((customer) => (
              <div key={customer.id} className="rounded-2xl border border-forest-950/10 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/admin/clientes/${customer.id}`} className="min-w-0">
                    <p className="truncate font-extrabold text-forest-950">{customer.name}</p>
                    <p className="text-sm text-ink-700/70">{customer.companyName}</p>
                  </Link>
                  <Link
                    to={`/admin/clientes/${customer.id}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5"
                  >
                    <Eye size={16} />
                  </Link>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-ink-700/60">
                  <span>{customer.phone}</span>
                  <span>{orderCountByCustomer.get(customer.id) ?? 0} pedido(s)</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
