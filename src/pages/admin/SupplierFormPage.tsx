import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { FormPageHeader } from "@/components/admin/FormPageHeader";
import { SupplierFormFields } from "@/components/admin/SupplierFormFields";
import { SupplierCategoryPicker } from "@/components/admin/fornecedores/SupplierCategoryPicker";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { diffIds, hasValidDocumentFormat } from "@/lib/supplier-search";
import { useSuppliersStore } from "@/store/suppliers-store";
import { useSupplierCategoriesStore } from "@/store/supplier-categories-store";
import { useSupplierCandidatesStore } from "@/store/supplier-candidates-store";
import type { Supplier, SupplierCandidate, SupplierInput } from "@/types/supplier";

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

type RequiredField = "name" | "companyName" | "phone" | "cnpj";

export function SupplierFormPage() {
  const { supplierId } = useParams();
  const isEditing = supplierId !== undefined;
  const navigate = useNavigate();
  const suppliers = useSuppliersStore((state) => state.suppliers);
  const fetchSuppliers = useSuppliersStore((state) => state.fetchSuppliers);
  const createSupplier = useSuppliersStore((state) => state.createSupplier);
  const updateSupplier = useSuppliersStore((state) => state.updateSupplier);
  const findDuplicate = useSuppliersStore((state) => state.findDuplicate);
  const [searchParams] = useSearchParams();
  const candidateId = isEditing ? null : searchParams.get("candidato");
  const fetchCandidate = useSupplierCandidatesStore((state) => state.fetchCandidate);
  const convertCandidate = useSupplierCandidatesStore((state) => state.convert);
  const categoriesStatus = useSupplierCategoriesStore((state) => state.status);
  const linksBySupplier = useSupplierCategoriesStore((state) => state.linksBySupplier);
  const fetchCategories = useSupplierCategoriesStore((state) => state.fetchAll);
  const saveSupplierCategories = useSupplierCategoriesStore((state) => state.saveSupplierCategories);

  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [initialCategoryIds, setInitialCategoryIds] = useState<string[]>([]);
  const [candidate, setCandidate] = useState<SupplierCandidate | null>(null);
  const [duplicateOfCandidate, setDuplicateOfCandidate] = useState<string | null>(null);

  useEffect(() => {
    if (suppliers.length === 0) fetchSuppliers();
    if (categoriesStatus === "idle") void fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEditing || categoriesStatus !== "ready") return;
    const current = linksBySupplier.get(supplierId) ?? [];
    setCategoryIds(current);
    setInitialCategoryIds(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, supplierId, categoriesStatus]);

  useEffect(() => {
    if (!candidateId) return;
    let cancelled = false;
    void fetchCandidate(candidateId).then((found) => {
      if (cancelled) return;
      if (!found || found.stage === "CADASTRADO") {
        toast.error("Avaliação não encontrada ou já cadastrada como fornecedor");
        return;
      }
      setCandidate(found);
      setCategoryIds(found.categoryIds);
      setForm((prev) => ({
        ...prev,
        tradeName: found.tradeName,
        companyName: found.legalName || found.tradeName,
        name: found.contactName,
        phone: found.phone,
        email: found.email,
        city: found.city,
        state: found.state,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [candidateId, fetchCandidate]);

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
    if (form.cnpj !== (existingSupplier?.cnpj ?? "") && !hasValidDocumentFormat(form.cnpj)) {
      nextErrors.cnpj = "Formato inválido: use CPF (11 dígitos) ou CNPJ (14 caracteres, os 2 últimos numéricos)";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function persist(existingForCandidate: string | null = null) {
    setSaving(true);
    try {
      if (candidate) {
        const result = await convertCandidate(candidate.id, existingForCandidate, form, categoryIds);
        if (!result) return;
        if ("duplicateOf" in result) {
          setDuplicateOfCandidate(result.duplicateOf);
          return;
        }
        toast.success("Fornecedor cadastrado a partir da avaliação");
        await fetchSuppliers();
        void fetchCategories();
        navigate(`/admin/fornecedores/${result.supplierId}`);
        return;
      }

      const result = isEditing && existingSupplier ? await updateSupplier(existingSupplier.id, form) : await createSupplier(form);
      if (!result) return;
      const saved = typeof result === "object" ? result.id : existingSupplier?.id;
      if (saved) {
        const delta = diffIds(initialCategoryIds, categoryIds);
        await saveSupplierCategories(saved, delta.add, delta.remove);
      }
      navigate("/admin/fornecedores");
    } finally {
      setSaving(false);
    }
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
      <FormPageHeader
        title={isEditing ? "Editar fornecedor" : "Novo fornecedor"}
        crumbs={[{ label: "Fornecedores", to: "/admin/fornecedores" }, { label: isEditing ? "Editar fornecedor" : "Novo fornecedor" }]}
      >
        <Button type="button" variant="outline" onClick={() => navigate("/admin/fornecedores")}>
          <ArrowLeft size={16} /> Voltar
        </Button>
        <Button type="submit" form="supplier-form" variant="secondary" disabled={saving}>
          <Save size={16} /> {saving ? "Salvando..." : "Salvar fornecedor"}
        </Button>
      </FormPageHeader>

      <form id="supplier-form" onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-6">
        {candidate && (
          <p className="rounded-2xl bg-forest-950/5 p-3 text-sm text-ink-700">
            Cadastrando a partir da avaliação de <strong className="text-ink-900">{candidate.tradeName}</strong>. A origem, a primeira data, os produtos e o histórico
            ficam preservados; nenhuma compra, dívida ou limite é criado.
          </p>
        )}
        <SupplierFormFields form={form} errors={errors} onChange={handleChange} />
        <SupplierCategoryPicker value={categoryIds} onChange={setCategoryIds} />

        <div className="mt-2 flex gap-3 lg:hidden">
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

      <ConfirmDialog
        open={duplicateOfCandidate !== null}
        onClose={() => setDuplicateOfCandidate(null)}
        title="Este documento já está cadastrado"
        description={
          <>
            Já existe um fornecedor com esse documento: <strong className="text-ink-900">{suppliers.find((s) => s.id === duplicateOfCandidate)?.name ?? "fornecedor existente"}</strong>.
            Deseja vincular a avaliação a ele, sem criar um segundo cadastro?
          </>
        }
        confirmLabel="Vincular ao existente"
        onConfirm={() => {
          const target = duplicateOfCandidate;
          setDuplicateOfCandidate(null);
          void persist(target);
        }}
      />
    </div>
  );
}
