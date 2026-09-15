import { type FormEvent, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CustomerFormFields } from "@/components/admin/CustomerFormFields";
import { useCustomersStore } from "@/store/customers-store";
import { getCustomerDisplayName } from "@/lib/customer-display";
import type { Customer, CustomerInput } from "@/types/customer";
import type { OrderCustomer } from "@/types/order";

type RequiredField = "name" | "companyName" | "phone";

const emptyForm: CustomerInput = {
  name: "",
  companyName: "",
  phone: "",
  tradeName: "",
  cnpj: "",
  ie: "",
  email: "",
  address: "",
  neighborhood: "",
  cep: "",
  city: "",
  state: "",
};

function customerToInput(customer: Customer): CustomerInput {
  return {
    name: customer.name,
    companyName: customer.companyName,
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

interface CustomerInfoPanelProps {
  selectedCustomer: Customer | null;
  rawCustomer: OrderCustomer | null;
  paymentTerms: string;
  onRawChange: <K extends keyof OrderCustomer>(key: K, value: OrderCustomer[K]) => void;
  onPaymentTermsChange: (value: string) => void;
  onSaveRaw: () => void;
  onCustomerUpdated: (customer: Customer) => void;
}

export function CustomerInfoPanel({
  selectedCustomer,
  rawCustomer,
  paymentTerms,
  onRawChange,
  onPaymentTermsChange,
  onSaveRaw,
  onCustomerUpdated,
}: CustomerInfoPanelProps) {
  const updateCustomer = useCustomersStore((state) => state.updateCustomer);
  const [editingRegistered, setEditingRegistered] = useState(false);
  const [registeredForm, setRegisteredForm] = useState<CustomerInput>(emptyForm);
  const [registeredErrors, setRegisteredErrors] = useState<Partial<Record<RequiredField, string>>>({});
  const [savingRegistered, setSavingRegistered] = useState(false);

  const [editingRaw, setEditingRaw] = useState(false);

  if (!selectedCustomer && !rawCustomer) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-ink-900/15 p-6 text-center text-sm text-ink-700/60">
        As informações do cliente aparecem aqui.
      </div>
    );
  }

  function openEditRegistered() {
    if (!selectedCustomer) return;
    setRegisteredForm(customerToInput(selectedCustomer));
    setRegisteredErrors({});
    setEditingRegistered(true);
  }

  async function handleSaveRegistered(event: FormEvent) {
    event.preventDefault();
    if (!selectedCustomer) return;
    const nextErrors: Partial<Record<RequiredField, string>> = {};
    if (!registeredForm.name.trim()) nextErrors.name = "Informe o nome";
    if (!registeredForm.companyName.trim()) nextErrors.companyName = "Informe a empresa";
    if (!registeredForm.phone.trim()) nextErrors.phone = "Informe um telefone";
    setRegisteredErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSavingRegistered(true);
    const ok = await updateCustomer(selectedCustomer.id, registeredForm);
    setSavingRegistered(false);
    if (ok) {
      const updated = useCustomersStore.getState().customers.find((customer) => customer.id === selectedCustomer.id);
      if (updated) onCustomerUpdated(updated);
      setEditingRegistered(false);
    }
  }

  if (selectedCustomer) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-forest-950/10 bg-cream-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">Dados do cliente cadastrado</p>
          {!editingRegistered && (
            <Button type="button" size="sm" variant="outline" onClick={openEditRegistered}>
              <Pencil size={14} /> Editar
            </Button>
          )}
        </div>

        {editingRegistered ? (
          <form onSubmit={handleSaveRegistered} className="flex flex-col gap-4">
            <CustomerFormFields
              form={registeredForm}
              errors={registeredErrors}
              onChange={(key, value) => setRegisteredForm((prev) => ({ ...prev, [key]: value }))}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={savingRegistered}>
                {savingRegistered ? "Salvando..." : "Salvar alterações"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingRegistered(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-1 text-sm text-ink-700/70">
            <p className="text-sm font-extrabold text-forest-950">{getCustomerDisplayName(selectedCustomer)}</p>
            <p>{selectedCustomer.name}</p>
            <p>Telefone: {selectedCustomer.phone}</p>
            <p>E-mail: {selectedCustomer.email || "-----"}</p>
            <p>CNPJ: {selectedCustomer.cnpj || "-----"}</p>
            <p>IE: {selectedCustomer.ie || "-----"}</p>
            <p>Endereço: {selectedCustomer.address || "-----"}</p>
            <p>
              {selectedCustomer.neighborhood || "-----"} · {selectedCustomer.city || "-----"}/{selectedCustomer.state || "--"} ·{" "}
              {selectedCustomer.cep || "-----"}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (!rawCustomer) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-forest-950/10 bg-cream-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">Dados informados no pedido</p>
        {!editingRaw && (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditingRaw(true)}>
            <Pencil size={14} /> Editar
          </Button>
        )}
      </div>

      {editingRaw ? (
        <div className="flex flex-col gap-4">
          <Input label="Nome" value={rawCustomer.name} onChange={(e) => onRawChange("name", e.target.value)} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Empresa" value={rawCustomer.company} onChange={(e) => onRawChange("company", e.target.value)} />
            <Input label="Telefone" value={rawCustomer.phone} onChange={(e) => onRawChange("phone", e.target.value)} />
          </div>
          <Input label="Nome fantasia" value={rawCustomer.tradeName} onChange={(e) => onRawChange("tradeName", e.target.value)} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="CNPJ" value={rawCustomer.cnpj} onChange={(e) => onRawChange("cnpj", e.target.value)} />
            <Input label="Inscrição estadual" value={rawCustomer.ie} onChange={(e) => onRawChange("ie", e.target.value)} />
          </div>
          <Input label="E-mail" value={rawCustomer.email} onChange={(e) => onRawChange("email", e.target.value)} />
          <Input label="Endereço" value={rawCustomer.address} onChange={(e) => onRawChange("address", e.target.value)} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Bairro" value={rawCustomer.neighborhood} onChange={(e) => onRawChange("neighborhood", e.target.value)} />
            <Input label="CEP" value={rawCustomer.cep} onChange={(e) => onRawChange("cep", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Cidade" value={rawCustomer.city} onChange={(e) => onRawChange("city", e.target.value)} />
            <Input
              label="Estado"
              maxLength={2}
              value={rawCustomer.state}
              onChange={(e) => onRawChange("state", e.target.value.toUpperCase())}
            />
          </div>
          <Input
            label="Condição de pagamento"
            placeholder="Ex: 21,28,35"
            value={paymentTerms}
            onChange={(e) => onPaymentTermsChange(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onSaveRaw();
                setEditingRaw(false);
              }}
            >
              Salvar alterações
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditingRaw(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1 text-sm text-ink-700/70">
          <p className="text-sm font-extrabold text-forest-950">{rawCustomer.name || "-----"}</p>
          <p>{rawCustomer.company || "-----"}</p>
          <p>Telefone: {rawCustomer.phone || "-----"}</p>
          <p>E-mail: {rawCustomer.email || "-----"}</p>
          <p>Nome fantasia: {rawCustomer.tradeName || "-----"}</p>
          <p>CNPJ: {rawCustomer.cnpj || "-----"}</p>
          <p>IE: {rawCustomer.ie || "-----"}</p>
          <p>Endereço: {rawCustomer.address || "-----"}</p>
          <p>
            {rawCustomer.neighborhood || "-----"} · {rawCustomer.city || "-----"}/{rawCustomer.state || "--"} · {rawCustomer.cep || "-----"}
          </p>
          <p>Condição de pagamento: {paymentTerms || "-----"}</p>
        </div>
      )}
    </div>
  );
}
