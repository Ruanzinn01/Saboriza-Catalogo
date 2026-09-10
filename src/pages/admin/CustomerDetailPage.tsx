import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useCustomersStore } from "@/store/customers-store";
import { useOrdersStore } from "@/store/orders-store";
import { AdminState } from "@/components/admin/AdminState";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { OrderDetailSheet } from "@/components/admin/OrderDetailSheet";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/currency";

function formatOrderDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function CustomerDetailPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const customers = useCustomersStore((state) => state.customers);
  const status = useCustomersStore((state) => state.status);
  const fetchCustomers = useCustomersStore((state) => state.fetchCustomers);
  const deleteCustomer = useCustomersStore((state) => state.deleteCustomer);
  const orders = useOrdersStore((state) => state.orders);
  const fetchOrders = useOrdersStore((state) => state.fetchOrders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState(false);

  useEffect(() => {
    if (customers.length === 0) fetchCustomers();
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customer = customers.find((item) => item.id === customerId);
  const customerOrders = useMemo(
    () => orders.filter((order) => order.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders, customerId]
  );
  const selectedOrder = customerOrders.find((order) => order.id === selectedOrderId) ?? null;

  const summary = useMemo(() => {
    const total = customerOrders.reduce((sum, order) => sum + order.total, 0);
    return {
      count: customerOrders.length,
      total,
      lastOrderAt: customerOrders[0]?.createdAt ?? null,
    };
  }, [customerOrders]);

  async function handleDelete() {
    if (!customer) return;
    const result = await deleteCustomer(customer.id);
    if (result.blocked) {
      setDeleteBlocked(true);
      return;
    }
    if (result.ok) navigate("/admin/clientes");
  }

  if (status === "loading" && !customer) {
    return <AdminState variant="loading" message="Carregando cliente..." />;
  }

  if (!customer) {
    return <AdminState variant="empty" message="Cliente não encontrado." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/admin/clientes" className="flex w-fit items-center gap-2 text-sm font-semibold text-ink-700/70 hover:text-ink-900">
        <ArrowLeft size={16} /> Voltar para Clientes
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">{customer.name}</h1>
          <p className="text-sm text-ink-700/60">{customer.companyName}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/admin/clientes/${customer.id}/editar`}>
            <Button variant="outline">
              <Pencil size={16} /> Editar
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setConfirmingDelete(true)}>
            <Trash2 size={16} /> Excluir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">Pedidos</p>
          <p className="text-xl font-extrabold text-forest-950">{summary.count}</p>
        </div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">Total comprado</p>
          <p className="text-xl font-extrabold text-forest-950">{formatCurrency(summary.total)}</p>
        </div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">Último pedido</p>
          <p className="text-xl font-extrabold text-forest-950">{summary.lastOrderAt ? formatOrderDate(summary.lastOrderAt) : "-----"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-3xl border border-forest-950/10 bg-white p-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-700/50">Dados do cliente</p>
          <p className="text-sm text-ink-700/70">Telefone: <span className="font-semibold text-ink-900">{customer.phone}</span></p>
          <p className="text-sm text-ink-700/70">E-mail: <span className="font-semibold text-ink-900">{customer.email || "-----"}</span></p>
          <p className="text-sm text-ink-700/70">Nome fantasia: <span className="font-semibold text-ink-900">{customer.tradeName || "-----"}</span></p>
          <p className="text-sm text-ink-700/70">CNPJ: <span className="font-semibold text-ink-900">{customer.cnpj || "-----"}</span></p>
          <p className="text-sm text-ink-700/70">Inscrição estadual: <span className="font-semibold text-ink-900">{customer.ie || "-----"}</span></p>
          <p className="text-sm text-ink-700/70">
            Endereço: <span className="font-semibold text-ink-900">{customer.address || "-----"}</span>
          </p>
          <p className="text-sm text-ink-700/70">
            {customer.neighborhood || "-----"} · {customer.city || "-----"}/{customer.state || "--"} · {customer.cep || "-----"}
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-3xl border border-forest-950/10 bg-white p-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-700/50">Histórico de pedidos</p>
          {customerOrders.length === 0 ? (
            <p className="text-sm text-ink-700/60">Este cliente ainda não tem pedidos.</p>
          ) : (
            <div className="flex flex-col divide-y divide-forest-950/5">
              {customerOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className="flex items-center justify-between gap-3 py-3 text-left hover:bg-forest-950/5"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{order.number}</p>
                    <p className="text-xs text-ink-700/60">{formatOrderDate(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-ink-900">{formatCurrency(order.total)}</span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <OrderDetailSheet order={selectedOrder} onClose={() => setSelectedOrderId(null)} />

      {deleteBlocked ? (
        <ConfirmDialog
          open
          onClose={() => setDeleteBlocked(false)}
          title="Não é possível excluir este cliente"
          description="Este cliente possui pedidos no histórico e não pode ser excluído."
          cancelLabel="Fechar"
        />
      ) : (
        <ConfirmDialog
          open={confirmingDelete}
          onClose={() => setConfirmingDelete(false)}
          title="Excluir cliente?"
          description={
            <>
              <strong className="text-ink-900">{customer.name}</strong> será removido do cadastro. Essa ação não pode ser desfeita.
            </>
          }
          confirmLabel="Excluir"
          destructive
          onConfirm={() => {
            setConfirmingDelete(false);
            void handleDelete();
          }}
        />
      )}
    </div>
  );
}
