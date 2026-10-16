import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { AdminState } from "@/components/admin/AdminState";
import { Pagination } from "@/components/admin/Pagination";
import { SupplierCategoryPicker } from "@/components/admin/fornecedores/SupplierCategoryPicker";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { daysSince, parseProductLabels, SUPPLIER_PAGE_SIZES } from "@/lib/supplier-search";
import { useSupplierCandidatesStore } from "@/store/supplier-candidates-store";
import { useSupplierCategoriesStore } from "@/store/supplier-categories-store";
import { CANDIDATE_STAGE_LABELS, type CandidateContact, type CandidateInput, type CandidateStage, type SupplierCandidate } from "@/types/supplier";

type EditableStage = Exclude<CandidateStage, "CADASTRADO">;
const EDITABLE_STAGES: EditableStage[] = ["EM_ESTUDO", "EM_CONTATO", "EM_COTACAO", "NAO_SELECIONADO"];

const emptyForm = {
  tradeName: "",
  legalName: "",
  contactName: "",
  phone: "",
  email: "",
  city: "",
  state: "",
  website: "",
  ownerName: "",
  origin: "",
  notes: "",
  stage: "EM_ESTUDO" as EditableStage,
  nextContactOn: "",
  productsText: "",
  categoryIds: [] as string[],
};

type FormState = typeof emptyForm;

function formFromCandidate(candidate: SupplierCandidate): FormState {
  return {
    tradeName: candidate.tradeName,
    legalName: candidate.legalName,
    contactName: candidate.contactName,
    phone: candidate.phone,
    email: candidate.email,
    city: candidate.city,
    state: candidate.state,
    website: candidate.website,
    ownerName: candidate.ownerName,
    origin: candidate.origin,
    notes: candidate.notes,
    stage: candidate.stage === "CADASTRADO" ? "EM_ESTUDO" : candidate.stage,
    nextContactOn: candidate.nextContactOn ?? "",
    productsText: candidate.products.join(", "),
    categoryIds: candidate.categoryIds,
  };
}

function toInput(form: FormState): CandidateInput {
  return {
    tradeName: form.tradeName.trim(),
    legalName: form.legalName.trim(),
    contactName: form.contactName.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    city: form.city.trim(),
    state: form.state.trim().toUpperCase(),
    website: form.website.trim(),
    ownerName: form.ownerName.trim(),
    origin: form.origin.trim(),
    notes: form.notes.trim(),
    stage: form.stage,
    nextContactOn: form.nextContactOn,
    products: parseProductLabels(form.productsText),
    categoryIds: form.categoryIds,
  };
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function SupplierCandidatesTab() {
  const candidates = useSupplierCandidatesStore((state) => state.candidates);
  const total = useSupplierCandidatesStore((state) => state.total);
  const status = useSupplierCandidatesStore((state) => state.status);
  const search = useSupplierCandidatesStore((state) => state.search);
  const register = useSupplierCandidatesStore((state) => state.register);
  const update = useSupplierCandidatesStore((state) => state.update);
  const recordContact = useSupplierCandidatesStore((state) => state.recordContact);
  const listContacts = useSupplierCandidatesStore((state) => state.listContacts);
  const categories = useSupplierCategoriesStore((state) => state.categories);
  const categoriesStatus = useSupplierCategoriesStore((state) => state.status);
  const fetchCategories = useSupplierCategoriesStore((state) => state.fetchAll);

  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<SupplierCandidate | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [contactFor, setContactFor] = useState<SupplierCandidate | null>(null);
  const [contactForm, setContactForm] = useState({ note: "", contactedOn: "", nextContactOn: "", stage: "" });
  const [history, setHistory] = useState<CandidateContact[]>([]);

  useEffect(() => {
    if (categoriesStatus === "idle") void fetchCategories();
  }, [categoriesStatus, fetchCategories]);

  const reload = useCallback(() => {
    void search({ query, stage, categoryId, page, pageSize });
  }, [search, query, stage, categoryId, page, pageSize]);

  useEffect(() => {
    const handle = window.setTimeout(reload, 250);
    return () => window.clearTimeout(handle);
  }, [reload]);

  function openForm(candidate: SupplierCandidate | "new") {
    setEditing(candidate);
    setForm(candidate === "new" ? emptyForm : formFromCandidate(candidate));
    setFormError("");
    setContactFor(null);
  }

  async function openContact(candidate: SupplierCandidate) {
    setContactFor(candidate);
    setEditing(null);
    setContactForm({ note: "", contactedOn: new Date().toISOString().slice(0, 10), nextContactOn: candidate.nextContactOn ?? "", stage: "" });
    setHistory(await listContacts(candidate.id));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.tradeName.trim()) {
      setFormError("Informe o nome da empresa");
      return;
    }
    setSaving(true);
    const input = toInput(form);
    const ok = editing && editing !== "new" ? await update(editing.id, editing.revision, input) : await register(input);
    setSaving(false);
    if (!ok) return;
    setEditing(null);
    reload();
  }

  async function handleContact(event: FormEvent) {
    event.preventDefault();
    if (!contactFor) return;
    setSaving(true);
    const ok = await recordContact(contactFor.id, contactForm.note, contactForm.contactedOn, contactForm.nextContactOn, contactForm.stage);
    setSaving(false);
    if (!ok) return;
    setContactFor(null);
    reload();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const categoryName = (id: string) => categories.find((item) => item.id === id)?.name ?? "";

  const selectClass = "h-11 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700";

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-forest-950/10 bg-forest-950/5 p-4 text-sm text-ink-700">
        Possíveis fornecedores ficam separados da carteira: não entram na contagem de fornecedores, compras, dívidas ou limites. Os produtos listados são informação
        declarada e não criam produto nem estoque.
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            aria-label="Buscar possível fornecedor"
            placeholder="Buscar por empresa, produto (farinha, granola...), contato ou categoria"
            className="h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          />
        </div>
        <select
          value={stage}
          aria-label="Filtrar por situação"
          onChange={(e) => {
            setStage(e.target.value);
            setPage(1);
          }}
          className={selectClass}
        >
          <option value="">Todas as situações</option>
          {(Object.keys(CANDIDATE_STAGE_LABELS) as CandidateStage[]).map((key) => (
            <option key={key} value={key}>
              {CANDIDATE_STAGE_LABELS[key]}
            </option>
          ))}
        </select>
        <select
          value={categoryId}
          aria-label="Filtrar por categoria"
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className={selectClass}
        >
          <option value="">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <Button type="button" onClick={() => openForm("new")} className="w-full lg:w-auto">
          <Plus size={18} /> Registrar possibilidade
        </Button>
      </div>

      {editing && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-4 sm:p-6">
          <p className="text-sm font-extrabold text-forest-950">{editing === "new" ? "Registrar possível fornecedor" : "Editar possível fornecedor"}</p>
          <Input label="Empresa / nome fantasia" value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} error={formError} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Razão social (opcional)" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
            <Input label="Contato (opcional)" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            <Input label="Telefone (opcional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="E-mail (opcional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Cidade (opcional)" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input label="UF (opcional)" maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
            <Input label="Site ou catálogo (opcional)" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            <Input label="Responsável interno (opcional)" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            <Input label="Origem (opcional)" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
            <Input label="Próxima tentativa (opcional)" type="date" value={form.nextContactOn} onChange={(e) => setForm({ ...form, nextContactOn: e.target.value })} />
          </div>
          <Input
            label="Produtos que fornece ou de interesse (separe por vírgula)"
            value={form.productsText}
            placeholder="Ex.: palmito, farinha, granola, coco"
            onChange={(e) => setForm({ ...form, productsText: e.target.value })}
          />
          <SupplierCategoryPicker value={form.categoryIds} onChange={(ids) => setForm({ ...form, categoryIds: ids })} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink-900">Situação</span>
            <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as EditableStage })} className={selectClass}>
              {EDITABLE_STAGES.map((key) => (
                <option key={key} value={key}>
                  {CANDIDATE_STAGE_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink-900">Notas (opcional)</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="rounded-xl border border-ink-900/15 bg-white px-4 py-3 text-sm text-ink-900 outline-none focus:border-forest-700"
            />
          </label>
          <div className="flex gap-3">
            <Button type="submit" variant="secondary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {contactFor && (
        <form onSubmit={handleContact} className="flex flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-4 sm:p-6">
          <p className="text-sm font-extrabold text-forest-950">Registrar contato com {contactFor.tradeName}</p>
          <p className="text-xs text-ink-muted">
            Primeiro registro em {formatDate(contactFor.firstRegisteredAt)}. Novos contatos acrescentam histórico e não alteram essa data.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input label="Data do contato" type="date" value={contactForm.contactedOn} onChange={(e) => setContactForm({ ...contactForm, contactedOn: e.target.value })} />
            <Input label="Próxima tentativa" type="date" value={contactForm.nextContactOn} onChange={(e) => setContactForm({ ...contactForm, nextContactOn: e.target.value })} />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink-900">Nova situação</span>
              <select value={contactForm.stage} onChange={(e) => setContactForm({ ...contactForm, stage: e.target.value })} className={selectClass}>
                <option value="">Manter a atual</option>
                {EDITABLE_STAGES.map((key) => (
                  <option key={key} value={key}>
                    {CANDIDATE_STAGE_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink-900">O que foi tratado</span>
            <textarea
              value={contactForm.note}
              onChange={(e) => setContactForm({ ...contactForm, note: e.target.value })}
              rows={3}
              className="rounded-xl border border-ink-900/15 bg-white px-4 py-3 text-sm text-ink-900 outline-none focus:border-forest-700"
            />
          </label>
          <div className="flex gap-3">
            <Button type="submit" variant="secondary" disabled={saving}>
              {saving ? "Salvando..." : "Registrar contato"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setContactFor(null)}>
              Cancelar
            </Button>
          </div>
          {history.length > 0 && (
            <ul className="flex flex-col divide-y divide-forest-950/5 border-t border-forest-950/10 pt-2">
              {history.map((item) => (
                <li key={item.id} className="py-2 text-sm">
                  <span className="font-semibold text-ink-900">{formatDate(item.contactedOn)}</span>{" "}
                  <span className="text-ink-700/70">{item.kind === "CONVERSAO" ? "Cadastro como fornecedor" : "Contato"}</span>
                  {item.note && <p className="text-ink-700">{item.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </form>
      )}

      {status === "loading" && candidates.length === 0 ? (
        <AdminState variant="loading" message="Carregando possíveis fornecedores..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar os possíveis fornecedores." onRetry={reload} />
      ) : candidates.length === 0 ? (
        <AdminState variant="empty" message={query || stage || categoryId ? "Nenhuma possibilidade encontrada com esse filtro." : "Nenhum possível fornecedor registrado ainda."} />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-forest-950/10 bg-white">
          <ul className="flex flex-col divide-y divide-forest-950/5">
            {candidates.map((candidate) => (
              <li key={candidate.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-base font-extrabold text-forest-950">{candidate.tradeName}</p>
                  <p className="text-xs text-ink-muted">
                    {[candidate.legalName, candidate.contactName, [candidate.city, candidate.state].filter(Boolean).join("/")].filter(Boolean).join(" · ") || "Sem dados de contato"}
                  </p>
                  {candidate.products.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {candidate.products.map((product) => (
                        <span key={product} className="rounded-full bg-gold-400/20 px-2.5 py-1 text-xs font-semibold text-forest-950">
                          {product}
                        </span>
                      ))}
                    </div>
                  )}
                  {candidate.categoryIds.length > 0 && (
                    <p className="mt-1 text-xs text-ink-700/70">{candidate.categoryIds.map(categoryName).filter(Boolean).join(" · ")}</p>
                  )}
                  <p className="mt-1 text-xs text-ink-muted">
                    {CANDIDATE_STAGE_LABELS[candidate.stage]} · registrada há {daysSince(candidate.firstRegisteredAt)} dia(s) ({formatDate(candidate.firstRegisteredAt)})
                    {candidate.lastContactOn ? ` · último contato ${formatDate(candidate.lastContactOn)}` : ""}
                    {candidate.nextContactOn ? ` · próxima tentativa ${formatDate(candidate.nextContactOn)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {candidate.stage === "CADASTRADO" ? (
                    candidate.linkedSupplierId && (
                      <Link to={`/admin/fornecedores/${candidate.linkedSupplierId}`}>
                        <Button type="button" variant="outline" size="sm" className="min-h-11">
                          Ver fornecedor
                        </Button>
                      </Link>
                    )
                  ) : (
                    <>
                      <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => openForm(candidate)}>
                        Editar
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void openContact(candidate)}>
                        Registrar contato
                      </Button>
                      <Link to={`/admin/fornecedores/novo?candidato=${candidate.id}`}>
                        <Button type="button" variant="secondary" size="sm" className="min-h-11">
                          Cadastrar como fornecedor
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={SUPPLIER_PAGE_SIZES}
            total={total}
            itemLabel="possibilidades"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
