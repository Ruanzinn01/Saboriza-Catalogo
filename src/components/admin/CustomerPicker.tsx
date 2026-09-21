import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { CustomerFormFields } from "@/components/admin/CustomerFormFields";
import { useCustomersStore } from "@/store/customers-store";
import { getCustomerDisplayName, getCustomerSecondaryLine } from "@/lib/customer-display";
import type { Customer, CustomerInput } from "@/types/customer";

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

type RequiredField = "name" | "companyName" | "phone";

interface CustomerPickerProps {
  selectedCustomer: Customer | null;
  onSelect: (customer: Customer) => void;
  onClear: () => void;
}

export function CustomerPicker({ selectedCustomer, onSelect, onClear }: CustomerPickerProps) {
  const customers = useCustomersStore((state) => state.customers);
  const fetchCustomers = useCustomersStore((state) => state.fetchCustomers);
  const createCustomer = useCustomersStore((state) => state.createCustomer);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<CustomerInput>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<RequiredField, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customers.length === 0) fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers.slice(0, 8);
    return customers
      .filter((customer) =>
        [customer.name, customer.companyName, customer.cnpj, customer.phone].some((field) => field.toLowerCase().includes(query))
      )
      .slice(0, 8);
  }, [customers, search]);

  function handleChange<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openNewCustomerSheet() {
    setForm(emptyForm);
    setErrors({});
    setSheetOpen(true);
  }

  async function handleCreateCustomer(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Partial<Record<RequiredField, string>> = {};
    if (!form.name.trim()) nextErrors.name = "Informe o nome";
    if (!form.companyName.trim()) nextErrors.companyName = "Informe a empresa";
    if (!form.phone.trim()) nextErrors.phone = "Informe um telefone";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    const customer = await createCustomer(form);
    setSaving(false);
    if (customer) {
      onSelect(customer);
      setSheetOpen(false);
      setSearch("");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {selectedCustomer && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-forest-700/20 bg-forest-700/5 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-forest-950">{getCustomerDisplayName(selectedCustomer)}</p>
            <p className="text-xs text-ink-muted">Cliente vinculado a este pedido</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onClear} className="shrink-0">
            Trocar
          </Button>
        </div>
      )}

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente por nome, empresa, CNPJ ou telefone..."
          className="h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
        />
      </div>

      {results.length > 0 && (
        <div className="flex flex-col divide-y divide-forest-950/5 overflow-hidden rounded-2xl border border-forest-950/10 bg-white">
          {results.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => {
                onSelect(customer);
                setSearch("");
              }}
              className="flex flex-col items-start px-4 py-3 text-left hover:bg-forest-950/5"
            >
              <span className="text-sm font-semibold text-ink-900">{getCustomerDisplayName(customer)}</span>
              <span className="text-xs text-ink-muted">{getCustomerSecondaryLine(customer)}</span>
            </button>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" onClick={openNewCustomerSheet} className="w-fit">
        <UserPlus size={16} /> Cadastrar novo cliente
      </Button>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Novo cliente">
        <form onSubmit={handleCreateCustomer} className="flex flex-col gap-4">
          <CustomerFormFields form={form} errors={errors} onChange={handleChange} />
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Salvando..." : "Salvar e selecionar cliente"}
          </Button>
        </form>
      </Sheet>
    </div>
  );
}
