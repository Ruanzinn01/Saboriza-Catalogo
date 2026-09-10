import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { CustomerFormFields } from "@/components/admin/CustomerFormFields";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useCustomersStore } from "@/store/customers-store";
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

export function CustomerFormPage() {
  const { customerId } = useParams();
  const isEditing = customerId !== "novo";
  const navigate = useNavigate();
  const customers = useCustomersStore((state) => state.customers);
  const fetchCustomers = useCustomersStore((state) => state.fetchCustomers);
  const createCustomer = useCustomersStore((state) => state.createCustomer);
  const updateCustomer = useCustomersStore((state) => state.updateCustomer);
  const findDuplicate = useCustomersStore((state) => state.findDuplicate);

  useEffect(() => {
    if (customers.length === 0) fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const existingCustomer = useMemo(() => customers.find((customer) => customer.id === customerId), [customers, customerId]);

  const [form, setForm] = useState<CustomerInput>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<RequiredField, string>>>({});
  const [duplicate, setDuplicate] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing || !existingCustomer) return;
    setForm({
      name: existingCustomer.name,
      companyName: existingCustomer.companyName,
      phone: existingCustomer.phone,
      tradeName: existingCustomer.tradeName,
      cnpj: existingCustomer.cnpj,
      ie: existingCustomer.ie,
      email: existingCustomer.email,
      address: existingCustomer.address,
      neighborhood: existingCustomer.neighborhood,
      cep: existingCustomer.cep,
      city: existingCustomer.city,
      state: existingCustomer.state,
    });
  }, [isEditing, existingCustomer]);

  function handleChange<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate() {
    const nextErrors: Partial<Record<RequiredField, string>> = {};
    if (!form.name.trim()) nextErrors.name = "Informe o nome";
    if (!form.companyName.trim()) nextErrors.companyName = "Informe a empresa";
    if (!form.phone.trim()) nextErrors.phone = "Informe um telefone";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function persist() {
    setSaving(true);
    const result = isEditing && existingCustomer ? await updateCustomer(existingCustomer.id, form) : await createCustomer(form);
    setSaving(false);
    if (result) navigate("/admin/clientes");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    const match = findDuplicate(form, existingCustomer?.id);
    if (match) {
      setDuplicate(match);
      return;
    }

    void persist();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold text-forest-950">{isEditing ? "Editar cliente" : "Novo cliente"}</h1>

      <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-6">
        <CustomerFormFields form={form} errors={errors} onChange={handleChange} />

        <div className="mt-2 flex gap-3">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Salvando..." : "Salvar cliente"}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => navigate("/admin/clientes")}>
            Cancelar
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={duplicate !== null}
        onClose={() => setDuplicate(null)}
        title="Cliente parecido já cadastrado"
        description={
          <>
            Já existe um cliente com {duplicate?.cnpj ? "esse CNPJ" : "esse telefone"}: <strong className="text-ink-900">{duplicate?.name}</strong> (
            {duplicate?.companyName}). Deseja cadastrar mesmo assim?
          </>
        }
        confirmLabel="Cadastrar mesmo assim"
        onConfirm={() => {
          setDuplicate(null);
          void persist();
        }}
      />
    </div>
  );
}
