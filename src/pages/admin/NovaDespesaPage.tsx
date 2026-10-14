import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Settings2, Trash2 } from "lucide-react";
import { useExpenseLaunchStore, type LaunchKind, type LaunchItemInput, type InstallmentInput } from "@/store/expense-launch-store";
import { useRawMaterialsStore } from "@/store/raw-materials-store";
import { MaterialThumb } from "@/components/admin/RawMaterialsTable";
import { useSuppliersStore } from "@/store/suppliers-store";
import { useEmployeesStore } from "@/store/employees-store";
import { useAportesStore } from "@/store/aportes-store";
import { useDespesasStore } from "@/store/despesas-store";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { Button } from "@/components/ui/Button";
import { brl, withContext } from "@/pages/admin/despesas/shared";
import { useDespesasFilters } from "@/pages/admin/despesas/useDespesasFilters";
import { DESPESAS_COLORS } from "@/pages/admin/despesas/theme";
import { KIND_LABEL, defaultRecurrence, frequencyLabel, type CartLine } from "@/pages/admin/despesas/launch/types";
import { ItemConfigModal, CategoriesModal, NewItemModal, SalaryApurationModal, AdvanceModal } from "@/pages/admin/despesas/launch/LaunchModals";
import { clearDraft, loadDraft, saveDraft, type LaunchDraft } from "@/pages/admin/despesas/launch/draft";
import { StockCatalogPanel } from "@/pages/admin/despesas/launch/StockCatalogPanel";
import { QuickItemModal } from "@/pages/admin/despesas/launch/QuickItemModal";
import { usePurchaseDraftSync } from "@/pages/admin/despesas/launch/usePurchaseDraftSync";
import { usePurchaseStore, type PurchaseCatalogItem } from "@/store/purchase-store";
import type { RawMaterial } from "@/types/raw-material";
import type { Employee } from "@/types/employee";

const C = DESPESAS_COLORS;
const KINDS: LaunchKind[] = ["stock", "asset", "expense", "salary", "partner"];
const today = () => new Date().toISOString().slice(0, 10);
const month = () => today().slice(0, 7) + "-01";
const uid = () => crypto.randomUUID();
const fieldCls = "w-full rounded-[10px] border px-3 py-3 text-sm";

interface Parcel {
  number: number;
  amount: number;
  dueDate: string;
  scheduledPaymentAt: string;
}

export function NovaDespesaPage() {
  const navigate = useNavigate();
  const { params } = useDespesasFilters();
  const [routeParams] = useSearchParams();
  const preselectedMaterialId = routeParams.get("insumo");

  const categories = useExpenseLaunchStore((s) => s.categories);
  const catalogItems = useExpenseLaunchStore((s) => s.catalogItems);
  const findCommitment = useExpenseLaunchStore((s) => s.findCommitment);
  const createLaunch = useExpenseLaunchStore((s) => s.createLaunch);
  const fetchLaunchData = useExpenseLaunchStore((s) => s.fetchAll);

  const materials = useRawMaterialsStore((s) => s.materials);
  const fetchMaterials = useRawMaterialsStore((s) => s.fetchMaterials);
  const suppliers = useSuppliersStore((s) => s.suppliers);
  const fetchSuppliers = useSuppliersStore((s) => s.fetchSuppliers);
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const partners = useAportesStore((s) => s.partners);
  const fetchPartners = useAportesStore((s) => s.fetchAll);
  const obligations = useDespesasStore((s) => s.obligations);
  const advances = useDespesasStore((s) => s.advances);
  const fetchDespesas = useDespesasStore((s) => s.fetchAll);

  useEffect(() => {
    fetchLaunchData();
    if (materials.length === 0) fetchMaterials();
    if (suppliers.length === 0) fetchSuppliers();
    if (employees.length === 0) fetchEmployees();
    if (partners.length === 0) fetchPartners();
    fetchDespesas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rascunho da sessão: sair para cadastrar fornecedor/insumo e voltar não pode perder o lançamento.
  const [draft] = useState(loadDraft);
  const [kind, setKind] = useState<LaunchKind>(draft?.kind ?? "stock");
  const [supplierId, setSupplierId] = useState(draft?.supplierId ?? "");
  const [partnerId, setPartnerId] = useState(draft?.partnerId ?? "");
  const [competence, setCompetence] = useState(draft?.competence ?? month());
  const [documentRef, setDocumentRef] = useState(draft?.documentRef ?? "");
  const [documentSeries, setDocumentSeries] = useState(draft?.documentSeries ?? "");
  const [documentIssueDate, setDocumentIssueDate] = useState(draft?.documentIssueDate ?? "");
  const [documentAccessKey, setDocumentAccessKey] = useState(draft?.documentAccessKey ?? "");
  const [batch, setBatch] = useState(draft?.batch ?? "");
  const [expiryDate, setExpiryDate] = useState(draft?.expiryDate ?? "");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cart, setCart] = useState<CartLine[]>(draft?.cart ?? []);
  const [configLine, setConfigLine] = useState<CartLine | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [quick, setQuick] = useState<{ barcode: string } | null>(null);
  const [duplicateReason, setDuplicateReason] = useState<string | null>(null);
  const [salaryModalEmployee, setSalaryModalEmployee] = useState<Employee | null>(null);
  const [advanceModalEmployee, setAdvanceModalEmployee] = useState<Employee | null>(null);

  const [freight, setFreight] = useState(draft?.freight ?? "0");
  const [discount, setDiscount] = useState(draft?.discount ?? "0");
  const [received, setReceived] = useState(draft?.received ?? true);
  const [paymentMethod, setPaymentMethod] = useState(draft?.paymentMethod ?? "boleto");
  const [paymentCondition, setPaymentCondition] = useState<"term" | "cash">(draft?.paymentCondition ?? "term");
  const [installmentCount, setInstallmentCount] = useState(draft?.installmentCount ?? 1);
  const [baseDate, setBaseDate] = useState(draft?.baseDate ?? today());
  const [recipientKey, setRecipientKey] = useState(draft?.recipientKey ?? "");
  const [recipientHolder, setRecipientHolder] = useState(draft?.recipientHolder ?? "");
  const [observations, setObservations] = useState(draft?.observations ?? "");
  const [otherCosts, setOtherCosts] = useState(draft?.otherCosts ?? "0");
  const [parcels, setParcels] = useState<Parcel[]>([{ number: 1, amount: 0, dueDate: today(), scheduledPaymentAt: today() }]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (draft && draft.cart.length > 0) toast.info("Lançamento em andamento recuperado.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDirect = kind === "salary" || kind === "partner";
  const partyName = kind === "salary" ? "Colaboradores da empresa" : kind === "partner" ? partners.find((p) => p.id === partnerId)?.name ?? "" : suppliers.find((s) => s.id === supplierId)?.tradeName || suppliers.find((s) => s.id === supplierId)?.companyName || "";

  const itemsTotal = cart.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const freightNum = Number(freight || 0);
  const otherNum = Number(otherCosts || 0);
  const discountNum = Number(discount || 0);
  const total = Math.round((itemsTotal + freightNum + otherNum - discountNum) * 100) / 100;
  // Rateio proporcional ao subtotal: despesas aumentam e desconto reduz o custo unitário de aquisição.
  const landedFactor = itemsTotal > 0 ? (itemsTotal + freightNum + otherNum - discountNum) / itemsTotal : 1;

  const snapshot: LaunchDraft = {
    kind, supplierId, partnerId, competence, documentRef, documentSeries, documentIssueDate, documentAccessKey, batch, expiryDate,
    cart, freight, discount, received, paymentMethod, paymentCondition, installmentCount, baseDate, recipientKey, recipientHolder, observations, otherCosts,
  };

  function applyDraft(d: LaunchDraft) {
    setKind(d.kind);
    setSupplierId(d.supplierId);
    setPartnerId(d.partnerId);
    setCompetence(d.competence);
    setDocumentRef(d.documentRef);
    setDocumentSeries(d.documentSeries);
    setDocumentIssueDate(d.documentIssueDate);
    setDocumentAccessKey(d.documentAccessKey);
    setBatch(d.batch);
    setExpiryDate(d.expiryDate);
    setCart(d.cart);
    setFreight(d.freight);
    setDiscount(d.discount);
    setReceived(d.received);
    setPaymentMethod(d.paymentMethod);
    setPaymentCondition(d.paymentCondition);
    setInstallmentCount(d.installmentCount);
    setBaseDate(d.baseDate);
    setRecipientKey(d.recipientKey);
    setRecipientHolder(d.recipientHolder);
    setObservations(d.observations);
    setOtherCosts(d.otherCosts ?? "0");
  }

  const sync = usePurchaseDraftSync(snapshot, partyName, { id: draft?.serverDraftId ?? null, version: draft?.serverVersion ?? 0 }, applyDraft);
  const serverDrafts = usePurchaseStore((s) => s.drafts);
  const otherDrafts = serverDrafts.filter((d) => d.id !== sync.draftId);

  useEffect(() => {
    saveDraft({ ...snapshot, serverDraftId: sync.draftId, serverVersion: sync.version.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(snapshot), sync.draftId, sync.status]);

  const equalize = useCallback((count: number, totalValue: number) => {
    const cents = Math.max(0, Math.round(totalValue * 100));
    const n = Math.max(1, count);
    const next: Parcel[] = [];
    for (let i = 0; i < n; i++) {
      const amount = (Math.floor(cents / n) + (i < cents % n ? 1 : 0)) / 100;
      next.push({ number: i + 1, amount, dueDate: baseDate, scheduledPaymentAt: baseDate });
    }
    setParcels(next);
  }, [baseDate]);

  useEffect(() => {
    equalize(isDirect ? 1 : installmentCount, total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, installmentCount, isDirect]);

  const [preselectHandled, setPreselectHandled] = useState(false);
  useEffect(() => {
    if (!preselectedMaterialId || preselectHandled || materials.length === 0) return;
    const material = materials.find((m) => m.id === preselectedMaterialId);
    if (!material) return;
    setPreselectHandled(true);
    if (material.primarySupplierId) {
      setSupplierId(material.primarySupplierId);
      addRawMaterial(preselectedMaterialId, material.primarySupplierId);
    } else {
      toast.info("Selecione o fornecedor para adicionar este insumo ao lançamento.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedMaterialId, preselectHandled, materials]);

  function selectKind(k: LaunchKind) {
    if (cart.length > 0 && k !== kind) {
      if (!confirm("Trocar o tipo limpa o carrinho atual. Continuar?")) return;
    }
    setKind(k);
    setCart([]);
    setSupplierId("");
    setPartnerId("");
    setSearch("");
    setCategoryFilter("");
    setReceived(k !== "salary" && k !== "partner");
    setPaymentMethod(k === "salary" || k === "partner" ? "pix" : "boleto");
  }

  function addRawMaterial(materialId: string, supplierOverride?: string) {
    const material = materials.find((m) => m.id === materialId);
    if (!material) return;
    addMaterialLine(material, supplierOverride);
  }

  function addMaterialLine(material: RawMaterial, supplierOverride?: string) {
    const materialId = material.id;
    const effectiveSupplier = supplierOverride ?? supplierId;
    if (!effectiveSupplier) {
      toast.error("Selecione o fornecedor primeiro.");
      return;
    }
    const existing = cart.find((l) => l.rawMaterialId === materialId);
    if (existing) {
      setCart((prev) => prev.map((l) => (l.rawMaterialId === materialId ? { ...l, quantity: l.quantity + 1 } : l)));
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        cid: uid(), kind: "stock", rawMaterialId: material.id, sku: material.code, name: material.name, unit: material.controlUnit,
        quantity: 1, unitPrice: material.lastPurchaseCost ?? material.avgCost ?? 0, rateable: false, contractLabel: "Principal",
        recurrence: defaultRecurrence(today()), destLabel: KIND_LABEL.stock.dest,
      },
    ]);
    toast.success("Item adicionado ao lançamento.");
  }

  function addPurchaseItem(item: PurchaseCatalogItem) {
    if (!supplierId) {
      toast.error("Selecione o fornecedor primeiro.");
      return;
    }
    const isProduct = item.itemType === "PRODUCT";
    const merged = cart.some((line) => (isProduct ? line.productId : line.rawMaterialId) === item.itemId);
    setCart((prev) => {
      const index = prev.findIndex((line) => (isProduct ? line.productId : line.rawMaterialId) === item.itemId);
      if (index >= 0) {
        return prev.map((line, i) => (i === index ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [
        ...prev,
        {
          cid: uid(), kind: "stock" as const, rawMaterialId: isProduct ? undefined : item.itemId, productId: isProduct ? item.itemId : undefined,
          sku: item.sku, gtin: item.gtin, brand: item.brand, tracksLots: item.tracksLots, name: item.name, unit: item.unit, quantity: 1,
          unitPrice: item.lastPurchaseCost ?? (item.avgCost > 0 ? item.avgCost : 0), rateable: false, contractLabel: "Principal",
          recurrence: defaultRecurrence(today()), destLabel: KIND_LABEL.stock.dest,
        },
      ];
    });
    toast.success(merged ? "Quantidade somada na mesma linha." : "Item adicionado à compra.");
  }

  function addCatalogItem(itemId: string) {
    const item = catalogItems.find((i) => i.id === itemId);
    if (!item) return;
    if (!partyName) {
      toast.error(kind === "partner" ? "Selecione o sócio primeiro." : "Selecione o fornecedor ou favorecido primeiro.");
      return;
    }
    const commitment = findCommitment(kind, partyName, "Principal", undefined, itemId);
    if (commitment) {
      toast.info(`Recorrência já ativa para este item com ${partyName}. Contrato: ${commitment.contractLabel}.`);
      return;
    }
    const existing = cart.find((l) => l.catalogItemId === itemId);
    if (existing) {
      setCart((prev) => prev.map((l) => (l.catalogItemId === itemId ? { ...l, quantity: l.quantity + 1 } : l)));
      return;
    }
    const category = categories.find((c) => c.id === item.categoryId);
    setCart((prev) => [
      ...prev,
      {
        cid: uid(), kind: item.kind, categoryId: item.categoryId ?? undefined, catalogItemId: item.id, name: item.name, unit: item.unit,
        quantity: 1, unitPrice: item.suggestedPrice, rateable: category?.rateable ?? false, contractLabel: "Principal",
        recurrence: defaultRecurrence(today()), destLabel: KIND_LABEL[item.kind].dest,
      },
    ]);
    toast.success("Item adicionado ao lançamento.");
  }

  function updateLine(cid: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.cid === cid ? { ...l, ...patch } : l)));
  }

  function removeLine(cid: string) {
    setCart((prev) => prev.filter((l) => l.cid !== cid));
  }

  function addSalaryLine(employee: Employee, breakdown: { extra: number; discount: number }) {
    const advancePaid = advances
      .filter((a) => obligations.some((o) => o.employeeId === employee.id && o.id === a.obligationId) && a.status === "PAGO")
      .reduce((s, a) => s + a.amount, 0);
    const net = (employee.salaryBase ?? 0) + breakdown.extra - breakdown.discount - advancePaid;
    setCart((prev) => [
      ...prev.filter((l) => !(l.employeeId === employee.id && l.payrollType === "salary")),
      {
        cid: uid(), kind: "salary", employeeId: employee.id, name: `Salário — ${employee.name}`, unit: "mês", quantity: 1, unitPrice: net,
        rateable: false, contractLabel: "Folha mensal", payrollType: "salary", breakdown: { ...breakdown, advance: advancePaid, base: employee.salaryBase ?? 0 },
        recurrence: defaultRecurrence(today()), destLabel: KIND_LABEL.salary.dest,
      },
    ]);
  }

  function addAdvanceLine(employee: Employee, amount: number) {
    setCart((prev) => [
      ...prev,
      {
        cid: uid(), kind: "salary", employeeId: employee.id, name: `Vale — ${employee.name}`, unit: "un", quantity: 1, unitPrice: amount,
        rateable: false, contractLabel: "Vale", payrollType: "advance", recurrence: defaultRecurrence(today()), destLabel: KIND_LABEL.salary.dest,
      },
    ]);
  }

  const alreadySalaried = (employeeId: string) => obligations.some((o) => o.employeeId === employeeId && o.competence.slice(0, 7) === competence.slice(0, 7));

  const fetchSupplierOptions = useCallback(
    async (query: string): Promise<ComboboxOption[]> => {
      const text = query.trim().toLowerCase();
      return suppliers
        .filter((s) => !text || [s.name, s.companyName, s.tradeName, s.cnpj, s.phone].some((field) => (field || "").toLowerCase().includes(text)))
        .slice(0, 20)
        .map((s) => ({ value: s.id, label: s.tradeName || s.companyName, sublabel: [s.name, s.cnpj].filter(Boolean).join(" · ") || undefined }));
    },
    [suppliers]
  );

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (kind === "stock") {
      return materials.filter((m) => (!categoryFilter || m.category === categoryFilter) && (!q || m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q)));
    }
    if (kind === "salary") return [];
    return catalogItems.filter((i) => i.kind === kind && (!categoryFilter || i.categoryId === categoryFilter) && (!q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)));
  }, [kind, materials, catalogItems, search, categoryFilter]);

  async function submit() {
    if (kind !== "salary" && !partyName) {
      toast.error(kind === "partner" ? "Selecione o sócio." : "Selecione o fornecedor/favorecido.");
      return;
    }
    if (cart.length === 0) {
      toast.error("Adicione pelo menos um item.");
      return;
    }
    if (cart.some((l) => !(l.quantity > 0) || l.unitPrice < 0)) {
      toast.error("Revise quantidades e custos informados.");
      return;
    }
    if (cart.some((l) => l.productId && !Number.isInteger(l.quantity))) {
      toast.error("Produtos para revenda usam quantidade inteira.");
      return;
    }
    if (total < 0) {
      toast.error("O desconto não pode ultrapassar o valor total da compra.");
      return;
    }
    if (cart.some((l) => l.tracksLots) && (batch.trim() === "" || expiryDate === "")) {
      toast.error("Há item com rastreamento de lote: informe Lote e Validade nos dados da nota.");
      return;
    }
    const parcelSum = Math.round(parcels.reduce((s, p) => s + p.amount, 0) * 100);
    if (parcelSum !== Math.round(total * 100)) {
      toast.error("A soma das parcelas precisa conferir com o total.");
      return;
    }

    const items: LaunchItemInput[] = cart.map((l) => ({
      kind: l.kind,
      categoryId: l.categoryId,
      rawMaterialId: l.rawMaterialId,
      productId: l.productId,
      controlUnitQuantity: l.kind === "stock" ? true : undefined,
      catalogItemId: l.catalogItemId,
      employeeId: l.employeeId,
      nameSnapshot: l.name,
      description: l.description,
      unit: l.unit,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      rateable: l.rateable,
      contractLabel: l.contractLabel,
      payrollType: l.payrollType,
      referenceExpenseId: l.referenceExpenseId,
      breakdown: l.breakdown ? { extra: l.breakdown.extra, discount: l.breakdown.discount } : undefined,
      recurrence: l.recurrence,
    }));

    const installments: InstallmentInput[] = parcels.map((p) => ({
      number: p.number,
      amount: p.amount,
      dueDate: p.dueDate,
      // Agendamento de pagamento pelo Asaas ainda não existe — nenhuma Edge Function agenda nada.
      // Nunca enviar essa data como se fosse um agendamento real (ver nota na seção de pagamento).
      scheduledPaymentAt: undefined,
    }));

    setSubmitting(true);
    const { launchId, error } = await createLaunch({
      kind,
      partyType: kind === "salary" ? "employee" : kind === "partner" ? "partner" : "supplier",
      partyName,
      supplierId: kind === "stock" || kind === "asset" || kind === "expense" ? supplierId || undefined : undefined,
      partnerId: kind === "partner" ? partnerId || undefined : undefined,
      competence,
      documentRef: documentRef || undefined,
      documentSeries: documentSeries || undefined,
      documentIssueDate: documentIssueDate || undefined,
      documentAccessKey: documentAccessKey || undefined,
      batch: kind === "stock" ? batch || undefined : undefined,
      expiryDate: kind === "stock" ? expiryDate || undefined : undefined,
      freight: freightNum,
      otherCosts: otherNum,
      discount: discountNum,
      duplicateReason: duplicateReason?.trim() || undefined,
      received: isDirect ? false : received,
      paymentMethod,
      paymentCondition: isDirect ? undefined : paymentCondition,
      scheduled: false,
      recipientKey: recipientKey || undefined,
      recipientHolder: recipientHolder || undefined,
      observations: observations || undefined,
      items,
      installments,
      idempotencyKey: uid(),
    });
    setSubmitting(false);

    if (error?.includes("NOTA_DUPLICADA")) {
      setDuplicateReason((current) => current ?? "");
      toast.error("Já existe lançamento deste fornecedor com a mesma nota. Informe o motivo para registrar novamente.");
      return;
    }
    if (error || !launchId) {
      toast.error(error ?? "Não foi possível registrar o lançamento");
      return;
    }
    await sync.finish("DONE");
    clearDraft();
    toast.success("Lançamento registrado. A Visão Geral já reflete a alteração.");
    navigate(withContext("/admin/despesas", params));
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="text-xs" style={{ color: C.muted }}>Início › Despesas › Novo lançamento</div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: C.green }}>Compras e Despesas</h1>
          <p className="text-sm" style={{ color: C.muted }}>Um só lugar para registrar os compromissos da empresa.</p>
        </div>
        <button onClick={() => navigate(withContext("/admin/despesas", params))} className="rounded-xl border px-3.5 py-2.5 text-sm font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>
          ← Visão Geral
        </button>
      </header>

      {otherDrafts.length > 0 && (
        <div role="status" className="flex flex-col gap-2 rounded-[14px] border p-3.5" style={{ borderColor: "#e4dcc6", background: "#fcf8ed" }}>
          <strong className="text-sm" style={{ color: C.green }}>Há rascunhos de compra em andamento</strong>
          {otherDrafts.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: C.muted }}>
              <span>
                {d.supplierLabel || "Sem fornecedor"} {d.documentRef ? `· NF ${d.documentRef}` : ""} · atualizado {new Date(d.updatedAt).toLocaleString("pt-BR")}
              </span>
              <span className="flex gap-2">
                <button onClick={() => void sync.resume(d.id)} className="rounded-lg border px-2.5 py-1.5 font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>Retomar</button>
                <button onClick={() => void usePurchaseStore.getState().closeDraft(d.id, "DISCARDED")} className="rounded-lg border px-2.5 py-1.5 font-bold" style={{ borderColor: "#d8dfd7", color: "#a6433a" }}>Descartar</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {sync.status === "conflict" && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border p-3.5 text-sm" style={{ borderColor: "#e8b4ae", background: "#fbeceb", color: "#a6433a" }}>
          <span><strong>Este rascunho foi alterado em outra aba.</strong> Para não sobrescrever a versão mais nova, o salvamento automático parou.</span>
          <button onClick={() => void sync.reloadNewest()} className="rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: "#a6433a" }}>Recarregar versão mais nova</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 style={{ color: C.green }}>O que você vai lançar?</h3>
        <button onClick={() => setShowCategories(true)} className="rounded-xl border px-3 py-2 text-xs font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>
          <Settings2 size={13} className="mr-1 inline" /> Categorias
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => selectKind(k)}
            className="rounded-[14px] border p-3.5 text-left"
            style={kind === k ? { border: `2px solid ${C.accent}`, background: "#f0f7ef" } : { borderColor: "#dfe3d8", background: "#fff" }}
          >
            <span className="mb-2.5 flex h-[38px] w-[38px] items-center justify-center rounded-xl text-xl" style={{ background: "#f0f3ec", color: "#477b59" }}>{KIND_LABEL[k].icon}</span>
            <strong className="block text-[13px]" style={{ color: C.green }}>{KIND_LABEL[k].name}</strong>
            <small className="mt-1 block text-[11px]" style={{ color: C.muted }}>{KIND_LABEL[k].sub}</small>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 overflow-hidden rounded-[20px] border bg-white lg:grid-cols-[1fr_1.9fr]" style={{ borderColor: C.line }}>
        <div className="p-[22px] lg:border-r" style={{ borderColor: C.line }}>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold" style={{ color: C.green }}>
              {kind === "salary" ? "Origem dos dados" : kind === "partner" ? "Sócio *" : "Fornecedor / favorecido *"}
            </label>
            {kind !== "salary" && (
              <button onClick={() => navigate(kind === "partner" ? "/admin/aportes" : "/admin/fornecedores")} className="text-xs font-bold" style={{ color: C.accent }}>+ Novo</button>
            )}
          </div>
          {kind === "salary" ? (
            <p className="rounded-[10px] border px-3 py-3 text-sm" style={{ borderColor: C.line, color: C.muted }}>Colaboradores da empresa</p>
          ) : kind === "partner" ? (
            <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={fieldCls} style={{ borderColor: C.line }}>
              <option value="">Selecionar sócio...</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : (
            <Combobox placeholder="Buscar ou selecionar fornecedor..." selectedLabel={partyName} fetchOptions={fetchSupplierOptions} onSelect={(o) => setSupplierId(o.value)} />
          )}
          <p className="mt-2 text-[11px]" style={{ color: C.muted }}>Um favorecido por lançamento. Selecione antes de configurar a recorrência.</p>
        </div>

        <div className="p-[22px]">
          <h2 className="mb-3 text-sm font-bold" style={{ color: C.green }}>Dados da Nota Fiscal <span className="font-normal" style={{ color: C.muted }}>(opcional)</span></h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs"><span className="mb-1.5 block font-semibold">Competência *</span><input type="month" value={competence.slice(0, 7)} onChange={(e) => setCompetence(e.target.value + "-01")} className={fieldCls} style={{ borderColor: C.line }} /></label>
            <label className="text-xs"><span className="mb-1.5 block font-semibold">Nº nota / documento</span><input value={documentRef} onChange={(e) => setDocumentRef(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} /></label>
            <label className="text-xs"><span className="mb-1.5 block font-semibold">Data de emissão</span><input type="date" value={documentIssueDate} onChange={(e) => setDocumentIssueDate(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} /></label>
            <label className="text-xs"><span className="mb-1.5 block font-semibold">Série</span><input value={documentSeries} onChange={(e) => setDocumentSeries(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} /></label>
          </div>
          {kind === "stock" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs"><span className="mb-1.5 block font-semibold">Lote{cart.some((l) => l.tracksLots) ? " *" : ""}</span><input value={batch} onChange={(e) => setBatch(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} /></label>
              <label className="text-xs"><span className="mb-1.5 block font-semibold">Validade{cart.some((l) => l.tracksLots) ? " *" : ""}</span><input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} /></label>
            </div>
          )}
          <label className="mt-3 block text-xs"><span className="mb-1.5 block font-semibold">Chave de acesso da NF-e (opcional)</span><input value={documentAccessKey} onChange={(e) => setDocumentAccessKey(e.target.value)} maxLength={44} className={fieldCls} style={{ borderColor: C.line }} /></label>
        </div>
      </div>

      {kind === "stock" && (
        <nav aria-label="Seções de compras e estoque" className="flex flex-wrap items-center gap-2">
          {[
            { label: "Nova compra", to: null },
            { label: "Itens cadastrados", to: "/admin/estoque?aba=itens" },
            { label: "Produto e margem", to: "/admin/produtos" },
            { label: "Estoque", to: "/admin/estoque" },
          ].map((tab) => (
            <button
              key={tab.label}
              onClick={() => tab.to && navigate(tab.to)}
              className="rounded-xl border px-3.5 py-2 text-sm font-bold"
              style={tab.to === null ? { background: C.green, color: "#fff", borderColor: C.green } : { borderColor: "#d8dfd7", color: C.green }}
            >
              {tab.label}
            </button>
          ))}
          <span className="ml-auto text-xs" style={{ color: C.muted }} role="status">
            {sync.status === "saving" ? "Salvando..." : sync.status === "saved" && sync.savedAt ? `Rascunho salvo automaticamente · ${sync.savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : sync.status === "error" ? "Não foi possível salvar no servidor; mantido neste navegador" : "Rascunho salvo automaticamente"}
          </span>
        </nav>
      )}

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.14fr_1fr] lg:items-start">
        {kind === "stock" && (
          <StockCatalogPanel
            supplierId={supplierId}
            onAdd={addPurchaseItem}
            onQuickCreate={(barcode) => (supplierId ? setQuick({ barcode: barcode ?? "" }) : toast.error("Selecione o fornecedor primeiro."))}
          />
        )}
        {kind !== "stock" && <div className="rounded-[20px] border bg-white" style={{ borderColor: C.line }}>
          <div className="flex items-center justify-between gap-2 border-b p-[21px]" style={{ borderColor: C.line }}>
            <h2 className="text-[19px] font-bold" style={{ color: C.green }}>{kind === "salary" ? "Colaboradores" : "Selecionar itens"}</h2>
            {kind !== "salary" && (
              <button onClick={() => setShowNewItem(true)} className="rounded-xl border px-3 py-2 text-xs font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>+ Cadastrar item</button>
            )}
          </div>
          {kind !== "salary" && (
            <div className="flex gap-2.5 p-[18px]">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou código..." className="flex-1 rounded-[10px] border px-3 py-3 text-sm" style={{ borderColor: C.line }} />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-[180px] rounded-[10px] border px-3 py-3 text-sm" style={{ borderColor: C.line }}>
                <option value="">Todas as categorias</option>
                {categories.filter((c) => c.kind === kind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div className="max-h-[520px] overflow-y-auto">
            {kind === "salary" ? (
              employees.filter((e) => e.name.toLowerCase().includes(search.toLowerCase())).map((e) => (
                <div key={e.id} className="border-b p-[17px_20px]" style={{ borderColor: C.line }}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-[38px] w-[38px] items-center justify-center rounded-xl text-xl" style={{ background: "#f0f3ec", color: "#477b59" }}>♙</span>
                    <div><strong style={{ color: C.green }}>{e.name}</strong><p className="text-xs" style={{ color: C.muted }}>{e.role} · Base {brl(e.salaryBase ?? 0)}</p></div>
                  </div>
                  <div className="mt-3 flex gap-1.5">
                    <button onClick={() => (alreadySalaried(e.id) ? toast.info("Já existe apuração deste colaborador nesta competência.") : setSalaryModalEmployee(e))} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>
                      {alreadySalaried(e.id) ? "Apuração já registrada" : "Apurar mês"}
                    </button>
                    <button onClick={() => setAdvanceModalEmployee(e)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>+ Vale</button>
                  </div>
                </div>
              ))
            ) : filteredCatalog.length === 0 ? (
              <p className="p-14 text-center text-sm" style={{ color: C.muted }}>Nenhum item encontrado. Cadastre um novo item.</p>
            ) : (
              (filteredCatalog as typeof catalogItems).map((i) => {
                const recurring = findCommitment(kind, partyName, "Principal", undefined, i.id);
                return (
                  <div key={i.id} className="grid grid-cols-[42px_1fr_110px_86px] items-center gap-2.5 border-b p-[15px_20px]" style={{ borderColor: "#eff0eb" }}>
                    <span className="flex h-[38px] w-[38px] items-center justify-center rounded-xl text-lg" style={{ background: "#f0f3ec", color: "#477b59" }}>{KIND_LABEL[i.kind].icon}</span>
                    <div>
                      <strong className="block text-[13px]" style={{ color: C.green }}>{i.name}</strong>
                      <small style={{ color: C.muted }}>{i.code} · {brl(i.suggestedPrice)} / {i.unit}</small>
                      {recurring && <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px]" style={{ background: "#eef4e8" }}>↻ Recorrência ativa</span>}
                    </div>
                    <span className="text-xs" style={{ color: "#7a8076" }}>{categories.find((c) => c.id === i.categoryId)?.name ?? "-----"}</span>
                    <button onClick={() => addCatalogItem(i.id)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>+ Adicionar</button>
                  </div>
                );
              })
            )}
          </div>
        </div>}

        <div className="rounded-[20px] border bg-white" style={{ borderColor: C.line }}>
          <div className="flex items-center justify-between gap-2 border-b p-[21px]" style={{ borderColor: C.line }}>
            <h2 className="text-[19px] font-bold" style={{ color: C.green }}>▱ {kind === "stock" ? "Itens desta compra" : "Itens do lançamento"} <span className="ml-1 rounded-full px-2 py-0.5 text-xs" style={{ background: "#eaf4ec", color: "#28734e" }}>{cart.length}</span></h2>
            {cart.length > 0 && <button onClick={() => setCart([])} className="rounded-xl border px-2.5 py-1.5 text-xs font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>Limpar</button>}
          </div>

          {cart.length === 0 ? (
            <div className="p-14 text-center" style={{ color: C.muted }}>
              <div className="mb-3 text-3xl">▱</div>
              <strong style={{ color: C.green }}>Monte seu lançamento</strong>
              <p className="mt-1 text-sm">Selecione os itens na lista ao lado.</p>
            </div>
          ) : (
            <div>
              {cart.map((l) => (
                <div key={l.cid} className="border-b p-[15px_20px]" style={{ borderColor: C.line }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <strong style={{ color: C.green }}>{l.name}</strong>
                      {l.kind === "stock" && (
                        <div className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
                          {l.sku ? `${l.sku} · ` : ""}unidade de controle: {l.unit} · custo rateado: {brl(l.unitPrice * landedFactor)}/{l.unit}
                        </div>
                      )}
                      <div className="mt-1 flex gap-1.5 text-[11px]">
                        <span className="rounded-full px-2 py-0.5" style={{ background: "#eaf4ec", color: "#28734e" }}>{l.destLabel}</span>
                        {l.kind === "expense" && <span className="rounded-full px-2 py-0.5" style={{ background: l.rateable ? "#eaf4ec" : "#faf0d7", color: l.rateable ? "#28734e" : "#977021" }}>{l.rateable ? "Participa do rateio" : "Sem rateio"}</span>}
                      </div>
                    </div>
                    <button onClick={() => removeLine(l.cid)} aria-label="Remover item" className="px-1 text-xl" style={{ color: "#9e5c4d" }}>×</button>
                  </div>
                  {l.payrollType ? (
                    <p className="mt-2 text-xs" style={{ color: C.muted }}>{brl(l.quantity * l.unitPrice)} · {l.payrollType === "advance" ? "Vale/adiantamento" : "Apuração mensal"}</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-[80px_40px_110px_1fr] items-end gap-2">
                      <label className="text-[10px]" style={{ color: C.muted }}>{l.kind === "stock" ? `Quantidade (${l.unit})` : "Quantidade"}
                        <input type="number" min={0.001} step="any" value={l.quantity} onChange={(e) => updateLine(l.cid, { quantity: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" style={{ borderColor: C.line }} />
                      </label>
                      <span className="pb-2 text-xs" style={{ color: C.muted }}>{l.unit}</span>
                      <label className="text-[10px]" style={{ color: C.muted }}>{l.kind === "stock" ? `Custo por ${l.unit} (R$)` : "Valor unitário"}
                        <input type="number" min={0} step="any" value={l.unitPrice} onChange={(e) => updateLine(l.cid, { unitPrice: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" style={{ borderColor: C.line }} />
                      </label>
                      <strong className="pb-2 text-right text-sm" style={{ color: C.green }}>{brl(l.quantity * l.unitPrice)}</strong>
                    </div>
                  )}
                  {!l.payrollType && (
                    <label className="mt-3 block text-[10px]" style={{ color: C.muted }}>Descrição (opcional) — detalhe o que diferencia este item
                      <input
                        value={l.description ?? ""}
                        onChange={(e) => updateLine(l.cid, { description: e.target.value })}
                        placeholder="Ex.: rótulo colorau/açafrão 200g, 10 mil unidades"
                        className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                        style={{ borderColor: C.line }}
                      />
                    </label>
                  )}
                  {l.kind === "expense" && (
                    <label className="mt-3 flex items-center gap-2 text-xs" style={{ color: C.green }}>
                      <input type="checkbox" checked={l.rateable} onChange={(e) => updateLine(l.cid, { rateable: e.target.checked })} />
                      Participa do rateio para formação do preço
                    </label>
                  )}
                  {!l.payrollType && (
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: C.muted }}>
                        {l.recurrence.enabled ? `↻ ${frequencyLabel(l.recurrence)} · ${l.recurrence.variableAmount ? "valor variável" : "valor fixo"}` : "Lançamento avulso"}
                        {l.contractLabel !== "Principal" && <><br />{l.contractLabel}</>}
                      </span>
                      <button onClick={() => setConfigLine(l)} className="text-xs font-bold" style={{ color: C.accent }}>Recorrência / detalhes</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="p-[18px_20px]" style={{ background: "#fcfbf6" }}>
            {kind === "stock" && (
              <>
                <h3 className="mb-1 text-sm font-bold" style={{ color: C.green }}>Valores adicionais da compra</h3>
                <p className="mb-2 text-[11px]" style={{ color: C.muted }}>Frete e outras despesas aumentam o custo dos itens; o desconto reduz. O sistema rateia proporcionalmente ao valor de cada item.</p>
                <div className="mb-3.5 grid grid-cols-3 gap-3">
                  <label className="text-xs"><span className="mb-1 block font-semibold">Frete (R$)</span><input type="number" min={0} step="0.01" value={freight} onChange={(e) => setFreight(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} /></label>
                  <label className="text-xs"><span className="mb-1 block font-semibold">Outras despesas (R$)</span><input type="number" min={0} step="0.01" value={otherCosts} onChange={(e) => setOtherCosts(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} /></label>
                  <label className="text-xs"><span className="mb-1 block font-semibold">Desconto total (R$)</span><input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} /></label>
                </div>
                <dl className="mb-3 grid grid-cols-[1fr_auto] gap-y-1 text-xs" style={{ color: C.muted }}>
                  <dt>Subtotal dos itens</dt><dd className="text-right">{brl(itemsTotal)}</dd>
                  <dt>Frete + outras despesas</dt><dd className="text-right">{brl(freightNum + otherNum)}</dd>
                  <dt>Desconto</dt><dd className="text-right">− {brl(discountNum)}</dd>
                </dl>
              </>
            )}
            {!isDirect && kind !== "stock" && (
              <div className="mb-3.5 grid grid-cols-2 gap-3">
                <label className="text-xs"><span className="mb-1 block font-semibold">Acréscimos / frete (R$)</span><input type="number" min={0} step="0.01" value={freight} onChange={(e) => setFreight(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} /></label>
                <label className="text-xs"><span className="mb-1 block font-semibold">Desconto (R$)</span><input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} /></label>
              </div>
            )}
            <div className="flex items-center justify-between">
              <strong style={{ color: C.green }}>{kind === "stock" ? "Total da compra" : "Total"}</strong>
              <strong className="text-2xl" style={{ color: C.green }}>{brl(total)}</strong>
            </div>
          </div>

          <div className="border-t p-[22px]" style={{ borderColor: C.line }}>
            {!isDirect && (
              <label className="mb-4 flex items-start gap-2 rounded-[10px] p-[13px]" style={{ background: "#f4f7f0" }}>
                <input type="checkbox" checked={received} onChange={(e) => setReceived(e.target.checked)} className="mt-0.5" />
                <span className="text-xs leading-relaxed"><strong style={{ color: C.green }}>Itens recebidos / serviço realizado</strong><br />Desmarque quando ainda estiver aguardando. Não confirma pagamento.</span>
              </label>
            )}
            <h3 className="mb-3" style={{ color: C.green }}>{isDirect ? "Pagamento" : "Condição e forma de pagamento"}</h3>
            <div className="mb-3 grid grid-cols-2 gap-3">
              {!isDirect && (
                <label className="text-xs"><span className="mb-1 block font-semibold">Condição</span>
                  <select value={paymentCondition} onChange={(e) => { setPaymentCondition(e.target.value as "term" | "cash"); setInstallmentCount(1); }} className={fieldCls} style={{ borderColor: C.line }}>
                    <option value="term">A prazo</option><option value="cash">À vista</option>
                  </select>
                </label>
              )}
              <label className="text-xs"><span className="mb-1 block font-semibold">Forma</span>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={fieldCls} style={{ borderColor: C.line }}>
                  {!isDirect && <option value="boleto">Boleto</option>}
                  <option value="pix">Pix</option><option value="transfer">Transferência</option><option value="cash">Dinheiro</option>
                </select>
              </label>
            </div>
            {!isDirect && (
              <div className="mb-3 grid grid-cols-2 gap-3">
                <label className="text-xs"><span className="mb-1 block font-semibold">Quantidade de parcelas</span>
                  <input type="number" min={1} max={24} value={installmentCount} disabled={paymentCondition === "cash"} onChange={(e) => setInstallmentCount(Number(e.target.value) || 1)} className={fieldCls} style={{ borderColor: C.line }} />
                </label>
                <label className="text-xs"><span className="mb-1 block font-semibold">Data-base dos prazos</span>
                  <input type="date" value={baseDate} onChange={(e) => setBaseDate(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} />
                </label>
              </div>
            )}

            {["pix", "transfer"].includes(paymentMethod) && (
              <div className="mb-3 grid grid-cols-2 gap-3 rounded-[12px] border p-[13px]" style={{ borderColor: C.line }}>
                <label className="text-xs"><span className="mb-1 block font-semibold">{paymentMethod === "pix" ? "Chave Pix" : "Banco / agência / conta"}</span><input value={recipientKey} onChange={(e) => setRecipientKey(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} /></label>
                <label className="text-xs"><span className="mb-1 block font-semibold">Titular</span><input value={recipientHolder} onChange={(e) => setRecipientHolder(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} /></label>
              </div>
            )}

            {!isDirect && (
              <div className="mb-3 flex items-start gap-2 rounded-[10px] p-[13px]" style={{ background: "#f4f7f0" }}>
                <span className="mt-0.5 text-xs">⚠</span>
                <span className="text-xs leading-relaxed"><strong style={{ color: C.green }}>Agendamento de pagamento via Asaas — indisponível</strong><br />Esta integração ainda não foi implementada. O vencimento de cada parcela abaixo é só a data de referência da despesa, não um agendamento no Asaas.</span>
              </div>
            )}

            <div className="rounded-[12px] border p-[13px]" style={{ borderColor: C.line }}>
              {parcels.map((p, idx) => (
                <div key={p.number} className="mb-2.5 rounded-[12px] border p-[13px]" style={{ borderColor: C.line }}>
                  <div className="mb-2.5 flex items-center justify-between">
                    <strong className="text-sm" style={{ color: C.green }}>{paymentMethod === "boleto" ? "Boleto" : "Parcela"} {p.number}</strong>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="text-xs"><span className="mb-1 block font-semibold">Valor (R$)</span>
                      <input type="number" min={0.01} step="0.01" value={p.amount} onChange={(e) => setParcels((prev) => prev.map((x, i) => (i === idx ? { ...x, amount: Number(e.target.value) } : x)))} className={fieldCls} style={{ borderColor: C.line }} />
                    </label>
                    <label className="text-xs"><span className="mb-1 block font-semibold">Vencimento *</span>
                      <input type="date" value={p.dueDate} onChange={(e) => setParcels((prev) => prev.map((x, i) => (i === idx ? { ...x, dueDate: e.target.value } : x)))} className={fieldCls} style={{ borderColor: C.line }} />
                    </label>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: Math.round(parcels.reduce((s, p) => s + p.amount, 0) * 100) === Math.round(total * 100) ? "#387747" : "#a26337" }}>
                  {Math.round(parcels.reduce((s, p) => s + p.amount, 0) * 100) === Math.round(total * 100) ? "✓ Soma das parcelas confere" : "Diferença na soma das parcelas"}
                </span>
                <button onClick={() => equalize(isDirect ? 1 : installmentCount, total)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>Redistribuir valores</button>
              </div>
            </div>

            <label className="mt-3.5 block text-xs"><span className="mb-1 block font-semibold">Observações</span>
              <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={2} className={fieldCls} style={{ borderColor: C.line }} />
            </label>

            {duplicateReason !== null && (
              <div role="alert" className="mt-4 rounded-[12px] border p-3.5" style={{ borderColor: "#e4dcc6", background: "#fcf8ed" }}>
                <p className="text-xs font-semibold" style={{ color: C.green }}>Existe lançamento deste fornecedor com o mesmo número e série. Informe por que este lançamento adicional é necessário.</p>
                <input value={duplicateReason} onChange={(e) => setDuplicateReason(e.target.value)} placeholder="Ex.: nota complementar, segunda via com itens diferentes" className={`mt-2 ${fieldCls}`} style={{ borderColor: C.line }} />
              </div>
            )}
            {kind === "stock" && (
              <p className="mt-4 text-[11px]" style={{ color: C.muted }}>A entrada no estoque é registrada ao confirmar a compra, pela quantidade recebida.</p>
            )}
            <Button onClick={() => void submit()} disabled={submitting || (duplicateReason !== null && duplicateReason.trim() === "")} className="mt-2 w-full">
              {submitting ? "Registrando..." : kind === "stock" ? (received ? "Confirmar compra e entrada no estoque" : "Registrar compra (aguardando recebimento)") : "Registrar lançamento"}
            </Button>
            {kind === "stock" && (
              <Button type="button" variant="outline" className="mt-2 w-full" onClick={() => void sync.saveNow()}>
                Salvar rascunho
              </Button>
            )}
          </div>
        </div>
      </div>

      {configLine && <ItemConfigModal line={configLine} onClose={() => setConfigLine(null)} onSave={(patch) => updateLine(configLine.cid, patch)} />}
      {showCategories && <CategoriesModal kind={kind} onClose={() => setShowCategories(false)} />}
      {showNewItem && <NewItemModal kind={kind} onClose={() => setShowNewItem(false)} />}
      {quick && (
        <QuickItemModal supplierId={supplierId} initialBarcode={quick.barcode} onClose={() => setQuick(null)} onCreated={addPurchaseItem} />
      )}
      {salaryModalEmployee && (
        <SalaryApurationModal
          employee={salaryModalEmployee}
          competence={competence}
          advancePaid={advances.filter((a) => obligations.some((o) => o.id === a.obligationId && o.employeeId === salaryModalEmployee.id) && a.status === "PAGO").reduce((s, a) => s + a.amount, 0)}
          onClose={() => setSalaryModalEmployee(null)}
          onSave={(breakdown) => addSalaryLine(salaryModalEmployee, breakdown)}
        />
      )}
      {advanceModalEmployee && (
        <AdvanceModal employee={advanceModalEmployee} competence={competence} onClose={() => setAdvanceModalEmployee(null)} onSave={(amount) => addAdvanceLine(advanceModalEmployee, amount)} />
      )}
    </div>
  );
}
