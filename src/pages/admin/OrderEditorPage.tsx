import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  CopyPlus,
  Download,
  Eye,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { OrderPreviewModal } from "@/components/admin/OrderPreviewModal";
import { CustomerPicker } from "@/components/admin/CustomerPicker";
import { CustomerInfoPanel } from "@/components/admin/CustomerInfoPanel";
import { CouponField } from "@/components/checkout/CouponField";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { ProductImage } from "@/components/catalog/ProductImage";
import { Sheet } from "@/components/ui/Sheet";
import { useCatalogStore } from "@/store/catalog-store";
import { useOrdersStore } from "@/store/orders-store";
import { useCustomersStore } from "@/store/customers-store";
import { useSettingsStore } from "@/store/settings-store";
import { submitOrder, updateOrderItems } from "@/lib/orders-api";
import { copyOrderText, downloadOrderPdf, sendOrderWhatsApp } from "@/lib/order-actions";
import { ORDER_STATUS_OPTIONS, ORDER_STATUS_TRANSITIONS } from "@/lib/order-status";
import { getCustomerDisplayName, getCustomerSecondaryLine } from "@/lib/customer-display";
import { calculateCartTotal, calculateItemCount, calculateLineTotal } from "@/lib/pricing";
import { formatCurrency } from "@/lib/currency";
import { formatProductTitle } from "@/lib/product-title";
import type { CartItem } from "@/types/cart";
import type { Coupon } from "@/types/coupon";
import type { Customer, CustomerInput } from "@/types/customer";
import type { OrderCustomer, OrderStatus } from "@/types/order";
import type { Product } from "@/types/product";

function customerToOrderCustomer(customer: Customer): OrderCustomer {
  return {
    name: customer.name,
    company: customer.companyName,
    phone: customer.phone,
    tradeName: customer.tradeName,
    cnpj: customer.cnpj,
    ie: customer.ie,
    email: customer.email,
    address: customer.address,
    neighborhood: customer.neighborhood,
    cep: customer.cep,
    city: customer.city,
    state: customer.state,
  };
}

export function OrderEditorPage() {
  const { orderId } = useParams();
  const isEditing = orderId !== undefined;
  const navigate = useNavigate();

  const products = useCatalogStore((state) => state.products);

  const orders = useOrdersStore((state) => state.orders);
  const createOrder = useOrdersStore((state) => state.createOrder);
  const replaceOrder = useOrdersStore((state) => state.replaceOrder);
  const updateStatus = useOrdersStore((state) => state.updateStatus);
  const updateOrderDetails = useOrdersStore((state) => state.updateOrderDetails);
  const linkCustomer = useOrdersStore((state) => state.linkCustomer);
  const deleteOrder = useOrdersStore((state) => state.deleteOrder);

  const registeredCustomers = useCustomersStore((state) => state.customers);
  const fetchCustomers = useCustomersStore((state) => state.fetchCustomers);
  const findDuplicate = useCustomersStore((state) => state.findDuplicate);
  const createCustomer = useCustomersStore((state) => state.createCustomer);

  const settings = useSettingsStore((state) => state.settings);

  const order = isEditing ? orders.find((item) => item.id === orderId) ?? null : null;

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(!isEditing);

  const [extraForm, setExtraForm] = useState<OrderCustomer | null>(null);
  const [paymentTerms, setPaymentTerms] = useState("");

  const [registeringCustomer, setRegisteringCustomer] = useState(false);
  const [linkSheetOpen, setLinkSheetOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (registeredCustomers.length === 0) fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEditing || !order || hydrated) return;
    setItems(
      order.items.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        return product ? { ...item, imageUrl: product.imageUrl } : item;
      })
    );
    setExtraForm(order.customer);
    setPaymentTerms(order.paymentTerms);
    if (order.couponCode) {
      setCoupon({ id: "", code: order.couponCode, discountType: order.couponType || "fixed", discountValue: order.couponValue, active: true });
    }
    if (order.customerId) {
      const match = registeredCustomers.find((customer) => customer.id === order.customerId);
      if (match) setSelectedCustomer(match);
    }
    setHydrated(true);
  }, [isEditing, order, hydrated, registeredCustomers, products]);

  function addItem(product: Product) {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) => (item.productId === product.id ? { ...item, packs: item.packs + 1 } : item));
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          presentation: product.presentation,
          weight: product.weight,
          imageUrl: product.imageUrl,
          unitPrice: product.unitPrice,
          packQuantity: product.packQuantity,
          packs: 1,
        },
      ];
    });
  }

  function setItemQuantity(productId: string, packs: number) {
    setItems((prev) => prev.map((item) => (item.productId === productId ? { ...item, packs: Math.max(1, packs) } : item)));
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }

  const productMatches = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return [];
    return products.filter((product) => product.active && product.name.toLowerCase().includes(query)).slice(0, 8);
  }, [products, productQuery]);

  async function handleSelectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    if (isEditing && order) {
      await linkCustomer(order.id, customer.id);
    }
  }

  function handleCustomerUpdated(customer: Customer) {
    setSelectedCustomer(customer);
  }

  async function handleCreateOrder() {
    if (!selectedCustomer) {
      toast.error("Selecione ou cadastre um cliente");
      return;
    }
    if (items.length === 0) {
      toast.error("Adicione ao menos um produto");
      return;
    }

    setSubmitting(true);
    try {
      const created = await submitOrder(customerToOrderCustomer(selectedCustomer), items, coupon?.code, selectedCustomer.id);
      createOrder(created);
      toast.success(`Pedido ${created.number} criado`);
      navigate("/admin/pedidos");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o pedido");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveItems() {
    if (!order) return;
    if (items.length === 0) {
      toast.error("Adicione ao menos um produto");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await updateOrderItems(order.id, items, coupon?.code);
      replaceOrder(updated);
      toast.success("Itens do pedido atualizados");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o pedido");
    } finally {
      setSubmitting(false);
    }
  }

  function handleExtraChange<K extends keyof OrderCustomer>(key: K, value: OrderCustomer[K]) {
    setExtraForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleSaveExtra() {
    if (!order || !extraForm) return;
    updateOrderDetails(order.id, extraForm, paymentTerms);
  }

  async function handleRegisterCustomer() {
    if (!order || !extraForm) return;
    if (order.customerId) {
      toast.error("Este pedido já está vinculado a um cliente cadastrado.");
      return;
    }

    const input: CustomerInput = {
      name: extraForm.name,
      companyName: extraForm.company,
      phone: extraForm.phone,
      tradeName: extraForm.tradeName,
      cnpj: extraForm.cnpj,
      ie: extraForm.ie,
      email: extraForm.email,
      address: extraForm.address,
      neighborhood: extraForm.neighborhood,
      cep: extraForm.cep,
      city: extraForm.city,
      state: extraForm.state,
    };

    setRegisteringCustomer(true);
    const match = findDuplicate(input);

    if (match) {
      const linked = await linkCustomer(order.id, match.id);
      if (linked) {
        setSelectedCustomer(match);
        toast.success(`Cliente já cadastrado: ${match.name}. Pedido vinculado ao cadastro.`);
      }
    } else {
      const created = await createCustomer(input);
      if (created) {
        await linkCustomer(order.id, created.id);
        setSelectedCustomer(created);
      }
    }
    setRegisteringCustomer(false);
  }

  async function handleLinkExisting(customer: Customer) {
    if (!order) return;
    const linked = await linkCustomer(order.id, customer.id);
    if (linked) {
      setSelectedCustomer(customer);
      toast.success(`Pedido vinculado a ${getCustomerDisplayName(customer)}`);
      setLinkSheetOpen(false);
      setLinkSearch("");
    }
  }

  async function handleDuplicate() {
    if (!order) return;
    setDuplicating(true);
    try {
      const duplicated = await submitOrder(order.customer, order.items, order.couponCode || undefined, order.customerId ?? undefined);
      createOrder(duplicated);
      toast.success(`Pedido ${duplicated.number} criado a partir do ${order.number}`);
      navigate(`/admin/pedidos/${duplicated.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível duplicar o pedido");
    } finally {
      setDuplicating(false);
    }
  }

  async function handleDelete() {
    if (!order) return;
    const ok = await deleteOrder(order.id);
    if (ok) navigate("/admin/pedidos");
  }

  if (isEditing && !order) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/admin/pedidos" className="flex w-fit items-center gap-2 text-sm font-semibold text-ink-700/70 hover:text-ink-900">
          <ArrowLeft size={16} /> Voltar para Pedidos
        </Link>
        <p className="text-sm text-ink-700/60">Pedido não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/admin/pedidos" className="flex w-fit items-center gap-2 text-sm font-semibold text-ink-700/70 hover:text-ink-900">
        <ArrowLeft size={16} /> Voltar para Pedidos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">{order ? `Pedido ${order.number}` : "Novo pedido"}</h1>
          <p className="text-sm text-ink-700/60">
            {order ? "Edite os produtos, o cliente ou os dados do pedido." : "Crie um pedido manualmente selecionando um cliente já cadastrado."}
          </p>
        </div>
        {order && (
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <select
              value={order.status}
              onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
              disabled={ORDER_STATUS_TRANSITIONS[order.status].length === 0}
              className="h-10 rounded-xl border border-ink-900/15 bg-white px-3 text-sm font-semibold text-ink-900 outline-none disabled:opacity-60"
            >
              {ORDER_STATUS_OPTIONS.filter(
                (option) => option.value === order.status || ORDER_STATUS_TRANSITIONS[order.status].includes(option.value)
              ).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {order && (
        <div className="flex flex-wrap gap-2 rounded-3xl border border-forest-950/10 bg-white p-4">
          <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye size={16} /> Visualizar pedido
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={duplicating} onClick={() => void handleDuplicate()}>
            <CopyPlus size={16} /> {duplicating ? "Duplicando..." : "Duplicar pedido"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!settings}
            onClick={() => settings && downloadOrderPdf(order, settings)}
          >
            <Download size={16} /> Baixar PDF
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => sendOrderWhatsApp(order, order.customer.phone)}>
            <MessageCircle size={16} /> Enviar por WhatsApp
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => copyOrderText(order)}>
            <Copy size={16} /> Copiar comanda
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-red-600 hover:bg-red-50"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 size={16} /> Excluir pedido
          </Button>
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">Cliente</p>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <CustomerPicker selectedCustomer={selectedCustomer} onSelect={(customer) => void handleSelectCustomer(customer)} onClear={() => setSelectedCustomer(null)} />

            {order && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={registeringCustomer} onClick={() => void handleRegisterCustomer()}>
                  <UserPlus size={16} /> {registeringCustomer ? "Cadastrando..." : "Cadastrar cliente com esses dados"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setLinkSheetOpen(true)}>
                  <UserCheck size={16} /> Vincular a cliente existente
                </Button>
              </div>
            )}
          </div>

          <CustomerInfoPanel
            selectedCustomer={selectedCustomer}
            rawCustomer={extraForm}
            paymentTerms={paymentTerms}
            onRawChange={handleExtraChange}
            onPaymentTermsChange={setPaymentTerms}
            onSaveRaw={handleSaveExtra}
            onCustomerUpdated={handleCustomerUpdated}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">Produtos</p>

        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Digite o código ou o nome do produto pra adicionar ao pedido"
            className="h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          />
        </div>

        {productMatches.length > 0 && (
          <div className="flex flex-col divide-y divide-forest-950/5 overflow-hidden rounded-2xl border border-forest-950/10">
            {productMatches.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => {
                  addItem(product);
                  setProductQuery("");
                }}
                className="flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-forest-950/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{formatProductTitle(product)}</p>
                  <p className="text-xs text-ink-700/60">
                    Pack de {product.packQuantity} un · {formatCurrency(product.unitPrice)}/unid
                  </p>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-700/10 text-forest-800">
                  <Plus size={16} />
                </span>
              </button>
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-900/15 p-6 text-center text-sm text-ink-700/60">
            Nenhum produto adicionado ainda. Busque acima pra adicionar.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-forest-950/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-700/50">
                <tr>
                  <th className="px-3 py-2">Imagem</th>
                  <th className="px-3 py-2">Produto</th>
                  <th className="px-3 py-2 text-center">Qtde.</th>
                  <th className="px-3 py-2 text-right">Preço</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.productId} className="border-b border-forest-950/5 last:border-none">
                    <td className="px-3 py-2">
                      <div className="h-12 w-12 overflow-hidden rounded-xl border border-forest-950/10">
                        <ProductImage imageUrl={item.imageUrl} name={item.name} />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-ink-900">{item.name}</p>
                      <p className="text-xs text-ink-700/60">
                        {item.presentation} · {item.weight}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={item.packs}
                        onChange={(e) => setItemQuantity(item.productId, Number(e.target.value))}
                        className="h-9 w-16 rounded-lg border border-ink-900/15 text-center text-sm font-bold text-ink-900 outline-none focus:border-forest-700"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-ink-700/70">{formatCurrency(item.unitPrice)}/un</td>
                    <td className="px-3 py-2 text-right font-bold text-ink-900">
                      {formatCurrency(calculateLineTotal(item.unitPrice, item.packQuantity, item.packs))}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                        aria-label="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-forest-950/10 bg-forest-950/[0.02]">
                  <td colSpan={2} className="px-3 py-3 text-xs font-semibold text-ink-700/60">
                    Itens no pedido: {items.length}
                  </td>
                  <td className="px-3 py-3 text-center text-xs font-semibold text-ink-700/60">Qtde. total: {calculateItemCount(items)}</td>
                  <td colSpan={3} className="px-3 py-3 text-right text-sm font-extrabold text-forest-950">
                    Valor total: {formatCurrency(calculateCartTotal(items))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">Cupom (opcional)</p>
        <CouponField appliedCoupon={coupon} onApply={setCoupon} onRemove={() => setCoupon(null)} />
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">Revisão</p>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-forest-950/10 bg-white p-6 text-sm text-ink-700/60">
            Adicione produtos para ver o resumo do pedido.
          </p>
        ) : (
          <OrderSummary items={items} coupon={coupon} />
        )}
      </section>

      <Button size="lg" disabled={submitting} onClick={() => void (isEditing ? handleSaveItems() : handleCreateOrder())}>
        {submitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar pedido"}
      </Button>

      {order && <OrderPreviewModal order={order} open={previewOpen} onClose={() => setPreviewOpen(false)} />}

      {order && (
        <ConfirmDialog
          open={confirmingDelete}
          onClose={() => setConfirmingDelete(false)}
          title="Excluir pedido?"
          description={
            <>
              O pedido <strong className="text-ink-900">{order.number}</strong> será removido permanentemente e não poderá ser recuperado.
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

      <Sheet open={linkSheetOpen} onClose={() => setLinkSheetOpen(false)} title="Vincular a cliente existente">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <input
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
              placeholder="Buscar por nome, empresa, CNPJ ou telefone..."
              className="h-11 w-full rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
              autoFocus
            />
          </div>
          <div className="flex flex-col divide-y divide-forest-950/5 overflow-hidden rounded-2xl border border-forest-950/10">
            {registeredCustomers
              .filter((customer) => {
                const query = linkSearch.trim().toLowerCase();
                if (!query) return true;
                return [customer.name, customer.companyName, customer.cnpj, customer.phone].some((field) => field.toLowerCase().includes(query));
              })
              .slice(0, 20)
              .map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => void handleLinkExisting(customer)}
                  className="flex flex-col items-start px-4 py-3 text-left hover:bg-forest-950/5"
                >
                  <span className="text-sm font-semibold text-ink-900">{getCustomerDisplayName(customer)}</span>
                  <span className="text-xs text-ink-700/60">{getCustomerSecondaryLine(customer)}</span>
                </button>
              ))}
            {registeredCustomers.length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-700/60">Nenhum cliente cadastrado ainda.</p>}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
