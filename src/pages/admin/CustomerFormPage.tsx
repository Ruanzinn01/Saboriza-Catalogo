import { type ChangeEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { BriefcaseBusiness, Camera, IdCard, MapPinned, Phone, Plus, Save, UsersRound, WalletCards, X } from "lucide-react";
import { AdminState } from "@/components/admin/AdminState";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { CustomerPhotosField, type FormPhoto } from "@/components/admin/CustomerPhotosField";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatCep, fetchAddressByCep } from "@/lib/cep";
import { resolveCurrentCompanyId } from "@/lib/current-company";
import {
  buildMapUrl,
  buildSavePayload,
  coordinateState,
  CONTACT_ROLES,
  CREDIT_STATE_LABEL,
  emptyCustomerForm,
  errorSummary,
  formFromProfile,
  isFormDirty,
  normalizeDocument,
  ORIGINS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_TERM_OPTIONS,
  qualityChecklist,
  SEGMENTS,
  TAX_PROFILES,
  validateCustomerForm,
  type CustomerFormState,
  type FormErrors,
} from "@/lib/customer-form";
import {
  fetchCustomerCapabilities,
  fetchCustomerProfile,
  fetchEmployeeOptions,
  saveCustomer,
  setPrimaryCustomerPhoto,
  signedPhotoUrls,
  updateCustomerMedia,
  uploadCustomerPhoto,
  removeCustomerPhoto,
  validateImageFile,
  type CustomerCapabilities,
  type CustomerFullProfile,
  type PersonRef,
} from "@/lib/customers-api";
import { findIbgeCityByCode, listIbgeCitiesByState, listIbgeStates, type IbgeCity, type IbgeState } from "@/lib/ibge";

const inputClass = "h-11 w-full rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none transition-colors focus:border-forest-700 disabled:bg-forest-950/5 disabled:text-ink-muted";

function norm(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function Section({ icon, title, subtitle, step, children, id }: { icon: ReactNode; title: string; subtitle: string; step: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-3xl border border-forest-950/10 bg-white">
      <div className="flex items-start gap-3 border-b border-forest-950/10 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-700/10 text-forest-700">{icon}</span>
        <div className="flex-1">
          <h2 className="text-base font-extrabold text-forest-950">{title}</h2>
          <p className="text-xs text-ink-muted">{subtitle}</p>
        </div>
        <span className="font-mono text-xs text-ink-muted">{step}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, error, help, full, children, htmlFor }: { label: string; error?: string; help?: string; full?: boolean; children: ReactNode; htmlFor?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", full && "md:col-span-2")}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink-900">{label}</label>
      {children}
      {help && !error && <span className="text-xs text-ink-muted">{help}</span>}
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

function Check({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm text-ink-900">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-forest-700" />
      {children}
    </label>
  );
}

export function CustomerFormPage() {
  const { customerId } = useParams();
  const isEditing = customerId !== undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const listSearch = (location.state as { listSearch?: string } | null)?.listSearch ?? "";
  const backTo = isEditing ? `/admin/clientes/${customerId}` : `/admin/clientes${listSearch}`;

  const [loadState, setLoadState] = useState<"loading" | "ready" | "error" | "missing">(isEditing ? "loading" : "ready");
  const [loadError, setLoadError] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerFullProfile | null>(null);
  const [caps, setCaps] = useState<CustomerCapabilities | null>(null);
  const [people, setPeople] = useState<PersonRef[]>([]);
  const [form, setForm] = useState<CustomerFormState>(emptyCustomerForm);
  const [initial, setInitial] = useState<CustomerFormState>(emptyCustomerForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [photos, setPhotos] = useState<FormPhoto[]>([]);
  const [removedPhotos, setRemovedPhotos] = useState<{ id: string; storage_path: string }[]>([]);
  const [photoMessages, setPhotoMessages] = useState<string[]>([]);
  const [states, setStates] = useState<IbgeState[]>([]);
  const [cities, setCities] = useState<IbgeCity[]>([]);
  const [citiesError, setCitiesError] = useState(false);
  const [addressNote, setAddressNote] = useState<{ text: string; error: boolean } | null>(null);
  const [geoNote, setGeoNote] = useState<{ text: string; error: boolean } | null>(null);
  const [pendingCep, setPendingCep] = useState<Awaited<ReturnType<typeof fetchAddressByCep>> | null>(null);
  const [confirmGeo, setConfirmGeo] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const errorsRef = useRef<HTMLDivElement>(null);
  const cepSeq = useRef(0);
  const citySeq = useRef(0);
  const geoSeq = useRef(0);
  const intent = useRef<{ id: string; fingerprint: string } | null>(null);
  const photoPaths = useRef(new Map<string, string>());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const company = isEditing ? null : await resolveCurrentCompanyId();
      let resolvedCompany = company;
      if (isEditing) {
        const result = await fetchCustomerProfile(customerId);
        if (cancelled) return;
        if (result.state === "error") { setLoadState("error"); setLoadError(result.message); return; }
        if (result.state !== "ready" || !result.data) { setLoadState("missing"); return; }
        resolvedCompany = result.data.customer.company_id;
        setProfile(result.data);
        const initialForm = formFromProfile(result.data.customer, result.data.contacts);
        setForm(initialForm);
        setInitial(initialForm);
        const urls = await signedPhotoUrls(result.data.media.map((m) => m.storage_path));
        if (cancelled) return;
        setPhotos(result.data.media.map((m) => ({
          key: m.id, existingId: m.id, storagePath: m.storage_path, previewUrl: urls[m.storage_path] ?? "", category: m.category, caption: m.caption, primary: m.primary_front,
        })));
      }
      if (!resolvedCompany) { setLoadState("error"); setLoadError("Não foi possível identificar a empresa."); return; }
      setCompanyId(resolvedCompany);
      const [capabilities, employees, ufs] = await Promise.all([fetchCustomerCapabilities(resolvedCompany), fetchEmployeeOptions(resolvedCompany), listIbgeStates()]);
      if (cancelled) return;
      setCaps(capabilities);
      setPeople(employees);
      setStates(ufs);
      setLoadState("ready");
    })();
    return () => { cancelled = true; };
  }, [customerId, isEditing]);

  const loadCities = useCallback(async (uf: string, search = "") => {
    if (!uf) { setCities([]); return; }
    const ticket = ++citySeq.current;
    try {
      const list = await listIbgeCitiesByState(uf, search);
      if (ticket !== citySeq.current) return;
      setCities(list);
      setCitiesError(list.length === 0 && search === "");
    } catch {
      if (ticket === citySeq.current) setCitiesError(true);
    }
  }, []);

  useEffect(() => {
    if (form.uf) void loadCities(form.uf, form.city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.uf]);

  useEffect(() => {
    if (!isEditing || form.ibge || !form.uf || !form.city.trim() || cities.length === 0) return;
    const exact = cities.filter((c) => c.stateCode === form.uf && norm(c.name) === norm(form.city));
    if (exact.length !== 1) return;
    setForm((prev) => (prev.ibge ? prev : { ...prev, city: exact[0].name, ibge: exact[0].code }));
    setInitial((prev) => (prev.ibge ? prev : { ...prev, city: exact[0].name, ibge: exact[0].code }));
  }, [isEditing, form.ibge, form.uf, form.city, cities]);

  const pendingPhotos = photos.filter((p) => p.file).length;
  const photoChanged = useMemo(
    () => removedPhotos.length > 0 || photos.some((p) => {
      if (!p.existingId) return false;
      const original = profile?.media.find((m) => m.id === p.existingId);
      return original ? original.category !== p.category || original.caption !== p.caption || original.primary_front !== p.primary : false;
    }),
    [photos, removedPhotos, profile]
  );
  const dirty = isFormDirty(form, initial, pendingPhotos) || photoChanged;

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const canEditCredit = caps?.can_propose_credit ?? false;
  const municipalityResolved = Boolean(form.ibge);
  const hasPrimaryFront = photos.some((p) => p.primary && p.category === "FACHADA");
  const quality = qualityChecklist(form, hasPrimaryFront, municipalityResolved);
  const coords = coordinateState(form);

  function set<K extends keyof CustomerFormState>(key: K, value: CustomerFormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      const invalidatesPoint: (keyof CustomerFormState)[] = ["latitude", "longitude", "street", "number", "uf", "city", "cep"];
      if (invalidatesPoint.includes(key)) { next.locationConfirmed = false; geoSeq.current += 1; }
      if (key === "latitude" || key === "longitude") { next.locationSource = "MANUAL"; next.locationAccuracy = ""; next.locationCapturedAt = ""; }
      return next;
    });
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    if (key === "latitude" || key === "longitude") setGeoNote(null);
  }

  function handleUf(uf: string) {
    setForm((prev) => ({ ...prev, uf, city: "", ibge: "", locationConfirmed: false }));
    setCities([]);
    setErrors((prev) => ({ ...prev, uf: undefined, city: undefined }));
  }

  async function handleCityInput(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    const match = cities.find((c) => norm(c.name) === norm(value));
    setForm((prev) => ({ ...prev, city: value, ibge: match ? match.code : "", locationConfirmed: false }));
    setErrors((prev) => ({ ...prev, city: undefined }));
    if (!match && value.trim().length >= 2) void loadCities(form.uf, value.trim());
  }

  async function lookupCep() {
    const digits = form.cep.replace(/\D/g, "");
    if (digits.length !== 8) { setAddressNote({ text: "Digite os 8 números do CEP.", error: true }); return; }
    const ticket = ++cepSeq.current;
    setAddressNote({ text: "Consultando o CEP...", error: false });
    let result: Awaited<ReturnType<typeof fetchAddressByCep>> = null;
    try { result = await fetchAddressByCep(digits); } catch { result = null; }
    if (ticket !== cepSeq.current) return;
    if (!result) {
      setAddressNote({ text: "CEP não encontrado ou serviço indisponível. Seus dados foram preservados; tente de novo.", error: true });
      return;
    }
    if (form.street.trim() || form.neighborhood.trim()) { setPendingCep(result); setAddressNote(null); return; }
    await applyCep(result, ticket);
  }

  async function applyCep(result: NonNullable<Awaited<ReturnType<typeof fetchAddressByCep>>>, ticket = cepSeq.current) {
    const known = result.ibgeCode ? await findIbgeCityByCode(result.ibgeCode) : null;
    if (ticket !== cepSeq.current) return;
    setForm((prev) => ({
      ...prev,
      street: result.street || prev.street,
      neighborhood: result.neighborhood || prev.neighborhood,
      uf: result.stateCode || prev.uf,
      city: known?.name ?? result.cityName,
      ibge: known && known.stateCode === result.stateCode ? known.code : "",
      locationConfirmed: false,
    }));
    setPendingCep(null);
    setAddressNote({
      text: result.street ? "Endereço preenchido. Confira número e complemento; o CEP não informa latitude nem longitude." : "CEP geral: não traz logradouro. Informe a rua e o número manualmente.",
      error: false,
    });
  }

  function openMap() {
    const { url, message } = buildMapUrl(form);
    if (!url) { toast.error(message ?? "Não foi possível abrir o mapa."); return; }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function useMyPosition() {
    setConfirmGeo(false);
    if (!navigator.geolocation) { setGeoNote({ text: "Este navegador não oferece localização.", error: true }); return; }
    const ticket = ++geoSeq.current;
    setGeoNote({ text: "Solicitando a posição do aparelho...", error: false });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (ticket !== geoSeq.current) return;
        setForm((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
          locationSource: "GPS_DISPOSITIVO",
          locationAccuracy: String(Math.round(position.coords.accuracy)),
          locationCapturedAt: new Date().toISOString(),
          locationConfirmed: false,
        }));
        setGeoNote({ text: `Posição obtida, com precisão estimada de ${Math.round(position.coords.accuracy)} m. Confira o ponto no mapa antes de confirmar.`, error: false });
      },
      (error) => {
        if (ticket !== geoSeq.current) return;
        setGeoNote({ text: error.code === 1 ? "Permissão de localização negada. Digite as coordenadas manualmente." : "Não foi possível obter a posição. Tente de novo ou digite as coordenadas.", error: true });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function addFiles(files: File[]) {
    const rejected: string[] = [];
    const accepted: FormPhoto[] = [];
    for (const file of files) {
      const invalid = validateImageFile(file);
      if (invalid) { rejected.push(invalid); continue; }
      accepted.push({ key: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), category: "FACHADA", caption: file.name.replace(/\.[^.]+$/, ""), primary: false });
    }
    setPhotoMessages(rejected);
    setPhotos((prev) => {
      const next = [...prev, ...accepted];
      if (!next.some((p) => p.primary)) {
        const firstFront = next.find((p) => p.category === "FACHADA");
        if (firstFront) firstFront.primary = true;
      }
      return next;
    });
  }

  function changePhoto(key: string, patch: Partial<Pick<FormPhoto, "category" | "caption">>) {
    setPhotos((prev) => prev.map((p) => {
      if (p.key !== key) return p;
      const next = { ...p, ...patch };
      if (next.category !== "FACHADA") next.primary = false;
      return next;
    }));
  }

  function removePhoto(key: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target?.file) URL.revokeObjectURL(target.previewUrl);
      if (target?.existingId && target.storagePath) setRemovedPhotos((old) => [...old, { id: target.existingId as string, storage_path: target.storagePath as string }]);
      return prev.filter((p) => p.key !== key);
    });
  }

  async function submit() {
    if (!companyId || saving) return;
    const nextErrors = validateCustomerForm(form, { isNew: !isEditing, canEditCredit, municipalityResolved });
    setErrors(nextErrors);
    setSaveMessage("");
    if (errorSummary(nextErrors).length > 0) {
      window.requestAnimationFrame(() => { errorsRef.current?.focus(); errorsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); });
      return;
    }
    const data = buildSavePayload(form, { canEditCredit });
    const fingerprint = JSON.stringify({ data, revision: profile?.customer.revision ?? null });
    if (!intent.current || intent.current.fingerprint !== fingerprint) intent.current = { id: crypto.randomUUID(), fingerprint };
    setSaving(true);
    const result = await saveCustomer({ commandId: intent.current.id, companyId, customerId: isEditing ? customerId : null, expectedRevision: profile?.customer.revision ?? null, data });
    if (!result.ok) {
      setSaving(false);
      setConflict(result.conflict);
      setSaveMessage(/rede|network|fetch|timeout/i.test(result.message) ? "Não foi possível confirmar o resultado. Salve de novo: a mesma operação não será duplicada." : result.message);
      return;
    }
    const savedId = result.customerId;
    const problems: string[] = [];
    for (const removed of removedPhotos) {
      const error = await removeCustomerPhoto(removed);
      if (error) problems.push(error);
    }
    let primaryExistingId: string | null = null;
    let primaryNewPath: string | null = null;
    for (const photo of photos) {
      if (photo.file) {
        let path = photoPaths.current.get(photo.key);
        const sent = await uploadCustomerPhoto({ customerId: savedId, file: photo.file, category: photo.category, caption: photo.caption, storagePath: path });
        if (!sent.ok) { problems.push(sent.message); continue; }
        photoPaths.current.set(photo.key, sent.storagePath);
        path = sent.storagePath;
        if (photo.primary) primaryNewPath = path;
      } else if (photo.existingId) {
        const original = profile?.media.find((m) => m.id === photo.existingId);
        if (original && (original.category !== photo.category || original.caption !== photo.caption)) {
          const error = await updateCustomerMedia(photo.existingId, { category: photo.category, caption: photo.caption });
          if (error) problems.push(error);
        }
        if (photo.primary && original && !original.primary_front) primaryExistingId = photo.existingId;
      }
    }
    if (primaryExistingId) {
      const error = await setPrimaryCustomerPhoto(primaryExistingId);
      if (error) problems.push(error);
    } else if (primaryNewPath) {
      const refreshed = await fetchCustomerProfile(savedId);
      const created = refreshed.state === "ready" ? refreshed.data?.media.find((m) => m.storage_path === primaryNewPath) : null;
      if (created) {
        const error = await setPrimaryCustomerPhoto(created.id);
        if (error) problems.push(error);
      }
    }
    setSaving(false);
    setInitial(form);
    photos.forEach((p) => p.file && URL.revokeObjectURL(p.previewUrl));
    if (problems.length) toast.warning("Cliente salvo, mas houve problema com fotos. Abra Alterar para conferir e enviar de novo.");
    else toast.success(isEditing ? "Cliente atualizado" : "Cliente cadastrado");
    navigate(`/admin/clientes/${savedId}`, { replace: true });
  }

  function requestLeave() {
    if (dirty) setConfirmLeave(true);
    else navigate(backTo);
  }

  if (loadState === "loading") return <AdminState variant="loading" message="Carregando cadastro..." />;
  if (loadState === "error") return <AdminState variant="error" message={loadError || "Não foi possível carregar o cadastro."} />;
  if (loadState === "missing") return <AdminState variant="empty" message="Cliente não encontrado." />;

  const summary = errorSummary(errors);
  const mapHint = coords.kind === "valid" ? (form.locationConfirmed ? "Ponto conferido" : "Ponto informado, falta conferir") : coords.kind === "invalid" ? "Ponto inválido" : "Ponto não informado";
  const isPf = form.personType === "PF";

  return (
    <form
      noValidate
      onSubmit={(event) => { event.preventDefault(); void submit(); }}
      className="flex flex-col gap-6 pb-36 lg:pb-28"
    >
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Relacionamento</p>
        <h1 className="text-2xl font-extrabold text-forest-950">{isEditing ? "Alterar cadastro do cliente" : "Novo cliente"}</h1>
        <p className="text-sm text-ink-muted">Um cadastro completo. Um atendimento mais próximo.</p>
      </div>

      {summary.length > 0 && (
        <div ref={errorsRef} tabIndex={-1} role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 outline-none">
          <strong>Falta conferir alguns dados</strong>
          <ul className="mt-1 list-disc pl-5">{summary.map((message) => <li key={message}>{message}</li>)}</ul>
        </div>
      )}
      {saveMessage && (
        <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {saveMessage}
          {conflict && <button type="button" onClick={() => window.location.reload()} className="ml-3 min-h-11 font-bold underline">Recarregar cadastro</button>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="identificacao" icon={<IdCard size={20} />} title="Identificação do cliente" subtitle="O comércio, o documento e a forma como será encontrado." step="01">
            <Field label="Tipo de pessoa">
              <div role="group" aria-label="Tipo de pessoa" className="flex rounded-xl bg-forest-950/5 p-1">
                {(["PJ", "PF"] as const).map((type) => (
                  <button key={type} type="button" aria-pressed={form.personType === type} onClick={() => set("personType", type)} className={cn("min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold", form.personType === type ? "bg-white text-forest-900 shadow-sm" : "text-ink-muted")}>
                    {type === "PJ" ? "Pessoa jurídica" : "Pessoa física"}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Situação do cadastro" htmlFor="status" help={isEditing ? "Para inativar com motivo, use a ficha do cliente." : undefined}>
              <select id="status" value={form.status} disabled className={inputClass}>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </Field>
            <Field full label="Nome fantasia / nome do comércio *" htmlFor="tradeName" error={errors.tradeName} help="Este é o nome em destaque na carteira e na ficha do cliente.">
              <input id="tradeName" maxLength={120} value={form.tradeName} onChange={(e) => set("tradeName", e.target.value)} placeholder="Ex.: Tio Otto Supermercado" className={inputClass} />
            </Field>
            <Field label={isPf ? "Nome completo *" : "Razão social *"} htmlFor="legalName" error={errors.legalName}>
              <input id="legalName" maxLength={160} value={form.legalName} onChange={(e) => set("legalName", e.target.value)} placeholder="Nome registrado no documento" className={inputClass} />
            </Field>
            <Field label={`${isPf ? "CPF" : "CNPJ"} *`} htmlFor="document" error={errors.document} help={isPf ? "11 números." : "Aceita o formato numérico e o novo CNPJ com letras. O sistema confere só o formato, não a situação na Receita."}>
              <input id="document" maxLength={18} autoComplete="off" spellCheck={false} value={form.document} onChange={(e) => set("document", e.target.value.toUpperCase())} onBlur={() => set("document", normalizeDocument(form.document) ? form.document : "")} placeholder={isPf ? "000.000.000-00" : "00.000.000/0000-00"} className={inputClass} />
            </Field>
            {!isPf && (
              <>
                <Field label="Inscrição estadual" htmlFor="ie">
                  <input id="ie" maxLength={30} disabled={form.exempt} value={form.exempt ? "" : form.stateRegistration} onChange={(e) => set("stateRegistration", e.target.value)} placeholder="Informe a inscrição" className={inputClass} />
                  <Check checked={form.exempt} onChange={(v) => set("exempt", v)}>Isento de inscrição estadual</Check>
                </Field>
                <Field label="Enquadramento informado" htmlFor="tax" help="Informação cadastral; não substitui a configuração fiscal.">
                  <select id="tax" value={form.taxProfile} onChange={(e) => set("taxProfile", e.target.value)} className={inputClass}>
                    {TAX_PROFILES.map((option) => <option key={option} value={option}>{option || "Não informado"}</option>)}
                  </select>
                </Field>
              </>
            )}
          </Section>

          <Section icon={<Phone size={20} />} title="Contatos do comércio" subtitle="Com quem falar para comprar, receber e conferir." step="02">
            <Field label="Nome do contato principal" htmlFor="contactName">
              <input id="contactName" maxLength={100} autoComplete="name" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="Nome da pessoa responsável" className={inputClass} />
            </Field>
            <Field label="Função no comércio" htmlFor="contactRole">
              <select id="contactRole" value={form.contactRole} onChange={(e) => set("contactRole", e.target.value)} className={inputClass}>
                {CONTACT_ROLES.map((role) => <option key={role} value={role}>{role || "Selecione"}</option>)}
              </select>
            </Field>
            <Field label="Telefone / WhatsApp" htmlFor="phone" error={errors.phone}>
              <input id="phone" type="tel" inputMode="tel" maxLength={24} autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(94) 99999-9999" className={inputClass} />
            </Field>
            <Field label="E-mail" htmlFor="email" error={errors.email}>
              <input id="email" type="email" maxLength={160} autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@comercio.com.br" className={inputClass} />
            </Field>
            <div className="md:col-span-2"><Check checked={form.whatsapp} onChange={(v) => set("whatsapp", v)}>O telefone informado também recebe WhatsApp</Check></div>
            {form.extraContacts.map((contact, index) => (
              <div key={contact.key} className="grid grid-cols-1 gap-3 rounded-2xl border border-forest-950/10 p-4 md:col-span-2 md:grid-cols-2">
                <div className="flex items-center justify-between md:col-span-2">
                  <strong className="text-sm text-forest-950">Contato adicional {index + 1}</strong>
                  <button type="button" aria-label={`Remover contato adicional ${index + 1}`} onClick={() => set("extraContacts", form.extraContacts.filter((c) => c.key !== contact.key))} className="flex h-11 w-11 items-center justify-center rounded-xl text-red-700 hover:bg-red-50"><X size={18} aria-hidden /></button>
                </div>
                {([["name", "Nome"], ["phone", "Telefone"], ["email", "E-mail"]] as const).map(([field, label]) => (
                  <input key={field} aria-label={`${label} do contato adicional ${index + 1}`} placeholder={label} value={contact[field]} onChange={(e) => set("extraContacts", form.extraContacts.map((c) => (c.key === contact.key ? { ...c, [field]: e.target.value } : c)))} className={inputClass} />
                ))}
                <select aria-label={`Função do contato adicional ${index + 1}`} value={contact.role} onChange={(e) => set("extraContacts", form.extraContacts.map((c) => (c.key === contact.key ? { ...c, role: e.target.value } : c)))} className={inputClass}>
                  {CONTACT_ROLES.map((role) => <option key={role} value={role}>{role || "Função"}</option>)}
                </select>
                <Check checked={contact.whatsapp} onChange={(v) => set("extraContacts", form.extraContacts.map((c) => (c.key === contact.key ? { ...c, whatsapp: v } : c)))}>Recebe WhatsApp</Check>
              </div>
            ))}
            <div className="md:col-span-2">
              <Button type="button" variant="outline" onClick={() => set("extraContacts", [...form.extraContacts, { key: crypto.randomUUID(), name: "", role: "", phone: "", whatsapp: false, email: "" }])}>
                <Plus size={16} /> Adicionar outro contato
              </Button>
            </div>
          </Section>

          <Section id="endereco" icon={<MapPinned size={20} />} title="Endereço e localização" subtitle="Endereço para o cadastro. Ponto exato para chegar ao comércio." step="03">
            <Field label="CEP" htmlFor="cep" error={errors.cep} help="Digite os 8 números para buscar o endereço pelo ViaCEP.">
              <div className="flex gap-2">
                <input id="cep" inputMode="numeric" maxLength={9} autoComplete="postal-code" value={form.cep} onChange={(e) => set("cep", formatCep(e.target.value))} placeholder="00000-000" className={inputClass} />
                <Button type="button" variant="outline" onClick={() => void lookupCep()}>Buscar</Button>
              </div>
            </Field>
            <Field label="Estado / UF *" htmlFor="uf" error={errors.uf}>
              <select id="uf" value={form.uf} onChange={(e) => handleUf(e.target.value)} className={inputClass}>
                <option value="">Selecione o estado</option>
                {states.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
                {form.uf && !states.some((s) => s.code === form.uf) && <option value={form.uf}>{form.uf}</option>}
              </select>
            </Field>
            <Field label="Município *" htmlFor="city" error={errors.city}>
              <div className="flex gap-2">
                <input id="city" list="municipios" disabled={!form.uf} autoComplete="off" value={form.city} onChange={(e) => void handleCityInput(e)} placeholder="Escolha a UF e digite a cidade" className={inputClass} />
                <Button type="button" variant="outline" onClick={() => void loadCities(form.uf, form.city)} disabled={!form.uf}>Atualizar</Button>
              </div>
              <datalist id="municipios">{cities.map((c) => <option key={c.code} value={c.name} />)}</datalist>
              {citiesError && <span role="alert" className="text-xs text-red-600">Não foi possível carregar os municípios. Tente atualizar a lista.</span>}
            </Field>
            <Field label="Código do município · IBGE" htmlFor="ibge" help={form.ibge ? "Município selecionado no catálogo do IBGE." : "7 dígitos, diferente do CEP. Preenche ao escolher o município."}>
              <input id="ibge" readOnly value={form.ibge} placeholder="Preenchimento automático" className={inputClass} />
            </Field>
            <Field label="Logradouro *" htmlFor="street" error={errors.street}>
              <input id="street" maxLength={150} autoComplete="address-line1" value={form.street} onChange={(e) => set("street", e.target.value)} placeholder="Rua, avenida, travessa..." className={inputClass} />
            </Field>
            <Field label="Número *" htmlFor="number" error={errors.number}>
              <input id="number" maxLength={20} value={form.number} onChange={(e) => set("number", e.target.value)} placeholder="Ex.: 128 ou S/N" className={inputClass} />
            </Field>
            <Field label="Bairro" htmlFor="neighborhood">
              <input id="neighborhood" maxLength={100} value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} placeholder="Bairro do comércio" className={inputClass} />
            </Field>
            <Field label="Complemento" htmlFor="complement">
              <input id="complement" maxLength={100} autoComplete="address-line2" value={form.complement} onChange={(e) => set("complement", e.target.value)} placeholder="Loja, bloco, sala, lote..." className={inputClass} />
            </Field>
            <Field full label="Ponto de referência / orientação para entrega" htmlFor="reference">
              <textarea id="reference" maxLength={600} rows={3} value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Ex.: fachada verde, ao lado da farmácia. Recebimento pela rua lateral." className="rounded-xl border border-ink-900/15 p-3 text-sm outline-none focus:border-forest-700" />
            </Field>
            {addressNote && <p role="status" className={cn("rounded-2xl p-3 text-sm md:col-span-2", addressNote.error ? "bg-red-50 text-red-700" : "bg-forest-700/10 text-forest-900")}>{addressNote.text}</p>}

            <div className="rounded-2xl border border-forest-950/10 p-4 md:col-span-2">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-forest-950">Localização exata do comércio</h3>
                <span className={cn("rounded-full px-3 py-1 text-xs font-bold", coords.kind === "valid" && form.locationConfirmed ? "bg-forest-700/10 text-forest-800" : coords.kind === "invalid" ? "bg-red-50 text-red-700" : "bg-gold-400/25 text-gold-600")}>{mapHint}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Latitude" htmlFor="latitude" error={errors.latitude}>
                  <input id="latitude" inputMode="decimal" maxLength={24} value={form.latitude} onChange={(e) => set("latitude", e.target.value)} placeholder="Ex.: -6.530300" className={inputClass} />
                </Field>
                <Field label="Longitude" htmlFor="longitude">
                  <input id="longitude" inputMode="decimal" maxLength={24} value={form.longitude} onChange={(e) => set("longitude", e.target.value)} placeholder="Ex.: -49.856000" className={inputClass} />
                </Field>
              </div>
              <p className="mt-2 text-xs text-ink-muted">O CEP não fornece estas coordenadas. Confira o ponto do estabelecimento no mapa. {form.locationSource === "GPS_DISPOSITIVO" && form.locationAccuracy ? `Origem: posição do aparelho, precisão ${form.locationAccuracy} m.` : ""}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={openMap}>Abrir no mapa</Button>
                <Button type="button" variant="outline" onClick={() => setConfirmGeo(true)}>Usar minha posição</Button>
                <Button type="button" variant="ghost" onClick={() => setShowHow((v) => !v)}>Como obter coordenadas?</Button>
              </div>
              {showHow && (
                <p className="mt-3 rounded-2xl bg-cream-50 p-3 text-sm text-ink-700">
                  1. Clique em Abrir no mapa e confira o endereço. 2. No Google Maps, clique com o botão direito no ponto exato (no celular, mantenha o toque). 3. Copie o primeiro número para Latitude e o segundo para Longitude. 4. Abra o mapa de novo para conferir e marque a confirmação. Buscar o endereço no mapa não preenche coordenadas sozinho.
                </p>
              )}
              <div className="mt-2"><Check checked={form.locationConfirmed} disabled={coords.kind !== "valid"} onChange={(v) => setForm((prev) => ({ ...prev, locationConfirmed: v }))}>Conferi que este ponto corresponde ao comércio</Check></div>
              {geoNote && <p role="status" className={cn("mt-2 rounded-2xl p-3 text-sm", geoNote.error ? "bg-red-50 text-red-700" : "bg-forest-700/10 text-forest-900")}>{geoNote.text}</p>}
            </div>
          </Section>

          <section id="fotos" className="rounded-3xl border border-forest-950/10 bg-white">
            <div className="flex items-start gap-3 border-b border-forest-950/10 px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-700/10 text-forest-700"><Camera size={20} /></span>
              <div className="flex-1"><h2 className="text-base font-extrabold text-forest-950">Fotos do estabelecimento</h2><p className="text-xs text-ink-muted">Conheça a fachada, o espaço interno e as referências do local.</p></div>
              <span className="font-mono text-xs text-ink-muted">04</span>
            </div>
            <div className="p-5"><CustomerPhotosField photos={photos} messages={photoMessages} onAddFiles={addFiles} onChange={changePhoto} onPrimary={(key) => setPhotos((prev) => prev.map((p) => ({ ...p, primary: p.key === key && p.category === "FACHADA" })))} onRemove={removePhoto} /></div>
          </section>

          <Section icon={<UsersRound size={20} />} title="Relacionamento e atendimento" subtitle="A equipe que acompanha este cliente e as orientações do dia a dia." step="05">
            <Field label="Vendedor responsável" htmlFor="seller">
              <select id="seller" value={form.sellerId} onChange={(e) => set("sellerId", e.target.value)} className={inputClass}>
                <option value="">Não definido</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Promotor responsável" htmlFor="promoter">
              <select id="promoter" value={form.promoterId} onChange={(e) => set("promoterId", e.target.value)} className={inputClass}>
                <option value="">Não definido</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Segmento" htmlFor="segment">
              <select id="segment" value={form.segment} onChange={(e) => set("segment", e.target.value)} className={inputClass}>
                {SEGMENTS.map((s) => <option key={s} value={s}>{s || "Selecione"}</option>)}
                {form.segment && !SEGMENTS.includes(form.segment) && <option value={form.segment}>{form.segment}</option>}
              </select>
            </Field>
            <Field label="Origem do cadastro" htmlFor="origin">
              <select id="origin" value={form.origin} onChange={(e) => set("origin", e.target.value)} className={inputClass}>
                {ORIGINS.map((o) => <option key={o} value={o}>{o}</option>)}
                {form.origin && !ORIGINS.includes(form.origin) && <option value={form.origin}>{form.origin}</option>}
              </select>
            </Field>
            <Field full label="Observações de atendimento" htmlFor="serviceNotes">
              <textarea id="serviceNotes" maxLength={1000} rows={3} value={form.serviceNotes} onChange={(e) => set("serviceNotes", e.target.value)} placeholder="Preferências, melhor horário para conversar e observações da equipe." className="rounded-xl border border-ink-900/15 p-3 text-sm outline-none focus:border-forest-700" />
            </Field>
            <p className="rounded-2xl bg-cream-50 p-3 text-sm text-ink-700 md:col-span-2">Atribuir um responsável não cria visitas automaticamente.</p>
          </Section>

          <Section id="credito" icon={<WalletCards size={20} />} title="Limite e condições comerciais" subtitle="Informações para conferência e definição pelo responsável autorizado." step="06">
            <Field label="Limite de crédito proposto · R$" htmlFor="creditLimit" error={errors.creditLimit} help="O cadastro não libera crédito nem cria obrigação de pagamento. O limite aprovado é alterado só em Gerir limite, na ficha.">
              <input id="creditLimit" inputMode="decimal" maxLength={20} disabled={!canEditCredit} value={form.creditLimit} onChange={(e) => set("creditLimit", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Prazo preferencial" htmlFor="paymentTerms">
              <select id="paymentTerms" disabled={!canEditCredit} value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} className={inputClass}>
                {PAYMENT_TERM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Forma de pagamento preferencial" htmlFor="paymentMethod">
              <select id="paymentMethod" disabled={!canEditCredit} value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} className={inputClass}>
                {PAYMENT_METHOD_OPTIONS.map((o) => <option key={o} value={o}>{o || "Não definida"}</option>)}
              </select>
            </Field>
            <Field label="Situação da análise" htmlFor="creditState">
              <input id="creditState" readOnly value={CREDIT_STATE_LABEL[form.creditState] ?? form.creditState} className={inputClass} />
            </Field>
            <Field full label="Observação para a conferência de crédito" htmlFor="creditNotes">
              <textarea id="creditNotes" maxLength={600} rows={3} disabled={!canEditCredit} value={form.creditNotes} onChange={(e) => set("creditNotes", e.target.value)} placeholder="Informações que ajudam o responsável a avaliar a proposta." className="rounded-xl border border-ink-900/15 p-3 text-sm outline-none focus:border-forest-700 disabled:bg-forest-950/5" />
            </Field>
            {!canEditCredit && <p className="rounded-2xl bg-cream-50 p-3 text-sm text-ink-700 md:col-span-2">Seu perfil pode consultar, mas não alterar condições comerciais. O servidor confere essa permissão de novo ao salvar.</p>}
          </Section>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
          <section className="overflow-hidden rounded-3xl border border-forest-950/10 bg-white">
            <div className="bg-forest-900 px-5 py-3 font-mono text-xs tracking-widest text-cream-50">PRÉVIA DO CADASTRO</div>
            <div className="flex flex-col gap-3 p-5">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-700/10 text-forest-700"><BriefcaseBusiness size={22} aria-hidden /></span>
              <h2 className="text-lg font-extrabold text-forest-950">{form.tradeName.trim() || "Seu próximo cliente"}</h2>
              <p className="text-sm text-ink-muted">{form.legalName.trim() || "Preencha o nome do comércio para começar."}</p>
              <span className={cn("w-fit rounded-full px-3 py-1 text-xs font-bold", form.status === "ATIVO" ? "bg-forest-700/10 text-forest-800" : "bg-gold-400/25 text-gold-600")}>{form.status === "ATIVO" ? "Cadastro ativo" : "Cadastro inativo"}</span>
              <dl className="grid grid-cols-1 gap-2 text-sm">
                <div><dt className="text-xs uppercase text-ink-muted">Localização</dt><dd>{form.city ? `${form.city}${form.uf ? ` / ${form.uf}` : ""}` : "Cidade não informada"}</dd></div>
                <div><dt className="text-xs uppercase text-ink-muted">Contato principal</dt><dd>{form.contactName || "Contato não informado"}</dd></div>
                <div><dt className="text-xs uppercase text-ink-muted">Atendimento</dt><dd>{form.phone || "Telefone não informado"}</dd></div>
                <div><dt className="text-xs uppercase text-ink-muted">Estabelecimento</dt><dd>{photos.length ? `${photos.length} foto(s)` : "Nenhuma foto adicionada"}</dd></div>
              </dl>
            </div>
          </section>
          <section className="rounded-3xl border border-forest-950/10 bg-white p-5">
            <div className="flex items-center justify-between"><strong className="text-forest-950">Qualidade do cadastro</strong><span className="font-bold text-forest-800">{quality.percent}%</span></div>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={quality.percent} aria-label="Qualidade do cadastro" className="mt-2 h-2 overflow-hidden rounded-full bg-forest-950/10"><div className="h-full bg-forest-700" style={{ width: `${quality.percent}%` }} /></div>
            <ul className="mt-3 flex flex-col gap-1 text-sm">{quality.items.map((item) => <li key={item.label} className={item.done ? "text-forest-800" : "text-ink-muted"}>{item.done ? "✓" : "·"} {item.label}</li>)}</ul>
            <p className="mt-3 text-xs text-ink-muted">Indicador de preenchimento. Não representa score de crédito, validação fiscal nem qualidade do cliente.</p>
          </section>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 border-t border-forest-950/10 bg-cream-50/95 backdrop-blur lg:bottom-0 lg:left-64">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm text-ink-700">{dirty ? <><strong>Alterações não salvas</strong><br />Revise os dados antes de concluir.</> : <><strong>Nenhuma alteração pendente</strong></>}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="lg" onClick={requestLeave} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="secondary" size="lg" disabled={saving}><Save size={16} /> {saving ? "Salvando..." : "Salvar cadastro"}</Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pendingCep !== null}
        onClose={() => setPendingCep(null)}
        title="Substituir o endereço preenchido?"
        description="O CEP consultado traz outro logradouro, bairro e município. Número, complemento e referência são mantidos; a confirmação do ponto no mapa será desfeita."
        confirmLabel="Aplicar endereço"
        onConfirm={() => { if (pendingCep) void applyCep(pendingCep); }}
      />
      <ConfirmDialog
        open={confirmGeo}
        onClose={() => setConfirmGeo(false)}
        title="Você está no comércio do cliente?"
        description="A posição capturada será a deste aparelho, e não uma localização calculada pelo CEP. Use somente se estiver fisicamente no estabelecimento."
        confirmLabel="Usar minha posição"
        onConfirm={useMyPosition}
      />
      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Descartar alterações?"
        description="Há dados não salvos neste cadastro. Se sair agora, eles serão perdidos."
        confirmLabel="Descartar e sair"
        cancelLabel="Continuar editando"
        destructive
        onConfirm={() => { setConfirmLeave(false); navigate(backTo); }}
      />
    </form>
  );
}
