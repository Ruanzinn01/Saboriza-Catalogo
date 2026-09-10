import { useEffect, useState } from "react";
import { Copy, Download, MessageCircle } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { useOrdersStore } from "@/store/orders-store";
import { useSettingsStore } from "@/store/settings-store";
import { ORDER_STATUS_OPTIONS, ORDER_STATUS_TRANSITIONS } from "@/lib/order-status";
import { formatCurrency } from "@/lib/currency";
import { calculateLineTotal } from "@/lib/pricing";
import { copyOrderText, downloadOrderPdf, sendOrderWhatsApp } from "@/lib/order-actions";
import type { Order, OrderCustomer, OrderStatus } from "@/types/order";

interface OrderDetailSheetProps {
  order: Order | null;
  onClose: () => void;
}

export function OrderDetailSheet({ order, onClose }: OrderDetailSheetProps) {
  const updateStatus = useOrdersStore((state) => state.updateStatus);
  const updateOrderDetails = useOrdersStore((state) => state.updateOrderDetails);
  const settings = useSettingsStore((state) => state.settings);

  const [customerForm, setCustomerForm] = useState<OrderCustomer | null>(null);
  const [paymentTerms, setPaymentTerms] = useState("");

  useEffect(() => {
    if (order) {
      setCustomerForm(order.customer);
      setPaymentTerms(order.paymentTerms);
    }
  }, [order]);

  function handleCustomerChange<K extends keyof OrderCustomer>(key: K, value: OrderCustomer[K]) {
    setCustomerForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleSaveDetails() {
    if (!order || !customerForm) return;
    updateOrderDetails(order.id, customerForm, paymentTerms);
  }

  return (
    <Sheet open={order !== null} onClose={onClose} title={order ? `Pedido ${order.number}` : "Pedido"}>
      {order && customerForm && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
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

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-700/50">Cliente</p>
            <p className="text-sm font-semibold text-ink-900">{order.customer.name}</p>
            <p className="text-sm text-ink-700/70">{order.customer.company}</p>
            <p className="text-sm text-ink-700/70">{order.customer.phone}</p>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-700/50">Produtos</p>
            <div className="flex flex-col gap-2">
              {order.items.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="text-sm text-ink-700/80">
                  <p className="font-semibold text-ink-900">{item.name}</p>
                  <p className="text-xs text-ink-700/60">
                    {item.presentation} · {item.weight} · {item.packs}x pack ({item.packs * item.packQuantity} unidades)
                  </p>
                  <p className="text-xs font-semibold text-ink-900">
                    {formatCurrency(calculateLineTotal(item.unitPrice, item.packQuantity, item.packs))}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-right text-base font-extrabold text-forest-950">Total: {formatCurrency(order.total)}</p>

          <div className="flex flex-col gap-3 rounded-2xl border border-forest-950/10 bg-cream-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">
              Dados adicionais (opcional, usados na comanda em PDF)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Nome fantasia"
                value={customerForm.tradeName}
                onChange={(e) => handleCustomerChange("tradeName", e.target.value)}
              />
              <Input label="CNPJ" value={customerForm.cnpj} onChange={(e) => handleCustomerChange("cnpj", e.target.value)} />
              <Input
                label="Inscrição estadual"
                value={customerForm.ie}
                onChange={(e) => handleCustomerChange("ie", e.target.value)}
              />
              <Input label="E-mail" value={customerForm.email} onChange={(e) => handleCustomerChange("email", e.target.value)} />
            </div>
            <Input
              label="Endereço"
              value={customerForm.address}
              onChange={(e) => handleCustomerChange("address", e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Bairro"
                value={customerForm.neighborhood}
                onChange={(e) => handleCustomerChange("neighborhood", e.target.value)}
              />
              <Input label="CEP" value={customerForm.cep} onChange={(e) => handleCustomerChange("cep", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Cidade" value={customerForm.city} onChange={(e) => handleCustomerChange("city", e.target.value)} />
              <Input
                label="Estado"
                maxLength={2}
                value={customerForm.state}
                onChange={(e) => handleCustomerChange("state", e.target.value.toUpperCase())}
              />
            </div>
            <Input
              label="Condição de pagamento"
              placeholder="Ex: 21,28,35"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
            />
            <Button type="button" size="sm" variant="outline" onClick={handleSaveDetails}>
              Salvar dados adicionais
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!settings}
              onClick={() => settings && downloadOrderPdf(order, settings)}
            >
              <Download size={16} /> Baixar comanda PDF
            </Button>
            <Button type="button" onClick={() => sendOrderWhatsApp(order, order.customer.phone)}>
              <MessageCircle size={16} /> Enviar comanda pelo WhatsApp
            </Button>
            <Button type="button" variant="ghost" onClick={() => copyOrderText(order)}>
              <Copy size={16} /> Copiar comanda
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
