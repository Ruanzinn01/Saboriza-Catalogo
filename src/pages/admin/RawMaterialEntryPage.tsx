import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, Store } from "lucide-react";
import { useRawMaterialsStore } from "@/store/raw-materials-store";
import { useRawMaterialEntriesStore } from "@/store/raw-material-entries-store";
import { useSuppliersStore } from "@/store/suppliers-store";
import { EntryCart } from "@/components/admin/EntryCart";
import { RawMaterialPicker } from "@/components/admin/RawMaterialPicker";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { cartTotals, validateEntry, type EntryCartLine } from "@/lib/raw-material-entry";
import type { RawMaterial, RawMaterialEntryInput } from "@/types/raw-material";

function newLine(material: RawMaterial): EntryCartLine {
  return { lineId: crypto.randomUUID(), rawMaterialId: material.id, packagesQuantity: 1, unitPrice: 0, batch: "", expiryDate: "" };
}

export function RawMaterialEntryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get("insumo");

  const materials = useRawMaterialsStore((state) => state.materials);
  const fetchMaterials = useRawMaterialsStore((state) => state.fetchMaterials);
  const suppliers = useSuppliersStore((state) => state.suppliers);
  const fetchSuppliers = useSuppliersStore((state) => state.fetchSuppliers);
  const saveDraft = useRawMaterialEntriesStore((state) => state.saveDraft);
  const confirmEntry = useRawMaterialEntriesStore((state) => state.confirmEntry);

  useEffect(() => {
    if (materials.length === 0) fetchMaterials();
    if (suppliers.length === 0) fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [supplierId, setSupplierId] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceSeries, setInvoiceSeries] = useState("");
  const [invoiceIssueDate, setInvoiceIssueDate] = useState("");
  const [invoiceAccessKey, setInvoiceAccessKey] = useState("");

  const [cart, setCart] = useState<EntryCartLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState("");

  const materialById = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);

  useEffect(() => {
    if (!preselectedId || materials.length === 0) return;
    const material = materials.find((item) => item.id === preselectedId);
    if (material) setCart((prev) => (prev.some((line) => line.rawMaterialId === material.id) ? prev : [...prev, newLine(material)]));
  }, [preselectedId, materials]);

  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId);

  const fetchSupplierOptions = useCallback(
    async (query: string): Promise<ComboboxOption[]> => {
      const text = query.trim().toLowerCase();
      return suppliers
        .filter((supplier) => {
          if (!text) return true;
          return (
            (supplier.tradeName || "").toLowerCase().includes(text) ||
            supplier.companyName.toLowerCase().includes(text) ||
            supplier.cnpj.replace(/\D/g, "").includes(text.replace(/\D/g, "") || "\u0000")
          );
        })
        .slice(0, 20)
        .map((supplier) => ({
          value: supplier.id,
          label: supplier.tradeName || supplier.companyName,
          sublabel: [supplier.cnpj, supplier.city].filter(Boolean).join(" · ") || undefined,
        }));
    },
    [suppliers]
  );

  const validation = useMemo(
    () => (submitted ? validateEntry(supplierId, entryDate, cart) : { formError: "", lineErrors: {} }),
    [submitted, supplierId, entryDate, cart]
  );
  const totals = useMemo(() => cartTotals(cart), [cart]);

  function addMaterials(list: RawMaterial[]) {
    if (list.length === 0) return;
    setCart((prev) => [...prev, ...list.map(newLine)]);
  }

  function updateLine<K extends keyof EntryCartLine>(lineId: string, key: K, value: EntryCartLine[K]) {
    setCart((prev) => prev.map((line) => (line.lineId === lineId ? { ...line, [key]: value } : line)));
  }

  function removeLine(lineId: string) {
    setCart((prev) => prev.filter((line) => line.lineId !== lineId));
  }

  function buildInput(line: EntryCartLine): RawMaterialEntryInput {
    return {
      rawMaterialId: line.rawMaterialId,
      supplierId,
      packagesQuantity: line.packagesQuantity,
      unitPrice: line.unitPrice,
      batch: line.batch.trim(),
      expiryDate: line.expiryDate,
      entryDate,
      invoiceNumber,
      invoiceSeries,
      invoiceIssueDate: invoiceIssueDate || null,
      invoiceAccessKey,
    };
  }

  async function submit(confirm: boolean) {
    setSubmitted(true);
    setSaveError("");
    if (validateEntry(supplierId, entryDate, cart).formError) return;

    setSaving(true);
    const processed = new Set<string>();
    let draftsNotConfirmed = 0;
    let failed = 0;

    for (const line of cart) {
      const input = buildInput(line);
      const entry = await saveDraft(input);
      if (!entry) {
        failed += 1;
        continue;
      }
      processed.add(line.lineId);
      if (confirm && !(await confirmEntry(entry.id, input.rawMaterialId))) draftsNotConfirmed += 1;
    }
    setSaving(false);

    if (failed === 0 && draftsNotConfirmed === 0) {
      navigate("/admin/materias-primas");
      return;
    }

    setCart((prev) => prev.filter((line) => !processed.has(line.lineId)));
    setSaveError(
      [
        failed > 0 ? `${failed} item(ns) não foram salvos e continuam no carrinho.` : "",
        draftsNotConfirmed > 0 ? `${draftsNotConfirmed} entrada(s) ficaram como rascunho: confirme na página de cada insumo.` : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  function handleClear() {
    setCart([]);
    setSubmitted(false);
    setSaveError("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <nav aria-label="Trilha de navegação" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
          <Link to="/admin" className="hover:text-forest-800 hover:underline">
            Início
          </Link>
          <ChevronRight size={12} aria-hidden />
          <Link to="/admin/estoque" className="hover:text-forest-800 hover:underline">
            Estoque
          </Link>
          <ChevronRight size={12} aria-hidden />
          <span aria-current="page">Entrada de Matéria-Prima</span>
        </nav>
        <h1 className="text-2xl font-extrabold text-forest-950 sm:text-3xl">Entrada de Matéria-Prima</h1>
        <p className="mt-1 text-sm text-ink-muted">Registre a compra de insumos e atualize seu estoque.</p>
      </div>

      <div className="grid grid-cols-1 overflow-hidden rounded-3xl border border-forest-950/10 bg-white lg:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-3 p-5 lg:border-r lg:border-forest-950/10">
          <Combobox
            label="Fornecedor *"
            placeholder="Buscar ou selecionar fornecedor..."
            icon={<Store size={18} />}
            chevron
            selectedLabel={selectedSupplier ? selectedSupplier.tradeName || selectedSupplier.companyName : ""}
            fetchOptions={fetchSupplierOptions}
            onSelect={(option) => setSupplierId(option.value)}
          />
          {submitted && !supplierId && <p className="text-xs font-semibold text-red-600">Selecione o fornecedor</p>}
          <Input label="Data da entrada" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
        </div>

        <div className="flex flex-col gap-3 border-t border-forest-950/10 p-5 lg:border-t-0">
          <h2 className="text-sm font-bold text-ink-900">
            Dados da Nota Fiscal <span className="font-normal text-ink-700">(opcional)</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_0.7fr_1.3fr]">
            <Input label="Nº da Nota" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Ex.: 000123456" />
            <Input label="Data da Emissão" type="date" value={invoiceIssueDate} onChange={(e) => setInvoiceIssueDate(e.target.value)} />
            <Input label="Série" value={invoiceSeries} onChange={(e) => setInvoiceSeries(e.target.value)} placeholder="Ex.: 1" />
            <Input
              label="Chave de Acesso (opcional)"
              value={invoiceAccessKey}
              onChange={(e) => setInvoiceAccessKey(e.target.value)}
              placeholder="Ex.: 3524 0123 ..."
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr] lg:items-stretch">
        <RawMaterialPicker materials={materials} onAdd={addMaterials} />
        <EntryCart
          cart={cart}
          materialById={materialById}
          lineErrors={validation.lineErrors}
          totals={totals}
          formError={validation.formError || saveError}
          saving={saving}
          onUpdate={updateLine}
          onRemove={removeLine}
          onClear={handleClear}
          onSaveDraft={() => void submit(false)}
          onConfirm={() => void submit(true)}
        />
      </div>
    </div>
  );
}
