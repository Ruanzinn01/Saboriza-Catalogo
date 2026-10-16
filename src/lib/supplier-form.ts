import type { Supplier, SupplierInput } from "@/types/supplier";
import { normalizeDocument } from "@/lib/supplier-search";

export const TAX_PROFILES = ["MEI", "Simples Nacional", "Regime normal"];
export const CONTACT_ROLES = ["Representante comercial", "Vendas", "Financeiro", "Expedição", "Proprietário(a)", "Outro"];
export const SUPPLY_TYPES = [
  "Matérias-primas e insumos",
  "Embalagens",
  "Mercadorias para revenda",
  "Serviços",
  "Bens e investimentos",
  "Fornecimento misto",
];
export const ORIGINS = ["Cadastro direto", "Indicação", "Prospecção em campo", "Outro"];
export const COST_CENTERS = ["Fábrica", "Administrativo", "Comercial", "Logística"];
export const FREIGHT_TERMS = ["A combinar", "Incluso pelo fornecedor", "Por nossa conta", "Retirada no fornecedor"];
export const PAYMENT_TERMS: { value: string; label: string }[] = [
  { value: "", label: "Não definido" },
  { value: "cash", label: "À vista" },
  { value: "7", label: "7 dias" },
  { value: "14", label: "14 dias" },
  { value: "21", label: "21 dias" },
  { value: "28", label: "28 dias" },
  { value: "custom", label: "A definir na negociação" },
];
export const PAYMENT_METHODS = ["Pix", "Boleto", "Cartão", "Dinheiro"];

export const emptySupplierForm: SupplierInput = {
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
  personType: "PJ",
  active: true,
  taxProfile: "",
  stateExempt: false,
  contactRole: "",
  contactWhatsapp: true,
  streetNumber: "",
  complement: "",
  referenceNote: "",
  ibgeCode: "",
  latitude: "",
  longitude: "",
  locationSource: "",
  locationAccuracyM: "",
  locationConfirmed: false,
  buyerName: "",
  costCenter: "",
  supplyType: "",
  origin: "Cadastro direto",
  serviceNotes: "",
  salesEmail: "",
  invoiceEmail: "",
  website: "",
  externalCustomerCode: "",
  leadTimeDays: "",
  minimumOrder: "0,00",
  freightTerms: "A combinar",
  receivingNotes: "",
  creditLimit: "0,00",
  paymentTerms: "",
  paymentMethod: "",
  negotiationNotes: "",
  contacts: [],
};

// "1.234,56" -> 123456 (centavos). Retorna null quando o texto não é um valor monetário válido.
export function parseBrlToCents(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  if (!/^\d+(?:\.\d{3})*(?:,\d{1,2})?$|^\d+(?:,\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(value) || value > 999_999_999) return null;
  return Math.round(value * 100);
}

export function formatCentsToBrlInput(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Aceita vírgula. Zero é um valor válido (0,0). Vazio retorna null.
export function parseCoordinate(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return Number.NaN;
  return Number(trimmed);
}

export interface CoordinateState {
  empty: boolean;
  valid: boolean;
  latitude: number | null;
  longitude: number | null;
}

export function coordinateState(latitude: string, longitude: string): CoordinateState {
  const lat = parseCoordinate(latitude);
  const lon = parseCoordinate(longitude);
  if (lat === null && lon === null) return { empty: true, valid: false, latitude: null, longitude: null };
  const valid = lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  return { empty: false, valid, latitude: valid ? lat : null, longitude: valid ? lon : null };
}

export function mapsUrl(form: Pick<SupplierInput, "latitude" | "longitude" | "address" | "streetNumber" | "neighborhood" | "city" | "state" | "cep">): string {
  const coords = coordinateState(form.latitude, form.longitude);
  const query =
    coords.valid && coords.latitude !== null && coords.longitude !== null
      ? `${coords.latitude},${coords.longitude}`
      : [form.address, form.streetNumber, form.neighborhood, form.city, form.state, form.cep].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function supplierMapsUrl(supplier: Supplier): string {
  return mapsUrl({
    latitude: supplier.latitude === null ? "" : String(supplier.latitude),
    longitude: supplier.longitude === null ? "" : String(supplier.longitude),
    address: supplier.address,
    streetNumber: supplier.streetNumber,
    neighborhood: supplier.neighborhood,
    city: supplier.city,
    state: supplier.state,
    cep: supplier.cep,
  });
}

export type SupplierFormErrors = Partial<Record<keyof SupplierInput | "location", string>>;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface ValidationContext {
  isCreate: boolean;
  // Valores já gravados, para tolerar legado (campos que nunca foram preenchidos não bloqueiam a edição).
  existing?: Pick<Supplier, "cnpj" | "state" | "city" | "address" | "streetNumber"> | null;
}

// Espelha as regras do servidor (create_supplier/update_supplier). O servidor é a autoridade; isto só evita ida e volta.
export function validateSupplierForm(form: SupplierInput, context: ValidationContext): SupplierFormErrors {
  const errors: SupplierFormErrors = {};
  const legacy = context.existing;
  const mustHave = (field: "cnpj" | "state" | "city" | "address" | "streetNumber") =>
    context.isCreate || (legacy ? legacy[field].trim() !== "" : true);

  if (!form.tradeName.trim()) errors.tradeName = "Informe o nome do fornecedor.";
  if (!form.companyName.trim()) errors.companyName = form.personType === "PJ" ? "Informe a razão social." : "Informe o nome completo.";
  if (!form.cnpj.trim() && mustHave("cnpj")) errors.cnpj = "Informe o documento.";
  if (!form.state.trim() && mustHave("state")) errors.state = "Selecione o estado.";
  if (!form.city.trim() && mustHave("city")) errors.city = "Informe o município.";
  if (!form.address.trim() && mustHave("address")) errors.address = "Informe o logradouro.";
  if (!form.streetNumber.trim() && mustHave("streetNumber")) errors.streetNumber = "Informe o número ou S/N.";

  const doc = normalizeDocument(form.cnpj);
  const documentChanged = context.isCreate || !legacy || normalizeDocument(legacy.cnpj) !== doc;
  if (doc && documentChanged) {
    if (form.personType === "PJ" && !/^[A-Z0-9]{12}\d{2}$/.test(doc)) errors.cnpj = "O CNPJ deve conter 14 posições, com os dois últimos caracteres numéricos.";
    if (form.personType === "PF" && !/^\d{11}$/.test(doc)) errors.cnpj = "O CPF deve conter 11 números.";
  }

  if (form.state && !/^[A-Z]{2}$/.test(form.state)) errors.state = "UF inválida.";
  if (form.cep.trim() && form.cep.replace(/\D/g, "").length !== 8) errors.cep = "Informe um CEP de 8 números ou deixe vazio.";
  if (form.ibgeCode && !/^\d{7}$/.test(form.ibgeCode)) errors.ibgeCode = "Código IBGE com 7 dígitos.";
  for (const field of ["email", "salesEmail", "invoiceEmail"] as const) {
    if (form[field].trim() && !EMAIL.test(form[field].trim())) errors[field] = "Confira o formato do e-mail.";
  }
  if (form.website.trim() && !/^https?:\/\//i.test(form.website.trim())) errors.website = "Informe o site com http:// ou https://.";

  const coords = coordinateState(form.latitude, form.longitude);
  if (!coords.empty && !coords.valid) errors.latitude = "Latitude e longitude devem ser informadas juntas, entre -90 e 90 e entre -180 e 180.";
  else if (coords.valid && !form.locationConfirmed) errors.location = "Confira a localização no mapa e marque a confirmação do ponto.";

  if (form.leadTimeDays.trim() && !/^\d{1,3}$/.test(form.leadTimeDays.trim())) errors.leadTimeDays = "Prazo de entrega em dias (0 a 365).";
  else if (form.leadTimeDays.trim() && Number(form.leadTimeDays) > 365) errors.leadTimeDays = "Prazo de entrega em dias (0 a 365).";
  if (parseBrlToCents(form.minimumOrder) === null) errors.minimumOrder = "Confira o pedido mínimo, usando vírgula para centavos.";
  if (parseBrlToCents(form.creditLimit) === null) errors.creditLimit = "Informe um limite válido, maior ou igual a zero, usando vírgula para centavos.";
  return errors;
}

// Payload snake_case das RPCs create_supplier / update_supplier / convert_candidate_to_supplier.
export function toSupplierPayload(form: SupplierInput): Record<string, unknown> {
  const coords = coordinateState(form.latitude, form.longitude);
  return {
    name: form.name,
    company_name: form.companyName,
    phone: form.phone,
    trade_name: form.tradeName,
    cnpj: form.cnpj,
    ie: form.stateExempt ? "" : form.ie,
    email: form.email,
    address: form.address,
    neighborhood: form.neighborhood,
    cep: form.cep,
    city: form.city,
    state: form.state,
    person_type: form.personType,
    active: form.active,
    tax_profile: form.taxProfile,
    state_exempt: form.stateExempt,
    contact_role: form.contactRole,
    contact_whatsapp: form.contactWhatsapp,
    street_number: form.streetNumber,
    complement: form.complement,
    reference_note: form.referenceNote,
    ibge_code: form.ibgeCode,
    latitude: coords.valid ? coords.latitude : null,
    longitude: coords.valid ? coords.longitude : null,
    location_source: coords.valid ? form.locationSource || "MANUAL" : null,
    location_accuracy_m: coords.valid && form.locationAccuracyM ? form.locationAccuracyM : null,
    location_confirmed: coords.valid && form.locationConfirmed,
    buyer_name: form.buyerName,
    cost_center: form.costCenter,
    supply_type: form.supplyType,
    origin: form.origin,
    service_notes: form.serviceNotes,
    sales_email: form.salesEmail,
    invoice_email: form.invoiceEmail,
    website: form.website,
    external_customer_code: form.externalCustomerCode,
    lead_time_days: form.leadTimeDays.trim() === "" ? null : Number(form.leadTimeDays),
    minimum_order_cents: parseBrlToCents(form.minimumOrder) ?? 0,
    freight_terms: form.freightTerms,
    receiving_notes: form.receivingNotes,
    credit_limit_cents: parseBrlToCents(form.creditLimit) ?? 0,
    payment_terms: form.paymentTerms,
    payment_method: form.paymentMethod,
    negotiation_notes: form.negotiationNotes,
    contacts: form.contacts,
  };
}

export function supplierToForm(supplier: Supplier, contacts: SupplierInput["contacts"] = []): SupplierInput {
  return {
    name: supplier.name,
    companyName: supplier.companyName,
    phone: supplier.phone,
    tradeName: supplier.tradeName,
    cnpj: supplier.cnpj,
    ie: supplier.ie,
    email: supplier.email,
    address: supplier.address,
    neighborhood: supplier.neighborhood,
    cep: supplier.cep,
    city: supplier.city,
    state: supplier.state,
    personType: supplier.personType,
    active: supplier.active,
    taxProfile: supplier.taxProfile,
    stateExempt: supplier.stateExempt,
    contactRole: supplier.contactRole,
    contactWhatsapp: supplier.contactWhatsapp,
    streetNumber: supplier.streetNumber,
    complement: supplier.complement,
    referenceNote: supplier.referenceNote,
    ibgeCode: supplier.ibgeCode,
    latitude: supplier.latitude === null ? "" : String(supplier.latitude),
    longitude: supplier.longitude === null ? "" : String(supplier.longitude),
    locationSource: supplier.locationSource ?? "",
    locationAccuracyM: supplier.locationAccuracyM === null ? "" : String(supplier.locationAccuracyM),
    locationConfirmed: supplier.locationConfirmedAt !== null,
    buyerName: supplier.buyerName,
    costCenter: supplier.costCenter,
    supplyType: supplier.supplyType,
    origin: supplier.origin || "Cadastro direto",
    serviceNotes: supplier.serviceNotes,
    salesEmail: supplier.salesEmail,
    invoiceEmail: supplier.invoiceEmail,
    website: supplier.website,
    externalCustomerCode: supplier.externalCustomerCode,
    leadTimeDays: supplier.leadTimeDays === null ? "" : String(supplier.leadTimeDays),
    minimumOrder: formatCentsToBrlInput(supplier.minimumOrderCents),
    freightTerms: supplier.freightTerms || "A combinar",
    receivingNotes: supplier.receivingNotes,
    creditLimit: formatCentsToBrlInput(supplier.creditLimitCents),
    paymentTerms: supplier.paymentTerms,
    paymentMethod: supplier.paymentMethod,
    negotiationNotes: supplier.negotiationNotes,
    contacts,
  };
}

export interface QualityItem {
  label: string;
  done: boolean;
}

// Indicador de preenchimento do cadastro (não é aprovação fiscal nem de crédito).
export function registrationQuality(form: SupplierInput): { percent: number; items: QualityItem[] } {
  const items: QualityItem[] = [
    { label: "Nome e razão social", done: Boolean(form.tradeName.trim() && form.companyName.trim()) },
    { label: "Documento informado", done: Boolean(normalizeDocument(form.cnpj)) },
    { label: "Contato principal", done: Boolean(form.name.trim() && (form.phone.trim() || form.email.trim())) },
    { label: "Endereço completo", done: Boolean(form.address.trim() && form.streetNumber.trim() && form.city.trim() && form.state.trim()) },
    { label: "Ponto no mapa conferido", done: coordinateState(form.latitude, form.longitude).valid && form.locationConfirmed },
    { label: "Comprador responsável", done: Boolean(form.buyerName.trim()) },
    { label: "Condições de pagamento", done: Boolean(form.paymentTerms) },
  ];
  return { percent: Math.round((items.filter((item) => item.done).length / items.length) * 100), items };
}

// Chave de campos que mudam o endereço/ponto: o servidor invalida a confirmação quando qualquer um muda.
export function addressFingerprint(form: Pick<SupplierInput, "address" | "streetNumber" | "neighborhood" | "complement" | "city" | "state" | "cep" | "latitude" | "longitude">): string {
  return [form.address, form.streetNumber, form.neighborhood, form.complement, form.city, form.state, form.cep, form.latitude, form.longitude]
    .map((part) => part.trim())
    .join("|");
}
