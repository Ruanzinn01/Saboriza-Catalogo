import { parseCreditLimitInput } from "@/lib/customer-credit";
import type { CustomerContact, CustomerProfile } from "@/lib/customers-api";

export interface ExtraContactForm {
  key: string;
  name: string;
  role: string;
  phone: string;
  whatsapp: boolean;
  email: string;
}

export interface CustomerFormState {
  personType: "PF" | "PJ";
  status: "ATIVO" | "INATIVO";
  tradeName: string;
  legalName: string;
  document: string;
  stateRegistration: string;
  exempt: boolean;
  taxProfile: string;
  contactName: string;
  contactRole: string;
  phone: string;
  whatsapp: boolean;
  email: string;
  extraContacts: ExtraContactForm[];
  cep: string;
  uf: string;
  city: string;
  ibge: string;
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  reference: string;
  latitude: string;
  longitude: string;
  locationSource: string;
  locationAccuracy: string;
  locationCapturedAt: string;
  locationConfirmed: boolean;
  sellerId: string;
  promoterId: string;
  segment: string;
  origin: string;
  serviceNotes: string;
  creditLimit: string;
  paymentTerms: string;
  paymentMethod: string;
  creditState: string;
  creditNotes: string;
}

export type FormErrors = Partial<Record<keyof CustomerFormState | "form", string>>;

export function emptyCustomerForm(): CustomerFormState {
  return {
    personType: "PJ", status: "ATIVO", tradeName: "", legalName: "", document: "", stateRegistration: "", exempt: false, taxProfile: "",
    contactName: "", contactRole: "", phone: "", whatsapp: false, email: "", extraContacts: [],
    cep: "", uf: "", city: "", ibge: "", street: "", number: "", neighborhood: "", complement: "", reference: "",
    latitude: "", longitude: "", locationSource: "", locationAccuracy: "", locationCapturedAt: "", locationConfirmed: false,
    sellerId: "", promoterId: "", segment: "", origin: "Cadastro direto", serviceNotes: "",
    creditLimit: "0,00", paymentTerms: "", paymentMethod: "", creditState: "NAO_ANALISADO", creditNotes: "",
  };
}

export function formatMoneyInput(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formFromProfile(customer: CustomerProfile, contacts: CustomerContact[]): CustomerFormState {
  return {
    personType: customer.person_type,
    status: customer.registration_status,
    tradeName: customer.trade_name,
    legalName: customer.company_name,
    document: customer.cnpj,
    stateRegistration: customer.ie,
    exempt: customer.ie_exempt,
    taxProfile: customer.tax_profile ?? "",
    contactName: customer.name,
    contactRole: customer.contact_role ?? "",
    phone: customer.phone,
    whatsapp: customer.whatsapp_enabled,
    email: customer.email,
    extraContacts: contacts.map((c) => ({ key: c.id, name: c.name, role: c.role ?? "", phone: c.phone, whatsapp: c.whatsapp_enabled, email: c.email })),
    cep: customer.cep,
    uf: customer.state,
    city: customer.city,
    ibge: customer.ibge_code ?? "",
    street: customer.address,
    number: customer.address_number,
    neighborhood: customer.neighborhood,
    complement: customer.address_complement,
    reference: customer.delivery_reference,
    latitude: customer.latitude === null ? "" : String(customer.latitude),
    longitude: customer.longitude === null ? "" : String(customer.longitude),
    locationSource: customer.location_source ?? "",
    locationAccuracy: customer.location_accuracy_m === null ? "" : String(customer.location_accuracy_m),
    locationCapturedAt: "",
    locationConfirmed: customer.location_confirmed_at !== null,
    sellerId: customer.seller_employee_id ?? "",
    promoterId: customer.promoter_employee_id ?? "",
    segment: customer.segment ?? "",
    origin: customer.origin ?? "Cadastro direto",
    serviceNotes: customer.service_notes,
    creditLimit: formatMoneyInput(customer.proposed_credit_limit),
    paymentTerms: customer.preferred_payment_days ?? "",
    paymentMethod: customer.preferred_payment_method ?? "",
    creditState: customer.credit_analysis_state,
    creditNotes: customer.credit_notes,
  };
}

export function normalizeDocument(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function documentFormatError(raw: string, personType: "PF" | "PJ"): string | null {
  const doc = normalizeDocument(raw);
  if (!doc) return null;
  if (personType === "PJ") return /^[A-Z0-9]{12}\d{2}$/.test(doc) ? null : "O CNPJ deve conter 14 posições, com os dois últimos caracteres numéricos.";
  return /^\d{11}$/.test(doc) ? null : "O CPF deve conter 11 números.";
}

export function parseCoordinate(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (text === "" || !/^[+-]?\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export type CoordinateState = { kind: "empty" } | { kind: "valid"; lat: number; lon: number } | { kind: "invalid" };

export function coordinateState(form: Pick<CustomerFormState, "latitude" | "longitude">): CoordinateState {
  const hasLat = form.latitude.trim() !== "";
  const hasLon = form.longitude.trim() !== "";
  if (!hasLat && !hasLon) return { kind: "empty" };
  const lat = parseCoordinate(form.latitude);
  const lon = parseCoordinate(form.longitude);
  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return { kind: "invalid" };
  return { kind: "valid", lat, lon };
}

export function buildMapUrl(form: CustomerFormState): { url: string | null; message: string | null; approximate: boolean } {
  const coords = coordinateState(form);
  if (coords.kind === "valid") {
    return { url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${coords.lat},${coords.lon}`)}`, message: null, approximate: false };
  }
  if (coords.kind === "invalid") return { url: null, message: "Corrija as coordenadas antes de abrir o mapa.", approximate: false };
  if (!form.city.trim() && !form.street.trim()) return { url: null, message: "Preencha o endereço ou as coordenadas para abrir o mapa.", approximate: true };
  const query = [form.street, form.number, form.city, form.uf, "Brasil"].map((p) => p.trim()).filter(Boolean).join(", ");
  return { url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, message: null, approximate: true };
}

export interface ValidationContext {
  isNew: boolean;
  canEditCredit: boolean;
  municipalityResolved: boolean;
}

export function validateCustomerForm(form: CustomerFormState, ctx: ValidationContext): FormErrors {
  const errors: FormErrors = {};
  if (!form.tradeName.trim()) errors.tradeName = "Informe o nome do comércio.";
  if (!form.legalName.trim()) errors.legalName = form.personType === "PJ" ? "Informe a razão social." : "Informe o nome completo.";
  if (!normalizeDocument(form.document)) errors.document = "Informe o documento.";
  else {
    const docError = documentFormatError(form.document, form.personType);
    if (docError) errors.document = docError;
  }
  if (!form.uf) errors.uf = "Selecione o estado.";
  if (!form.city.trim()) errors.city = "Informe o município.";
  else if (form.uf && !ctx.municipalityResolved) errors.city = "Selecione um município da lista do IBGE ou busque um CEP para obter o código correto.";
  if (!form.street.trim()) errors.street = "Informe o logradouro.";
  if (!form.number.trim()) errors.number = "Informe o número ou S/N.";
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Confira o formato do e-mail informado.";
  if (form.cep.trim() && form.cep.replace(/\D/g, "").length !== 8) errors.cep = "Informe um CEP de 8 números ou deixe o campo vazio.";
  if (!form.phone.trim() && !form.email.trim()) errors.phone = "Informe um telefone ou e-mail de contato.";
  const coords = coordinateState(form);
  if (coords.kind === "invalid") errors.latitude = "Latitude e longitude devem ser informadas juntas, entre -90 e 90 e entre -180 e 180.";
  else if (coords.kind === "valid" && !form.locationConfirmed) errors.latitude = "Confira a localização no mapa e marque a confirmação do ponto.";
  if (ctx.canEditCredit) {
    const limit = parseCreditLimitInput(form.creditLimit);
    if (limit === null || limit > 999_999_999) errors.creditLimit = "Informe um limite proposto válido, maior ou igual a zero, usando vírgula para centavos.";
  }
  return errors;
}

export function errorSummary(errors: FormErrors): string[] {
  return Object.values(errors).filter((m): m is string => Boolean(m));
}

export function buildSavePayload(form: CustomerFormState, opts: { canEditCredit: boolean }): Record<string, unknown> {
  const coords = coordinateState(form);
  const payload: Record<string, unknown> = {
    person_type: form.personType,
    trade_name: form.tradeName.trim(),
    company_name: form.legalName.trim(),
    name: form.contactName.trim(),
    contact_role: form.contactRole || null,
    phone: form.phone.trim(),
    whatsapp_enabled: form.whatsapp,
    email: form.email.trim(),
    cnpj: normalizeDocument(form.document),
    ie: form.exempt ? "" : form.stateRegistration.trim(),
    ie_exempt: form.exempt,
    tax_profile: form.personType === "PJ" ? form.taxProfile || null : null,
    cep: form.cep.replace(/\D/g, ""),
    state: form.uf,
    city: form.city.trim(),
    ibge_code: form.ibge || null,
    address: form.street.trim(),
    address_number: form.number.trim(),
    neighborhood: form.neighborhood.trim(),
    address_complement: form.complement.trim(),
    delivery_reference: form.reference.trim(),
    latitude: coords.kind === "valid" ? coords.lat : null,
    longitude: coords.kind === "valid" ? coords.lon : null,
    location_source: coords.kind === "valid" ? form.locationSource || "MANUAL" : null,
    location_accuracy_m: coords.kind === "valid" && form.locationAccuracy ? Number(form.locationAccuracy) : null,
    location_captured_at: coords.kind === "valid" && form.locationCapturedAt ? form.locationCapturedAt : null,
    location_confirmed: coords.kind === "valid" && form.locationConfirmed,
    seller_employee_id: form.sellerId || null,
    promoter_employee_id: form.promoterId || null,
    segment: form.segment || null,
    origin: form.origin || null,
    service_notes: form.serviceNotes.trim(),
    extra_contacts: form.extraContacts
      .filter((c) => c.name.trim())
      .map((c) => ({ name: c.name.trim(), role: c.role || null, phone: c.phone.trim(), whatsapp_enabled: c.whatsapp, email: c.email.trim() })),
  };
  if (opts.canEditCredit) {
    payload.proposed_credit_limit = parseCreditLimitInput(form.creditLimit) ?? 0;
    payload.preferred_payment_days = form.paymentTerms || null;
    payload.preferred_payment_method = form.paymentMethod || null;
    payload.credit_analysis_state = form.creditState || "NAO_ANALISADO";
    payload.credit_notes = form.creditNotes.trim();
  }
  return payload;
}

export interface QualityItem {
  label: string;
  done: boolean;
}

export function qualityChecklist(form: CustomerFormState, hasPrimaryFront: boolean, municipalityResolved: boolean): { percent: number; items: QualityItem[] } {
  const coords = coordinateState(form);
  const items: QualityItem[] = [
    { label: "Identificação", done: Boolean(form.tradeName.trim() && form.legalName.trim() && form.document.trim()) },
    { label: "Contato principal", done: Boolean(form.contactName.trim() && form.phone.trim()) },
    { label: "Endereço e município", done: Boolean(form.street.trim() && form.number.trim() && municipalityResolved) },
    { label: "Localização conferida", done: coords.kind === "valid" && form.locationConfirmed },
    { label: "Foto de fachada", done: hasPrimaryFront },
    { label: "Equipe responsável", done: Boolean(form.sellerId || form.promoterId) },
  ];
  return { percent: Math.round((items.filter((i) => i.done).length / items.length) * 100), items };
}

export function isFormDirty(current: CustomerFormState, initial: CustomerFormState, pendingPhotos: number): boolean {
  return pendingPhotos > 0 || JSON.stringify(current) !== JSON.stringify(initial);
}

export const PAYMENT_TERM_OPTIONS = [
  { value: "", label: "Não definido" },
  { value: "cash", label: "À vista" },
  { value: "7", label: "7 dias" },
  { value: "14", label: "14 dias" },
  { value: "21", label: "21 dias" },
  { value: "28", label: "28 dias" },
  { value: "custom", label: "A definir na negociação" },
];

export const PAYMENT_METHOD_OPTIONS = ["", "Pix", "Boleto", "Cartão", "Dinheiro"];
export const CONTACT_ROLES = ["", "Proprietário(a)", "Comprador(a)", "Gerente", "Financeiro", "Recebimento", "Outro"];
export const SEGMENTS = ["", "Supermercado", "Mercadinho / mercearia", "Atacado", "Conveniência", "Restaurante", "Outros"];
export const ORIGINS = ["Cadastro direto", "Indicação", "Prospecção em campo", "Outro"];
export const TAX_PROFILES = ["", "MEI", "Simples Nacional", "Regime normal"];
export const CREDIT_STATE_LABEL: Record<string, string> = { NAO_ANALISADO: "Não analisado", EM_ANALISE: "Em análise", CONFERIDO: "Conferido" };
