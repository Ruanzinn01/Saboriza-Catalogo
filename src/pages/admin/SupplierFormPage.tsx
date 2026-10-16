import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, MapPin, Plus, Save, Search, Store, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { FormPageHeader } from "@/components/admin/FormPageHeader";
import { AdminState } from "@/components/admin/AdminState";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { SupplierCategoryPicker } from "@/components/admin/fornecedores/SupplierCategoryPicker";
import { CheckField, SectionCard, Segmented, SelectField, TextAreaField, TextField } from "@/components/admin/fornecedores/form/FormUi";
import { SupplierBankSection } from "@/components/admin/fornecedores/form/SupplierBankSection";
import { type QueuedFile, SupplierFilesSection } from "@/components/admin/fornecedores/form/SupplierFilesSection";
import { fetchAddressByCep, formatCep } from "@/lib/cep";
import { BRAZILIAN_STATES, findMunicipality, type Municipality, searchMunicipalities } from "@/lib/supplier-municipios";
import {
  type BankInput,
  discardDraft,
  emptyBankInput,
  fetchSupplierContacts,
  getDraft,
  saveBankDetails,
  saveDraft,
  uploadSupplierFile,
} from "@/lib/supplier-api";
import {
  addressFingerprint,
  CONTACT_ROLES,
  COST_CENTERS,
  coordinateState,
  emptySupplierForm,
  FREIGHT_TERMS,
  mapsUrl,
  ORIGINS,
  PAYMENT_METHODS,
  PAYMENT_TERMS,
  registrationQuality,
  SUPPLY_TYPES,
  supplierToForm,
  TAX_PROFILES,
  validateSupplierForm,
  type SupplierFormErrors,
} from "@/lib/supplier-form";
import { diffIds } from "@/lib/supplier-search";
import { friendlyRpcError } from "@/lib/supplier-rpc";
import { useSuppliersStore } from "@/store/suppliers-store";
import { useSupplierCategoriesStore } from "@/store/supplier-categories-store";
import { useSupplierCandidatesStore } from "@/store/supplier-candidates-store";
import { useSupplierPermissionsStore } from "@/store/supplier-permissions-store";
import type { SupplierCandidate, SupplierInput } from "@/types/supplier";

const DRAFT_DELAY_MS = 1500;
type DraftStatus = "idle" | "saving" | "saved" | "conflict" | "error";

interface DraftPayload {
  form: SupplierInput;
  categoryIds: string[];
}

export function SupplierFormPage() {
  const { supplierId } = useParams();
  const isEditing = supplierId !== undefined;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const candidateId = isEditing ? null : searchParams.get("candidato");

  const suppliers = useSuppliersStore((state) => state.suppliers);
  const suppliersStatus = useSuppliersStore((state) => state.status);
  const fetchSuppliers = useSuppliersStore((state) => state.fetchSuppliers);
  const createSupplier = useSuppliersStore((state) => state.createSupplier);
  const updateSupplier = useSuppliersStore((state) => state.updateSupplier);
  const findByDocument = useSuppliersStore((state) => state.findByDocument);
  const fetchCandidate = useSupplierCandidatesStore((state) => state.fetchCandidate);
  const convertCandidate = useSupplierCandidatesStore((state) => state.convert);
  const categoriesStatus = useSupplierCategoriesStore((state) => state.status);
  const linksBySupplier = useSupplierCategoriesStore((state) => state.linksBySupplier);
  const fetchCategories = useSupplierCategoriesStore((state) => state.fetchAll);
  const permissions = useSupplierPermissionsStore((state) => state.permissions);
  const permissionsStatus = useSupplierPermissionsStore((state) => state.status);
  const loadPermissions = useSupplierPermissionsStore((state) => state.load);

  const existing = useMemo(() => suppliers.find((s) => s.id === supplierId), [suppliers, supplierId]);
  const [form, setFormState] = useState<SupplierInput>(emptySupplierForm);
  const [errors, setErrors] = useState<SupplierFormErrors>({});
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [initialCategoryIds, setInitialCategoryIds] = useState<string[]>([]);
  const [candidate, setCandidate] = useState<SupplierCandidate | null>(null);
  const [bank, setBank] = useState<BankInput>(emptyBankInput);
  const [bankEdited, setBankEdited] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [filesKey, setFilesKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [draftBanner, setDraftBanner] = useState<{ payload: DraftPayload; version: number; updatedAt: string } | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const draftVersion = useRef(0);
  const draftConflict = useRef(false);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const loadedForRef = useRef<string | null>(null);

  const draftTarget = useMemo(() => ({ supplierId: supplierId ?? null, candidateId }), [supplierId, candidateId]);

  // ---- carga inicial -------------------------------------------------------------------------------------------------
  useEffect(() => {
    if (permissionsStatus === "idle") void loadPermissions();
    if (categoriesStatus === "idle") void fetchCategories();
    if (suppliersStatus === "idle") void fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const key = `${supplierId ?? "novo"}|${candidateId ?? ""}`;
    if (loadedForRef.current === key) return;
    if (isEditing) {
      if (!existing || categoriesStatus !== "ready") return;
      loadedForRef.current = key;
      void fetchSupplierContacts(existing.id).then((contacts) => {
        setFormState(supplierToForm(existing, contacts));
        const current = linksBySupplier.get(existing.id) ?? [];
        setCategoryIds(current);
        setInitialCategoryIds(current);
        setLoaded(true);
      });
      return;
    }
    loadedForRef.current = key;
    if (!candidateId) {
      setLoaded(true);
      return;
    }
    void fetchCandidate(candidateId).then((found) => {
      if (!found || found.stage === "CADASTRADO") {
        toast.error("Avaliação não encontrada ou já cadastrada como fornecedor");
        setLoaded(true);
        return;
      }
      setCandidate(found);
      setCategoryIds(found.categoryIds);
      setFormState((prev) => ({
        ...prev,
        tradeName: found.tradeName,
        companyName: found.legalName,
        name: found.contactName,
        phone: found.phone,
        email: found.email,
        city: found.city,
        state: found.state,
        website: found.website,
        buyerName: found.ownerName,
        origin: found.origin || "Indicação",
        serviceNotes: found.notes,
      }));
      setLoaded(true);
    });
  }, [isEditing, existing, categoriesStatus, linksBySupplier, supplierId, candidateId, fetchCandidate]);

  // ---- rascunho persistente (por pessoa, no servidor; nunca inclui banco/Pix) ------------------------------------------
  useEffect(() => {
    if (!loaded || !permissions["fornecedores.manage"]) return;
    let cancelled = false;
    void getDraft(draftTarget).then(({ data }) => {
      if (cancelled || !data) return;
      draftVersion.current = data.version;
      setDraftBanner({ payload: data.payload as unknown as DraftPayload, version: data.version, updatedAt: data.updated_at });
    });
    return () => {
      cancelled = true;
    };
  }, [loaded, permissions, draftTarget]);

  const snapshot = useMemo<DraftPayload>(() => ({ form, categoryIds }), [form, categoryIds]);
  useEffect(() => {
    if (!dirty || !loaded || draftConflict.current || !permissions["fornecedores.manage"]) return;
    const timer = window.setTimeout(async () => {
      setDraftStatus("saving");
      const { data, error } = await saveDraft(draftTarget, draftVersion.current, snapshot as unknown as Record<string, unknown>);
      if (error || !data) {
        if (error?.startsWith("CONFLITO_REVISAO")) {
          draftConflict.current = true;
          setDraftStatus("conflict");
        } else setDraftStatus("error");
        return;
      }
      draftVersion.current = data.version;
      setDraftStatus("saved");
    }, DRAFT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [snapshot, dirty, loaded, draftTarget, permissions]);

  // proteção contra fechar a aba com dados não salvos
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function setForm(changes: Partial<SupplierInput>) {
    setFormState((prev) => {
      const next = { ...prev, ...changes };
      // Mudar endereço ou ponto invalida a confirmação anterior.
      if (!("locationConfirmed" in changes) && addressFingerprint(prev) !== addressFingerprint(next)) next.locationConfirmed = false;
      return next;
    });
    setDirty(true);
  }

  // ---- endereço: ViaCEP + municípios do IBGE (respostas atrasadas não sobrescrevem a edição atual) ----------------------
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [citiesState, setCitiesState] = useState<"idle" | "loading" | "error">("idle");
  const [cepState, setCepState] = useState<{ kind: "idle" | "loading" | "ok" | "notfound" | "error"; message?: string }>({ kind: "idle" });
  const [geoMessage, setGeoMessage] = useState("");
  const citiesSeq = useRef(0);
  const cepSeq = useRef(0);

  // Busca no catálogo oficial do projeto. Resposta atrasada (outra UF/texto já digitado) é descartada.
  const loadCities = useCallback(async (uf: string, text: string, applyCode: boolean) => {
    const seq = ++citiesSeq.current;
    if (!uf) {
      setMunicipalities([]);
      setCitiesState("idle");
      return;
    }
    setCitiesState("loading");
    try {
      const list = await searchMunicipalities(uf, text);
      if (seq !== citiesSeq.current) return;
      setMunicipalities(list);
      setCitiesState("idle");
      const match = findMunicipality(list, text);
      if (applyCode && match) setFormState((prev) => (prev.state === uf && prev.city.trim().toLowerCase() === text.trim().toLowerCase() ? { ...prev, city: match.name, ibgeCode: match.code } : prev));
    } catch {
      if (seq !== citiesSeq.current) return;
      setMunicipalities([]);
      setCitiesState("error");
    }
  }, []);

  useEffect(() => {
    void loadCities(form.state, "", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.state, loadCities]);

  const cityTimer = useRef<number | undefined>(undefined);

  function changeState(uf: string) {
    // Mudar UF limpa o município e o código IBGE antigos.
    setForm({ state: uf, city: "", ibgeCode: "" });
  }

  function changeCity(name: string) {
    // Digitar outra cidade invalida o código anterior até casar com o catálogo.
    setForm({ city: name, ibgeCode: "" });
    window.clearTimeout(cityTimer.current);
    cityTimer.current = window.setTimeout(() => void loadCities(form.state, name, true), 250);
  }

  async function lookupCep() {
    const digits = form.cep.replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepState({ kind: "error", message: "Digite os 8 números do CEP." });
      return;
    }
    const seq = ++cepSeq.current;
    const cepAtRequest = digits;
    setCepState({ kind: "loading" });
    try {
      const found = await fetchAddressByCep(digits);
      if (seq !== cepSeq.current || form.cep.replace(/\D/g, "") !== cepAtRequest) return;
      if (!found) {
        setCepState({ kind: "notfound", message: "CEP não encontrado. Os campos foram mantidos." });
        return;
      }
      // Preenche só o que o serviço devolveu; CEP geral pode não ter rua. Não inventa número nem coordenadas.
      const changes: Partial<SupplierInput> = {};
      if (found.street) changes.address = found.street;
      if (found.neighborhood) changes.neighborhood = found.neighborhood;
      if (found.stateCode) changes.state = found.stateCode;
      if (found.cityName) changes.city = found.cityName;
      if (/^\d{7}$/.test(found.ibgeCode)) changes.ibgeCode = found.ibgeCode;
      setForm(changes);
      setCepState({ kind: "ok", message: found.street ? "Endereço preenchido. Confira o número e o complemento." : "CEP geral: informe o logradouro manualmente." });
    } catch {
      if (seq !== cepSeq.current) return;
      setCepState({ kind: "error", message: "Serviço de CEP indisponível. Seus dados foram mantidos; tente de novo." });
    }
  }

  function useMyPosition() {
    if (!("geolocation" in navigator)) {
      setGeoMessage("Este aparelho não oferece localização.");
      return;
    }
    setGeoMessage("Obtendo a posição do aparelho...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
          locationSource: "GPS",
          locationAccuracyM: String(Math.round(position.coords.accuracy)),
          locationConfirmed: false,
        });
        setGeoMessage(`Posição obtida (precisão de cerca de ${Math.round(position.coords.accuracy)} m). Use somente se estiver no local do fornecedor e confirme o ponto.`);
      },
      () => setGeoMessage("Não foi possível obter a posição. Verifique a permissão do navegador."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  // ---- documento duplicado (pré-checagem; o servidor é a trava de verdade) ----------------------------------------------
  async function checkDocument() {
    if (!form.cnpj.trim() || !permissions["fornecedores.read"]) return;
    const found = await findByDocument(form.cnpj, existing?.id);
    if (found) setDuplicate({ id: found.id, name: found.trade_name || found.company_name });
  }

  // ---- contatos adicionais --------------------------------------------------------------------------------------------
  function updateContact(index: number, changes: Partial<SupplierInput["contacts"][number]>) {
    setForm({ contacts: form.contacts.map((c, i) => (i === index ? { ...c, ...changes } : c)) });
  }

  // ---- salvar ---------------------------------------------------------------------------------------------------------
  async function uploadQueue(id: string) {
    let failed = 0;
    for (const item of queue) {
      const result = await uploadSupplierFile({
        supplierId: id,
        kind: item.kind,
        file: item.file,
        caption: item.caption,
        photoKind: item.kind === "FOTO" ? item.photoKind : undefined,
        primary: item.primary,
      });
      if (!result.ok) {
        failed += 1;
        toast.error(`${item.file.name}: ${result.error}`);
      }
    }
    queue.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    setQueue([]);
    return failed;
  }

  async function persist(linkExisting: string | null = null) {
    setSaving(true);
    try {
      let savedId: string | null = null;
      if (candidate) {
        const result = await convertCandidate(candidate.id, linkExisting, form, categoryIds);
        if (!result) return;
        if ("duplicateOf" in result) {
          const other = suppliers.find((s) => s.id === result.duplicateOf);
          setDuplicate({ id: result.duplicateOf, name: other ? other.tradeName || other.companyName : "fornecedor existente" });
          return;
        }
        savedId = result.supplierId;
        toast.success("Fornecedor cadastrado a partir da avaliação");
      } else if (isEditing && existing) {
        const delta = diffIds(initialCategoryIds, categoryIds);
        const result = await updateSupplier(existing.id, existing.revision, form, delta);
        if (!result) return;
        if ("conflict" in result) {
          setConflict(true);
          return;
        }
        if ("duplicateOf" in result) {
          const other = suppliers.find((s) => s.id === result.duplicateOf);
          setDuplicate({ id: result.duplicateOf, name: other ? other.tradeName || other.companyName : "fornecedor existente" });
          return;
        }
        savedId = result.id;
      } else {
        // Um command_id por intenção; reaproveitado no retry do MESMO corpo (evita cadastro duplicado por clique repetido).
        const key = JSON.stringify({ form, categoryIds });
        if (!attempt.current || attempt.current.key !== key) attempt.current = { key, id: crypto.randomUUID() };
        const result = await createSupplier(form, categoryIds, attempt.current.id);
        if (!result) return;
        if ("duplicateOf" in result) {
          const other = suppliers.find((s) => s.id === result.duplicateOf);
          setDuplicate({ id: result.duplicateOf, name: other ? other.tradeName || other.companyName : "fornecedor existente" });
          return;
        }
        if ("conflict" in result) return;
        savedId = result.id;
      }
      if (!savedId) return;

      if (bankEdited && (permissions["fornecedores.banco.manage"])) {
        const { error } = await saveBankDetails(savedId, bank);
        if (error) toast.error(friendlyRpcError(error, "O fornecedor foi salvo, mas os dados bancários não foram gravados"));
      }
      const failedUploads = await uploadQueue(savedId);
      await discardDraft(draftTarget);
      setDirty(false);
      await fetchSuppliers();
      void fetchCategories();
      if (failedUploads > 0) {
        toast.warning("Cadastro salvo. Alguns arquivos não subiram; anexe de novo na edição.");
        setFilesKey((k) => k + 1);
        navigate(`/admin/fornecedores/${savedId}/editar`);
        return;
      }
      navigate(`/admin/fornecedores/${savedId}`);
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateSupplierForm(form, { isCreate: !isEditing, existing });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Falta conferir alguns dados");
      document.getElementById("form-errors")?.focus();
      return;
    }
    void persist();
  }

  function leave() {
    if (dirty) setConfirmLeave(true);
    else navigate(isEditing && supplierId ? `/admin/fornecedores/${supplierId}` : "/admin/fornecedores");
  }

  function applyDraft() {
    if (!draftBanner) return;
    setFormState({ ...emptySupplierForm, ...draftBanner.payload.form });
    setCategoryIds(draftBanner.payload.categoryIds ?? []);
    setDraftBanner(null);
    setDirty(true);
  }

  async function dropDraft() {
    await discardDraft(draftTarget);
    draftVersion.current = 0;
    setDraftBanner(null);
  }

  const quality = registrationQuality(form);
  const coords = coordinateState(form.latitude, form.longitude);
  const isPj = form.personType === "PJ";

  if (permissionsStatus === "ready" && !permissions["fornecedores.manage"]) {
    return <AdminState variant="empty" message="Seu perfil não inclui cadastrar ou editar fornecedores. Peça a permissão a quem administra a empresa." />;
  }
  if (isEditing && !existing && suppliersStatus === "ready") return <AdminState variant="empty" message="Fornecedor não encontrado." />;
  if (!loaded) return <AdminState variant="loading" message="Carregando cadastro..." />;

  const errorList = Object.values(errors);

  return (
    <div className="flex flex-col gap-6 pb-28">
      <FormPageHeader
        title={isEditing ? "Editar fornecedor" : "Novo fornecedor"}
        crumbs={[{ label: "Fornecedores", to: "/admin/fornecedores" }, { label: isEditing ? "Editar fornecedor" : "Novo fornecedor" }]}
      >
        <Button type="button" variant="outline" className="min-h-11" onClick={leave}>
          <ArrowLeft size={16} /> {isEditing ? "Voltar à ficha" : "Lista de fornecedores"}
        </Button>
      </FormPageHeader>

      {candidate && (
        <p className="rounded-2xl bg-forest-950/5 p-3 text-sm text-ink-700">
          Cadastrando a partir da avaliação de <strong className="text-ink-900">{candidate.tradeName}</strong>. A origem, a primeira data, os produtos, as cotações e o histórico ficam preservados;
          nenhuma compra, dívida ou limite é criado. Complete o documento e os campos formais.
        </p>
      )}

      {draftBanner && (
        <div role="status" className="flex flex-col gap-3 rounded-2xl border border-gold-500/40 bg-gold-400/15 p-4 text-sm text-forest-950 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Existe um rascunho seu salvo em <strong>{new Date(draftBanner.updatedAt).toLocaleString("pt-BR")}</strong>. Dados bancários nunca ficam em rascunho.
          </span>
          <span className="flex gap-2">
            <Button type="button" variant="secondary" className="min-h-11" onClick={applyDraft}>
              Continuar de onde parei
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => void dropDraft()}>
              Descartar rascunho
            </Button>
          </span>
        </div>
      )}

      <form id="supplier-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div id="form-errors" tabIndex={-1} role="alert" className={errorList.length ? "rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700" : "hidden"}>
          {errorList.length > 0 && (
            <>
              <b>Falta conferir alguns dados</b>
              <ul className="mt-1 list-disc pl-5">
                {errorList.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            <SectionCard id="identificacao" title="Identificação do fornecedor" hint="O comércio, o documento e a forma como será encontrado.">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Segmented
                  label="Tipo de pessoa"
                  value={form.personType}
                  onChange={(value) => setForm({ personType: value })}
                  options={[{ value: "PJ", label: "Pessoa jurídica" }, { value: "PF", label: "Pessoa física" }]}
                />
                <SelectField
                  label="Situação do cadastro"
                  value={form.active ? "active" : "inactive"}
                  onChange={(e) => setForm({ active: e.target.value === "active" })}
                  options={[{ value: "active", label: "Ativo" }, { value: "inactive", label: "Inativo" }]}
                  help={form.active ? undefined : "Inativo não aparece na escolha de fornecedor em Compras e Despesas; histórico e vínculos são preservados."}
                />
                <TextField
                  className="md:col-span-2"
                  label={isPj ? "Nome fantasia / nome do fornecedor" : "Nome de exibição"}
                  required
                  maxLength={120}
                  value={form.tradeName}
                  error={errors.tradeName}
                  onChange={(e) => setForm({ tradeName: e.target.value })}
                  help="Este é o nome em destaque na carteira e na ficha do fornecedor."
                />
                <TextField label={isPj ? "Razão social" : "Nome completo"} required maxLength={160} value={form.companyName} error={errors.companyName} onChange={(e) => setForm({ companyName: e.target.value })} />
                <TextField
                  label={isPj ? "CNPJ" : "CPF"}
                  required
                  maxLength={18}
                  autoComplete="off"
                  spellCheck={false}
                  value={form.cnpj}
                  error={errors.cnpj}
                  placeholder={isPj ? "00.000.000/0000-00" : "000.000.000-00"}
                  onChange={(e) => setForm({ cnpj: e.target.value })}
                  onBlur={() => void checkDocument()}
                  help={isPj ? "Aceita o formato numérico e o novo CNPJ com letras. Só o formato é conferido, não a situação fiscal." : undefined}
                />
                {isPj && (
                  <div className="flex flex-col gap-2">
                    <TextField label="Inscrição estadual" maxLength={30} value={form.stateExempt ? "" : form.ie} disabled={form.stateExempt} onChange={(e) => setForm({ ie: e.target.value })} />
                    <CheckField label="Isento de inscrição estadual" checked={form.stateExempt} onChange={(value) => setForm({ stateExempt: value, ie: value ? "" : form.ie })} />
                  </div>
                )}
                {isPj && (
                  <SelectField
                    label="Enquadramento informado"
                    value={form.taxProfile}
                    onChange={(e) => setForm({ taxProfile: e.target.value })}
                    options={[{ value: "", label: "Não informado" }, ...TAX_PROFILES.map((v) => ({ value: v, label: v }))]}
                    help="Informação cadastral; não substitui a configuração fiscal."
                  />
                )}
              </div>
            </SectionCard>

            <SectionCard id="contatos" title="Contatos do fornecedor" hint="Com quem falar para comprar, receber e conferir. Nenhum contato é obrigatório." step="02">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField label="Nome do contato principal" maxLength={100} autoComplete="name" value={form.name} onChange={(e) => setForm({ name: e.target.value })} />
                <SelectField
                  label="Função no fornecedor"
                  value={form.contactRole}
                  onChange={(e) => setForm({ contactRole: e.target.value })}
                  options={[{ value: "", label: "Selecione" }, ...CONTACT_ROLES.map((v) => ({ value: v, label: v }))]}
                />
                <TextField label="Telefone / WhatsApp" type="tel" inputMode="tel" maxLength={24} autoComplete="tel" value={form.phone} onChange={(e) => setForm({ phone: e.target.value })} />
                <TextField label="E-mail" type="email" maxLength={160} autoComplete="email" value={form.email} error={errors.email} onChange={(e) => setForm({ email: e.target.value })} />
                <div className="md:col-span-2">
                  <CheckField label="O telefone informado também recebe WhatsApp" checked={form.contactWhatsapp} onChange={(value) => setForm({ contactWhatsapp: value })} />
                </div>
              </div>
              {form.contacts.map((contact, index) => (
                <div key={index} className="grid grid-cols-1 gap-4 rounded-2xl border border-forest-950/10 p-4 md:grid-cols-2">
                  <TextField label="Nome" value={contact.name} onChange={(e) => updateContact(index, { name: e.target.value })} />
                  <SelectField label="Função" value={contact.role} onChange={(e) => updateContact(index, { role: e.target.value })} options={[{ value: "", label: "Selecione" }, ...CONTACT_ROLES.map((v) => ({ value: v, label: v }))]} />
                  <TextField label="Telefone" type="tel" value={contact.phone} onChange={(e) => updateContact(index, { phone: e.target.value })} />
                  <TextField label="E-mail" type="email" value={contact.email} onChange={(e) => updateContact(index, { email: e.target.value })} />
                  <CheckField label="Recebe WhatsApp" checked={contact.whatsapp} onChange={(value) => updateContact(index, { whatsapp: value })} />
                  <button type="button" onClick={() => setForm({ contacts: form.contacts.filter((_, i) => i !== index) })} className="flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-red-700 hover:underline">
                    <Trash2 size={14} /> Remover contato
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" className="min-h-11 w-fit" disabled={form.contacts.length >= 20} onClick={() => setForm({ contacts: [...form.contacts, { name: "", role: "", phone: "", whatsapp: false, email: "" }] })}>
                <Plus size={14} /> Adicionar outro contato
              </Button>
            </SectionCard>

            <SectionCard id="endereco" title="Endereço e localização" hint="Endereço para o cadastro. Ponto exato para chegar ao fornecedor." step="03">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                <div className="flex flex-col gap-1.5 md:col-span-3">
                  <TextField
                    label="CEP"
                    inputMode="numeric"
                    maxLength={9}
                    autoComplete="postal-code"
                    value={form.cep}
                    error={errors.cep}
                    placeholder="00000-000"
                    onChange={(e) => setForm({ cep: formatCep(e.target.value) })}
                    help="Digite os 8 números e use Buscar para preencher pelo ViaCEP."
                  />
                  <Button type="button" variant="outline" className="min-h-11 w-fit" disabled={cepState.kind === "loading"} onClick={() => void lookupCep()}>
                    <Search size={14} /> {cepState.kind === "loading" ? "Buscando..." : "Buscar CEP"}
                  </Button>
                  {cepState.message && (
                    <span role="status" className={cepState.kind === "ok" ? "text-xs text-forest-800" : "text-xs text-red-700"}>
                      {cepState.message}
                    </span>
                  )}
                </div>
                <SelectField
                  className="md:col-span-3"
                  label="Estado / UF"
                  required
                  value={form.state}
                  error={errors.state}
                  onChange={(e) => changeState(e.target.value)}
                  options={[{ value: "", label: "Selecione o estado" }, ...BRAZILIAN_STATES.map((uf) => ({ value: uf, label: uf }))]}
                />
                <div className="flex flex-col gap-1.5 md:col-span-4">
                  <TextField
                    label="Município"
                    required
                    list="supplier-municipality-list"
                    autoComplete="off"
                    disabled={!form.state}
                    placeholder="Escolha a UF e digite a cidade"
                    value={form.city}
                    error={errors.city}
                    onChange={(e) => changeCity(e.target.value)}
                  />
                  <datalist id="supplier-municipality-list">
                    {municipalities.map((m) => (
                      <option key={m.code} value={m.name} />
                    ))}
                  </datalist>
                  {citiesState === "error" && (
                    <span className="text-xs text-red-700">
                      Lista de municípios indisponível. Seus dados foram mantidos.{" "}
                      <button type="button" className="min-h-11 font-semibold underline" onClick={() => void loadCities(form.state, form.city, true)}>
                        Tentar de novo
                      </button>
                    </span>
                  )}
                </div>
                <TextField className="md:col-span-2" label="Código do município · IBGE" readOnly value={form.ibgeCode} placeholder="Automático" help="7 dígitos · diferente do CEP." error={errors.ibgeCode} />
                <TextField className="md:col-span-4" label="Logradouro" required maxLength={150} autoComplete="address-line1" value={form.address} error={errors.address} onChange={(e) => setForm({ address: e.target.value })} />
                <TextField className="md:col-span-2" label="Número" required maxLength={20} placeholder="Ex.: 128 ou S/N" value={form.streetNumber} error={errors.streetNumber} onChange={(e) => setForm({ streetNumber: e.target.value })} />
                <TextField className="md:col-span-3" label="Bairro" maxLength={100} value={form.neighborhood} onChange={(e) => setForm({ neighborhood: e.target.value })} />
                <TextField className="md:col-span-3" label="Complemento" maxLength={100} autoComplete="address-line2" value={form.complement} onChange={(e) => setForm({ complement: e.target.value })} />
                <TextAreaField className="md:col-span-6" label="Ponto de referência / orientação para entrega" maxLength={600} value={form.referenceNote} onChange={(e) => setForm({ referenceNote: e.target.value })} />
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-forest-950/10 bg-forest-950/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold text-forest-950">
                    <Target size={16} aria-hidden /> Localização do fornecedor
                  </h3>
                  <span className={coords.valid && form.locationConfirmed ? "rounded-full bg-forest-700/15 px-3 py-1 text-xs font-semibold text-forest-800" : "rounded-full bg-gold-400/30 px-3 py-1 text-xs font-semibold text-forest-950"}>
                    {coords.valid && form.locationConfirmed ? "Ponto conferido" : coords.valid ? "Aguardando confirmação" : "Ponto não informado"}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <TextField label="Latitude" inputMode="decimal" maxLength={24} placeholder="Ex.: -12,971400" value={form.latitude} error={errors.latitude} onChange={(e) => setForm({ latitude: e.target.value, locationSource: "MANUAL", locationAccuracyM: "" })} />
                  <TextField label="Longitude" inputMode="decimal" maxLength={24} placeholder="Ex.: -38,501400" value={form.longitude} onChange={(e) => setForm({ longitude: e.target.value, locationSource: "MANUAL", locationAccuracyM: "" })} />
                </div>
                <p className="text-xs text-ink-muted">O CEP não fornece estas coordenadas. Confira o ponto do fornecedor no mapa. Use a posição do aparelho somente se estiver no local.</p>
                <div className="flex flex-wrap gap-2">
                  <a href={mapsUrl(form)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-forest-900/30 px-4 text-sm font-semibold text-forest-900 hover:bg-forest-900/5">
                    <MapPin size={14} /> Abrir no mapa
                  </a>
                  <Button type="button" variant="outline" className="min-h-11" onClick={useMyPosition}>
                    <Target size={14} /> Usar minha posição
                  </Button>
                </div>
                {geoMessage && (
                  <p role="status" className="text-xs text-ink-700">
                    {geoMessage}
                  </p>
                )}
                <CheckField label="Conferi que este ponto corresponde ao fornecedor" checked={form.locationConfirmed} disabled={!coords.valid} onChange={(value) => setForm({ locationConfirmed: value })} />
                {errors.location && <span role="alert" className="text-xs text-red-600">{errors.location}</span>}
              </div>
            </SectionCard>

            <SupplierFilesSection supplierId={existing?.id ?? null} queue={queue} onQueueChange={setQueue} onDirty={() => setDirty(true)} reloadKey={filesKey} />

            <SectionCard id="fornecimento" title="Fornecimento e relacionamento" hint="O que fornece, quem compra e como combinar o atendimento." step="05">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField label="Comprador responsável" value={form.buyerName} maxLength={100} placeholder="Nome de quem compra deste fornecedor" onChange={(e) => setForm({ buyerName: e.target.value })} />
                <SelectField label="Centro de custo preferencial" value={form.costCenter} onChange={(e) => setForm({ costCenter: e.target.value })} options={[{ value: "", label: "Não definido" }, ...COST_CENTERS.map((v) => ({ value: v, label: v }))]} />
                <SelectField label="Tipo principal de fornecimento" value={form.supplyType} onChange={(e) => setForm({ supplyType: e.target.value })} options={[{ value: "", label: "Selecione" }, ...SUPPLY_TYPES.map((v) => ({ value: v, label: v }))]} />
                <SelectField label="Origem do relacionamento" value={form.origin} onChange={(e) => setForm({ origin: e.target.value })} options={ORIGINS.map((v) => ({ value: v, label: v }))} />
                <TextAreaField className="md:col-span-2" label="Observações de fornecimento" maxLength={1000} value={form.serviceNotes} onChange={(e) => setForm({ serviceNotes: e.target.value })} />
              </div>
              <p className="rounded-xl bg-forest-950/5 p-3 text-xs text-ink-700">O tipo de fornecimento é uma referência cadastral. Cada compra mantém sua própria categoria e classificação; preferências não sobrescrevem fatos passados.</p>
            </SectionCard>

            <SectionCard id="condicoes" title="Condições de compra e pagamento" hint="Informações para conferência. Salvar não aprova nem agenda pagamento." step="06">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField label="Limite informado pelo fornecedor · R$" inputMode="decimal" maxLength={20} value={form.creditLimit} error={errors.creditLimit} onChange={(e) => setForm({ creditLimit: e.target.value })} help="Referência contratual informada; não é crédito concedido nem adiantamento." />
                <SelectField label="Prazo preferencial de pagamento" value={form.paymentTerms} onChange={(e) => setForm({ paymentTerms: e.target.value })} options={PAYMENT_TERMS} />
                <SelectField label="Forma de pagamento preferencial" value={form.paymentMethod} onChange={(e) => setForm({ paymentMethod: e.target.value })} options={[{ value: "", label: "Não definida" }, ...PAYMENT_METHODS.map((v) => ({ value: v, label: v }))]} />
                <TextAreaField className="md:col-span-2" label="Observações da negociação" maxLength={600} value={form.negotiationNotes} onChange={(e) => setForm({ negotiationNotes: e.target.value })} />
              </div>
            </SectionCard>

            <SectionCard id="categorias" title="Categorias do fornecedor" hint="Escolha uma ou mais necessidades atendidas. Opcional.">
              <SupplierCategoryPicker
                value={categoryIds}
                onChange={(ids) => {
                  setCategoryIds(ids);
                  setDirty(true);
                }}
              />
              <p className="text-xs text-ink-muted">Categoria cadastral organiza a busca. A classificação de cada compra ou despesa é conferida no lançamento.</p>
            </SectionCard>

            <SectionCard id="operacao" title="Operação de compras" hint="Negociação, documentos e recebimento." step="07">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField label="E-mail de pedidos" type="email" value={form.salesEmail} error={errors.salesEmail} onChange={(e) => setForm({ salesEmail: e.target.value })} />
                <TextField label="E-mail de notas e XML" type="email" value={form.invoiceEmail} error={errors.invoiceEmail} onChange={(e) => setForm({ invoiceEmail: e.target.value })} />
                <TextField label="Site do fornecedor" placeholder="https://..." value={form.website} error={errors.website} onChange={(e) => setForm({ website: e.target.value })} />
                <TextField label="Nosso código no fornecedor" maxLength={40} value={form.externalCustomerCode} onChange={(e) => setForm({ externalCustomerCode: e.target.value })} help="Código que o fornecedor usa para a nossa empresa." />
                <TextField label="Prazo usual de entrega · dias" inputMode="numeric" maxLength={3} value={form.leadTimeDays} error={errors.leadTimeDays} placeholder="Ex.: 7" onChange={(e) => setForm({ leadTimeDays: e.target.value.replace(/\D/g, "") })} />
                <TextField label="Pedido mínimo · R$" inputMode="decimal" value={form.minimumOrder} error={errors.minimumOrder} onChange={(e) => setForm({ minimumOrder: e.target.value })} />
                <SelectField label="Condição usual do frete" value={form.freightTerms} onChange={(e) => setForm({ freightTerms: e.target.value })} options={FREIGHT_TERMS.map((v) => ({ value: v, label: v }))} />
                <TextAreaField className="md:col-span-2" label="Orientações de entrega / retirada" value={form.receivingNotes} onChange={(e) => setForm({ receivingNotes: e.target.value })} />
              </div>
            </SectionCard>

            <SupplierBankSection
              supplierId={existing?.id ?? null}
              value={bank}
              onChange={setBank}
              onDirty={() => {
                setBankEdited(true);
                setDirty(true);
              }}
            />
          </div>

          <aside className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <section className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">Prévia do cadastro</p>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-900 text-cream-50">
                  <Store size={20} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="break-words text-lg font-extrabold text-forest-950">{form.tradeName || "Seu próximo fornecedor"}</p>
                  <p className="break-words text-xs text-ink-muted">{form.companyName || "Preencha o nome do fornecedor para começar."}</p>
                </div>
              </div>
              <span className={form.active ? "w-fit rounded-full bg-forest-700/15 px-3 py-1 text-xs font-semibold text-forest-800" : "w-fit rounded-full bg-gold-400/30 px-3 py-1 text-xs font-semibold text-forest-950"}>
                {form.active ? "Cadastro ativo" : "Cadastro inativo"}
              </span>
              <p className="text-xs text-ink-700">{[form.city, form.state].filter(Boolean).join(" / ") || "Cidade não informada"} · localização</p>
              <p className="text-xs text-ink-700">{form.name || "Contato não informado"} · contato principal</p>
              <p className="text-xs text-ink-700">{form.phone || "Telefone não informado"} · atendimento</p>
              <p className="text-xs text-ink-700">{queue.filter((q) => q.kind === "FOTO").length} foto(s) na fila · estabelecimento</p>
            </section>
            <section className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-5">
              <div className="flex items-center justify-between">
                <strong className="text-sm text-forest-950">Qualidade do cadastro</strong>
                <span className="text-sm font-extrabold text-forest-950">{quality.percent}%</span>
              </div>
              <div className="h-2 rounded-full bg-forest-950/10" role="progressbar" aria-valuenow={quality.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Qualidade do cadastro">
                <div className="h-full rounded-full bg-forest-700" style={{ width: `${quality.percent}%` }} />
              </div>
              <ul className="flex flex-col gap-1 text-xs">
                {quality.items.map((item) => (
                  <li key={item.label} className={item.done ? "text-forest-800" : "text-ink-muted"}>
                    {item.done ? "✓" : "○"} {item.label}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-muted">Indicador de preenchimento. Não representa aprovação fiscal ou de crédito.</p>
            </section>
            <section className="flex flex-col gap-2 rounded-3xl border border-forest-950/10 bg-white p-5">
              <h3 className="text-sm font-extrabold text-forest-950">Um registro, várias conexões</h3>
              <p className="text-xs text-ink-muted">O mesmo fornecedor é usado em Compras e Despesas. Notas, parcelas e pagamentos permanecem nos lançamentos de origem.</p>
              <p className="text-xs text-ink-muted" role="status">
                {draftStatus === "saving" && "Salvando rascunho..."}
                {draftStatus === "saved" && "Rascunho salvo no servidor."}
                {draftStatus === "conflict" && "O rascunho foi alterado em outra aba; esta aba parou de salvar o rascunho."}
                {draftStatus === "error" && "Não foi possível salvar o rascunho agora."}
                {draftStatus === "idle" && "Seu rascunho é salvo automaticamente enquanto você digita."}
              </p>
            </section>
          </aside>
        </div>
      </form>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-forest-950/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <p className="min-w-0 flex-1 text-xs text-ink-700">
            <strong>{dirty ? "Alterações não salvas" : "Nenhuma alteração pendente"}</strong>
            <br />
            Revise os dados antes de concluir.
          </p>
          <Button type="button" variant="outline" className="min-h-11" onClick={leave}>
            Cancelar
          </Button>
          <Button type="submit" form="supplier-form" variant="secondary" className="min-h-11" disabled={saving}>
            <Save size={16} /> {saving ? "Salvando..." : "Salvar cadastro"}
          </Button>
        </div>
      </footer>

      <ConfirmDialog
        open={duplicate !== null}
        onClose={() => setDuplicate(null)}
        title="Este documento já está cadastrado"
        description={
          <>
            Já existe um fornecedor com esse documento: <strong className="text-ink-900">{duplicate?.name}</strong>.{" "}
            {candidate ? "Deseja vincular a avaliação a ele, sem criar um segundo cadastro?" : "Abra o cadastro existente em vez de criar outro."}
          </>
        }
        confirmLabel={candidate ? "Vincular ao existente" : "Abrir cadastro existente"}
        onConfirm={() => {
          const target = duplicate;
          setDuplicate(null);
          if (!target) return;
          if (candidate) void persist(target.id);
          else navigate(`/admin/fornecedores/${target.id}`);
        }}
      />

      <ConfirmDialog
        open={conflict}
        onClose={() => setConflict(false)}
        title="Outra pessoa alterou este cadastro"
        description="Para não sobrescrever o trabalho dela em silêncio, o salvamento foi bloqueado. Recarregue o cadastro e refaça a sua alteração; seu rascunho continua salvo."
        confirmLabel="Recarregar cadastro"
        onConfirm={() => {
          setConflict(false);
          window.location.reload();
        }}
      />

      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Descartar alterações não salvas?"
        description="A última versão salva do cadastro será preservada. O rascunho automático fica disponível para você continuar depois."
        confirmLabel="Sair sem salvar"
        cancelLabel="Continuar editando"
        onConfirm={() => {
          setConfirmLeave(false);
          setDirty(false);
          navigate(isEditing && supplierId ? `/admin/fornecedores/${supplierId}` : "/admin/fornecedores");
        }}
      />
    </div>
  );
}

