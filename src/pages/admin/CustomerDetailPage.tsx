import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useOrdersStore } from "@/store/orders-store";
import { AdminState } from "@/components/admin/AdminState";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { CustomerCreditPanel } from "@/components/admin/CustomerCreditPanel";
import {
  Card,
  CustomerHeaderCard,
  OpenTitlesCard,
  PaymentHistoryCard,
  PhotosCard,
  ProductsCard,
  PurchasesCard,
  RecentActivityCard,
  UnavailableCard,
} from "@/components/admin/CustomerDetailParts";
import { formatCurrency } from "@/lib/currency";
import {
  fetchCommercialSummary,
  fetchCustomerProfile,
  fetchReceivablesView,
  setCustomerStatus,
  signedPhotoUrls,
  type ApiResult,
  type CommercialSummary,
  type CustomerFullProfile,
  type PurchasePeriod,
  type ReceivablesView,
} from "@/lib/customers-api";
import type { PaymentFilter } from "@/lib/customer-detail";
import { formatDate } from "@/lib/customers-list";

const PRODUCTS_PAGE = 10;

export function CustomerDetailPage() {
  const { customerId = "" } = useParams();
  const location = useLocation();
  const listSearch = (location.state as { listSearch?: string } | null)?.listSearch ?? "";
  const orders = useOrdersStore((state) => state.orders);
  const fetchOrders = useOrdersStore((state) => state.fetchOrders);

  const [profile, setProfile] = useState<ApiResult<CustomerFullProfile | null> | null>(null);
  const [period, setPeriod] = useState<PurchasePeriod>("six");
  const [summary, setSummary] = useState<ApiResult<CommercialSummary> | null>(null);
  const [receivables, setReceivables] = useState<ApiResult<ReceivablesView> | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [reason, setReason] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [timelineAll, setTimelineAll] = useState(false);
  const summaryTicket = useRef(0);

  const loadProfile = useCallback(async () => {
    const result = await fetchCustomerProfile(customerId);
    setProfile(result);
    if (result.state === "ready" && result.data) {
      void signedPhotoUrls(result.data.media.map((m) => m.storage_path)).then(setPhotoUrls);
    }
  }, [customerId]);

  useEffect(() => {
    setProfile(null);
    setReceivables(null);
    void loadProfile();
    void fetchReceivablesView(customerId).then(setReceivables);
    void fetchOrders();
  }, [customerId, loadProfile, fetchOrders]);

  useEffect(() => {
    const ticket = ++summaryTicket.current;
    setSummary(null);
    void fetchCommercialSummary(customerId, period, PRODUCTS_PAGE, 0).then((result) => {
      if (ticket === summaryTicket.current) setSummary(result);
    });
  }, [customerId, period]);

  async function loadMoreProducts() {
    if (summary?.state !== "ready") return;
    setLoadingMore(true);
    const offset = summary.data.products.length;
    const next = await fetchCommercialSummary(customerId, period, PRODUCTS_PAGE, offset);
    setLoadingMore(false);
    if (next.state !== "ready") {
      toast.error("Não foi possível carregar mais produtos.");
      return;
    }
    setSummary({ state: "ready", data: { ...summary.data, products: [...summary.data.products, ...next.data.products] } });
  }

  const customerOrders = useMemo(
    () => orders.filter((order) => order.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders, customerId]
  );

  const ordersOfMonth = useCallback(
    (key: string) =>
      customerOrders
        .filter((order) => order.status !== "CANCELLED" && order.createdAt.startsWith(key))
        .map((order) => ({ id: order.id, number: order.number, date: formatDate(order.createdAt), total: order.total, status: <OrderStatusBadge status={order.status} /> })),
    [customerOrders]
  );

  async function confirmStatusChange() {
    if (profile?.state !== "ready" || !profile.data) return;
    const current = profile.data.customer;
    const target = current.registration_status === "ATIVO" ? "INATIVO" : "ATIVO";
    setStatusBusy(true);
    const result = await setCustomerStatus({ commandId: crypto.randomUUID(), customerId: current.id, status: target, reason: reason.trim(), expectedRevision: current.revision });
    setStatusBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(target === "INATIVO" ? "Cadastro inativado. Pedidos e histórico foram preservados." : "Cadastro reativado.");
    setStatusDialog(false);
    setReason("");
    await loadProfile();
  }

  const backTo = `/admin/clientes${listSearch}`;

  if (profile === null) return <AdminState variant="loading" message="Carregando cliente..." />;
  if (profile.state === "error") return <AdminState variant="error" message={`Não foi possível carregar o cliente: ${profile.message}`} onRetry={() => void loadProfile()} />;
  if (profile.state !== "ready" || !profile.data) return <AdminState variant="empty" message="Cliente não encontrado." />;

  const data = profile.data;
  const inactive = data.customer.registration_status === "INATIVO";
  const visibleOrders = timelineAll ? customerOrders : customerOrders.slice(0, 5);
  const canSubmitReason = reason.trim().length >= 5;

  return (
    <div className="flex flex-col gap-6">
      <Link to={backTo} className="flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-ink-700/70 hover:text-ink-900">
        <ArrowLeft size={16} /> Voltar para Clientes
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <CustomerHeaderCard
            profile={data}
            onEdit={`/admin/clientes/${data.customer.id}/editar`}
            newOrderTo={inactive ? null : `/admin/pedidos/novo?cliente=${data.customer.id}`}
            onToggleStatus={() => setStatusDialog(true)}
            statusBusy={statusBusy}
          />
          <RecentActivityCard summary={summary} />
          <UnavailableCard title="Visitas realizadas nos últimos 12 meses">
            Quatro janelas de três meses com barras de vendedor e promotor dependem do registro oficial de visitas (motor de Tarefas/Missões), que ainda não está integrado a esta tela. Nenhuma contagem é estimada.
          </UnavailableCard>
          <UnavailableCard title="Tarefas e próximos contatos">
            As próximas tarefas e visitas, a criação de tarefa e de roteiro e a programação completa dependem do motor de Tarefas/Missões. O botão de criar fica oculto até a integração existir, para não gravar nada paralelo.
          </UnavailableCard>
          <UnavailableCard title="Cumprimento dos roteiros">
            O percentual por pessoa e função, com realizados no prazo, atrasados e pendentes, mede a execução oficial da missão e exige o mesmo motor. Sem fonte, não há percentual (nunca 100%).
          </UnavailableCard>

          <Card
            title="Pedidos e atividades"
            action={
              <Link to={inactive ? "#" : `/admin/pedidos/novo?cliente=${data.customer.id}`} aria-disabled={inactive} className="inline-flex h-11 items-center rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 px-4 text-sm font-semibold text-forest-950 aria-disabled:pointer-events-none aria-disabled:opacity-50">
                Criar pedido
              </Link>
            }
          >
            <p className="mb-3 text-xs text-ink-muted">Linha do tempo de pedidos, mais recentes primeiro. Visitas, contatos e tarefas concluídas aparecerão aqui quando a fonte oficial existir.</p>
            {customerOrders.length === 0 ? <p className="text-sm text-ink-muted">Este cliente ainda não tem pedidos.</p> : (
              <ul className="divide-y divide-forest-950/10">
                {visibleOrders.map((order) => (
                  <li key={order.id}>
                    <Link to={`/admin/pedidos/${order.id}`} className="flex min-h-14 items-center justify-between gap-3 hover:bg-forest-950/5">
                      <span><strong className="block text-sm text-ink-900">Pedido {order.number}</strong><span className="text-xs text-ink-muted">{formatDate(order.createdAt)}</span></span>
                      <span className="flex items-center gap-3"><strong className="text-sm">{formatCurrency(order.total)}</strong><OrderStatusBadge status={order.status} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {customerOrders.length > 5 && <button type="button" onClick={() => setTimelineAll((v) => !v)} className="mt-2 min-h-11 text-sm font-semibold text-forest-700 hover:underline">{timelineAll ? "Recolher histórico" : "Ver histórico anterior"}</button>}
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-6" aria-label="Resumo comercial e financeiro">
          <PurchasesCard summary={summary} period={period} onPeriod={setPeriod} ordersOfMonth={ordersOfMonth} />
          <CustomerCreditPanel customerId={data.customer.id} />
          <PaymentHistoryCard receivables={receivables} filter={paymentFilter} onFilter={setPaymentFilter} />
          <OpenTitlesCard receivables={receivables} />
        </aside>
      </div>

      <ProductsCard summary={summary} onMore={() => void loadMoreProducts()} loadingMore={loadingMore} />
      <PhotosCard media={data.media} urls={photoUrls} />

      <Dialog open={statusDialog} onClose={() => !statusBusy && setStatusDialog(false)} title={inactive ? "Reativar cadastro?" : "Inativar cadastro?"}>
        <div className="flex flex-col gap-3 p-6">
          <p className="text-sm text-ink-700">
            {inactive
              ? "O cliente volta a aparecer como ativo e poderá receber novos pedidos."
              : "O cliente deixa de ser oferecido em novos pedidos. Pedidos, títulos, limites e histórico são preservados e nada é apagado."}
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-900">
            Motivo (obrigatório, mínimo de 5 caracteres)
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="rounded-xl border border-ink-900/15 p-3 text-sm font-normal outline-none focus:border-forest-700" />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={statusBusy} onClick={() => setStatusDialog(false)}>Cancelar</Button>
            <Button disabled={!canSubmitReason || statusBusy} onClick={() => void confirmStatusChange()}>{statusBusy ? "Salvando..." : inactive ? "Reativar" : "Inativar"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
