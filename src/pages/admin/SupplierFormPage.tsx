import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { SupplierFormFields } from "@/components/admin/SupplierFormFields";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useSuppliersStore } from "@/store/suppliers-store";
import type { Supplier, SupplierInput } from "@/types/supplier";

const emptyForm: SupplierInput = {
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

export function SupplierFormPage() {
  const { supplierId } = useParams();
  const isEditing = supplierId !== undefined;
  const navigate = useNavigate();
  const suppliers = useSuppliersStore((state) => state.suppliers);
  const fetchSuppliers = useSuppliersStore((state) => state.fetchSuppliers);
  const createSupplier = useSuppliersStore((state) => state.createSupplier);
  const updateSupplier = useSuppliersStore((state) => state.updateSupplier);
  const findDuplicate = useSuppliersStore((state) => state.findDuplicate);

  useEffect(() => {
    if (suppliers.length === 0) fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const existingSupplier = useMemo(() => suppliers.find((supplier) => supplier.id === supplierId), [suppliers, supplierId]);

  const [form, setForm] = useState<SupplierInput>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<RequiredField, string>>>({});
  const [duplicate, setDuplicate] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing || !existingSupplier) return;
    setForm({
      name: existingSupplier.name,
      companyName: existingSupplier.companyName,
      phone: existingSupplier.phone,
      tradeName: existingSupplier.tradeName,
      cnpj: existingSupplier.cnpj,
      ie: existingSupplier.ie,
      email: existingSupplier.email,
      address: existingSupplier.address,
      neighborhood: existingSupplier.neighborhood,
      cep: existingSupplier.cep,
      city: existingSupplier.city,
      state: existingSupplier.state,
    });
  }, [isEditing, existingSupplier]);

  function handleChange<K extends keyof SupplierInput>(key: K, value: SupplierInput[K]) {
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
    const result = isEditing && existingSupplier ? await updateSupplier(existingSupplier.id, form) : await createSupplier(form);
    setSaving(false);
    if (result) navigate("/admin/fornecedores");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    const match = findDuplicate(form, existingSupplier?.id);
    if (match) {
      setDuplicate(match);
      return;
    }

    void persist();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold text-forest-950">{isEditing ? "Editar fornecedor" : "Novo fornecedor"}</h1>

      <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-6">
        <SupplierFormFields form={form} errors={errors} onChange={handleChange} />

        <div className="mt-2 flex gap-3">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Salvando..." : "Salvar fornecedor"}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => navigate("/admin/fornecedores")}>
            Cancelar
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={duplicate !== null}
        onClose={() => setDuplicate(null)}
        title="Fornecedor parecido já cadastrado"
        description={
          <>
            Já existe um fornecedor com {duplicate?.cnpj ? "esse CNPJ" : "esse telefone"}: <strong className="text-ink-900">{duplicate?.name}</strong> (
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
