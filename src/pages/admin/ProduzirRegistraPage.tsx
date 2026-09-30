import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useCatalogStore } from "@/store/catalog-store";
import { useEmployeesStore } from "@/store/employees-store";
import { useFloorStore } from "@/store/floor-store";
import { useProductionStore } from "@/store/production-store";
import { useProductionV3Store } from "@/store/production-v3-store";
import { useRawMaterialsStore } from "@/store/raw-materials-store";
import { DIARY_GRADES, OCCURRENCE_TYPES, type OccurrenceType } from "@/types/production-v3";
import type { Product } from "@/types/product";

// Paleta fiel ao HTML aprovado: PRODUZIU_REGISTRA_REFERENCIA_VISUAL_V3.html
const c = {
  blue: "#1767d8",
  navy: "#172e50",
  muted: "#728096",
  line: "#e4eaf2",
  bg: "#f4f7fb",
  card: "rounded-[19px] border border-[#e4eaf2] bg-white p-6 mb-5 shadow-[0_4px_15px_#142f5903]",
  btn: "px-[19px] py-3 rounded-[11px] font-semibold inline-flex gap-2 items-center justify-center",
  btnPrimary: "bg-[#1767d8] text-white hover:bg-[#0e52b4]",
  btnSecondary: "bg-[#edf4ff] text-[#1767d8]",
  btnGhost: "bg-white border border-[#e4eaf2] text-[#172e50]",
  btnDanger: "bg-[#fff1f1] text-[#b34141]",
  notice: "bg-[#edf4ff] border border-[#dceaff] rounded-xl p-3.5 text-sm text-[#40618f]",
  noticeWarn: "bg-[#fffaed] border border-[#f2e4bc] rounded-xl p-3.5 text-sm text-[#876b2e]",
  tag: "inline-block px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#edf4ff] text-[#1767d8]",
  input: "w-full rounded-[10px] border border-[#dce4ef] px-3 py-3 text-[#172e50] bg-white",
};

function Card({ children }: { children: ReactNode }) {
  return <div className={c.card}>{children}</div>;
}

function Eyebrow({ kicker, title, sub }: { kicker: string; title: string; sub: string }) {
  return (
    <>
      <div className="text-[11px] font-extrabold tracking-[1.4px] text-[#1767d8] uppercase">{kicker}</div>
      <h1 className="text-[28px] font-extrabold tracking-tight text-[#172e50] mt-1 mb-2">{title}</h1>
      <p className="text-[#728096] mb-3">{sub}</p>
    </>
  );
}

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

type Page = "home" | "liberar" | "confirmar" | "urgent" | "diary" | "produced" | "results";

export function ProduzirRegistraPage() {
  const products = useCatalogStore((s) => s.products);
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);
  const fetchMaterials = useRawMaterialsStore((s) => s.fetchMaterials);
  const records = useProductionStore((s) => s.records);
  const fetchRecords = useProductionStore((s) => s.fetchRecords);
  const confirmProductionRelease = useProductionStore((s) => s.confirmProductionRelease);
  const refreshAfterProduction = useProductionStore((s) => s.refreshAfterProduction);
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const urgentDemands = useProductionV3Store((s) => s.urgentDemands);
  const fetchUrgentDemands = useProductionV3Store((s) => s.fetchUrgentDemands);
  const createUrgentDemand = useProductionV3Store((s) => s.createUrgentDemand);
  const diary = useProductionV3Store((s) => s.diary);
  const ensureTodayDiary = useProductionV3Store((s) => s.ensureTodayDiary);
  const evaluations = useProductionV3Store((s) => s.evaluations);
  const occurrences = useProductionV3Store((s) => s.occurrences);
  const activities = useProductionV3Store((s) => s.activities);
  const saveEvaluation = useProductionV3Store((s) => s.saveEvaluation);
  const addOccurrence = useProductionV3Store((s) => s.addOccurrence);
  const addOtherActivity = useProductionV3Store((s) => s.addOtherActivity);
  const closeDiary = useProductionV3Store((s) => s.closeDiary);
  const reopenDiary = useProductionV3Store((s) => s.reopenDiary);
  const floorExecutions = useFloorStore((s) => s.executions);
  const createRelease = useFloorStore((s) => s.createRelease);
  const fetchFloorAll = useFloorStore((s) => s.fetchAll);

  const [page, setPage] = useState<Page>("home");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [urgentTab, setUrgentTab] = useState<"Ativos" | "Concluídos">("Ativos");
  const [period, setPeriod] = useState<"Hoje" | "Semana">("Hoje");
  const [evalEmployee, setEvalEmployee] = useState<string | null>(null);
  const [showUrgentForm, setShowUrgentForm] = useState(false);
  const [showOccForm, setShowOccForm] = useState(false);
  const [showActForm, setShowActForm] = useState(false);
  const [confirmProductId, setConfirmProductId] = useState<string | null>(null);

  const eligible = useMemo(() => employees.filter((e) => e.status === "ATIVO" && e.canOperateProduction), [employees]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  useEffect(() => {
    fetchCatalog();
    fetchMaterials();
    fetchRecords();
    fetchEmployees();
    fetchUrgentDemands();
    fetchFloorAll();
    ensureTodayDiary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(next: Page) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleLiberarProducao(
    productId: string,
    packs: number,
    reason: string,
    note: string,
    urgentDemandId: string | null,
    idempotencyKey: string
  ) {
    setSaving(true);
    const ok = await createRelease(productId, packs, reason, note, urgentDemandId, idempotencyKey);
    setSaving(false);
    if (ok) go("home");
  }

  async function handleConfirmarProducao(
    productId: string,
    packs: number,
    urgentDemandId: string | null,
    floorExecutionId: string | null,
    idempotencyKey: string
  ) {
    setSaving(true);
    const { error } = await confirmProductionRelease(productId, packs, urgentDemandId, floorExecutionId, idempotencyKey);
    if (error) {
      toast.error(`Falha ao confirmar produção: ${error}`);
      setSaving(false);
      return;
    }
    await refreshAfterProduction([productId]);
    await fetchUrgentDemands();
    await fetchFloorAll();
    setSaving(false);
    setConfirmProductId(null);
    toast.success("Produção confirmada! Estoque atualizado.");
    go("produced");
  }

  const lowStock = products.filter((p) => p.active && p.currentStock < p.minStock);

  const todayRecords = useMemo(() => {
    const today = new Date().toDateString();
    return records.filter((r) => new Date(r.confirmedAt).toDateString() === today && r.status !== "reversed");
  }, [records]);
  const periodRecords = period === "Hoje" ? todayRecords : records.filter((r) => r.status !== "reversed");
  const periodTotal = periodRecords.reduce((sum, r) => sum + r.unitsQuantity, 0);

  const monthRecords = useMemo(() => {
    const now = new Date();
    return records.filter((r) => {
      const d = new Date(r.confirmedAt);
      return r.status !== "reversed" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [records]);
  const monthTotal = monthRecords.reduce((s, r) => s + r.unitsQuantity, 0);
  const productRanking = useMemo(() => {
    const map = new Map<string, number>();
    monthRecords.forEach((r) => map.set(r.productId, (map.get(r.productId) ?? 0) + r.unitsQuantity));
    return [...map.entries()].map(([productId, qty]) => ({ product: productById.get(productId), qty })).sort((a, b) => b.qty - a.qty);
  }, [monthRecords, productById]);

  const activeUrgents = urgentDemands.filter((u) => (urgentTab === "Ativos" ? u.status === "ATIVO" : u.status === "CONCLUIDO"));

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: c.bg, color: c.navy, fontFamily: "system-ui,-apple-system,Segoe UI,sans-serif" }}>
      <header className="bg-white border-b flex items-center gap-4 px-6 py-5" style={{ borderColor: c.line }}>
        <Link
          to="/admin"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-black/5"
          style={{ color: c.navy }}
          aria-label="Voltar ao painel administrativo"
        >
          <ArrowLeft size={18} /> Voltar
        </Link>
        <button type="button" onClick={() => go("home")} className="text-2xl font-extrabold tracking-tight" style={{ color: c.blue }}>
          Óris<span style={{ color: c.navy }}>360</span>
        </button>
        <div className="border-l pl-4 font-bold" style={{ borderColor: c.line }}>
          Produziu Registra
          <small className="block font-normal text-xs" style={{ color: c.muted }}>
            Saboriza · Fábrica
          </small>
        </div>
        <div className="flex-1" />
        <span className="grid h-[43px] w-[43px] place-items-center rounded-full font-bold" style={{ background: "#eaf2ff", color: c.blue }}>
          {(employees[0]?.name ?? "AD").slice(0, 2).toUpperCase()}
        </span>
      </header>

      <main className="mx-auto max-w-[1120px] px-6 pb-[110px] pt-8">
        {page === "home" && (
          <>
            <Eyebrow kicker="JUNTOS, A GENTE FAZ ACONTECER" title="Bora fazer a diferença?" sub="Cada produção registrada valoriza o trabalho da nossa equipe." />
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button type="button" onClick={() => go("urgent")} className="flex items-center gap-4 rounded-2xl border bg-white p-5 text-left hover:border-[#98bdf4]" style={{ borderColor: c.line }}>
                <div>
                  <b>Urgentes</b>
                  <br />
                  <small style={{ color: c.muted }}>{urgentDemands.filter((u) => u.status === "ATIVO").length} demandas ativas</small>
                </div>
              </button>
              <button type="button" onClick={() => go("produced")} className="flex items-center gap-4 rounded-2xl border bg-white p-5 text-left hover:border-[#98bdf4]" style={{ borderColor: c.line }}>
                <div>
                  <b>Produzido</b>
                  <br />
                  <small style={{ color: c.muted }}>Veja o que já fizemos</small>
                </div>
              </button>
              <button type="button" onClick={() => go("results")} className="flex items-center gap-4 rounded-2xl border bg-white p-5 text-left hover:border-[#98bdf4]" style={{ borderColor: c.line }}>
                <div>
                  <b>Nossos Resultados</b>
                  <br />
                  <small style={{ color: c.muted }}>Nossa evolução juntos</small>
                </div>
              </button>
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <Card>
                  <div className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: c.blue }}>
                    LIBERAR PRODUÇÃO
                  </div>
                  <h2 className="mt-2 mb-1 text-xl font-bold">O que precisa ir pro Chão?</h2>
                  <p style={{ color: c.muted }}>Libera o trabalho pra fábrica. Não mexe em estoque ainda.</p>
                  <button type="button" onClick={() => go("liberar")} className={`${c.btn} ${c.btnPrimary} w-full mt-2`}>
                    Liberar Produção
                  </button>
                </Card>
                <div className={c.notice}>
                  <Link to="/admin/chao-de-fabrica" className="font-bold hover:underline" style={{ color: c.blue }}>
                    Ver Chão de Fábrica →
                  </Link>{" "}
                  Acompanhe quem assumiu, quanto já avançou e o que está pronto pra confirmar.
                </div>
              </div>
              <Card>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">QR/código</h2>
                  <span className={c.tag}>AGORA</span>
                </div>
                <p className="mt-3" style={{ color: c.muted }}>
                  {lowStock.length} produto(s) abaixo do estoque mínimo. Feche o produto acabado aqui.
                </p>
                <button type="button" onClick={() => go("confirmar")} className={`${c.btn} ${c.btnPrimary} w-full mt-2`}>
                  Confirmar Produção
                </button>
              </Card>
            </div>
          </>
        )}

        {page === "liberar" && (
          <LiberarProducaoView
            products={products}
            query={query}
            setQuery={setQuery}
            urgentDemands={urgentDemands}
            saving={saving}
            onSubmit={handleLiberarProducao}
          />
        )}

        {page === "confirmar" && (
          <ConfirmarProducaoView
            products={products}
            query={query}
            setQuery={setQuery}
            urgentDemands={urgentDemands}
            floorExecutions={floorExecutions}
            confirmProductId={confirmProductId}
            setConfirmProductId={setConfirmProductId}
            saving={saving}
            onConfirm={handleConfirmarProducao}
          />
        )}

        {page === "urgent" && (
          <>
            <Eyebrow kicker="DEMANDAS EXTRAORDINÁRIAS" title="Urgentes" sub="Prioridades cadastradas pela gestão. Uma produção, um registro." />
            <div className="mb-4 flex items-center justify-between">
              <div className="flex max-w-[300px] gap-1 rounded-xl bg-[#edf1f7] p-1">
                {(["Ativos", "Concluídos"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setUrgentTab(t)} className={`flex-1 rounded-lg py-2 text-sm font-bold ${urgentTab === t ? "bg-white shadow" : ""}`} style={{ color: urgentTab === t ? c.blue : c.navy }}>
                    {t}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setShowUrgentForm((v) => !v)} className={`${c.btn} ${c.btnSecondary}`}>
                + Nova demanda
              </button>
            </div>
            {showUrgentForm && (
              <Card>
                <NewUrgentForm
                  products={products}
                  onCreate={async (productId, name, qty) => {
                    const ok = await createUrgentDemand(productId, name, qty);
                    if (ok) setShowUrgentForm(false);
                  }}
                />
              </Card>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeUrgents.map((u) => {
                const pct = Math.min(100, Math.round((u.doneQuantity / u.totalQuantity) * 100));
                return (
                  <Card key={u.id}>
                    <span className={c.tag} style={{ background: u.status === "ATIVO" ? "#fff3dd" : "#e9f7ef", color: u.status === "ATIVO" ? "#956216" : "#288258" }}>
                      {u.status === "ATIVO" ? "EM ANDAMENTO" : "CONCLUÍDO"}
                    </span>
                    <h2 className="mt-2 mb-1 text-lg font-bold">{u.name}</h2>
                    <p style={{ color: c.muted }}>{productById.get(u.productId)?.name}</p>
                    <div className="my-2 h-2 overflow-hidden rounded-full bg-[#edf0f5]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.blue }} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>
                        Solicitado
                        <h3 className="font-bold">{fmt(u.totalQuantity)}</h3>
                      </span>
                      <span>
                        Produzido
                        <h3 className="font-bold">{fmt(u.doneQuantity)}</h3>
                      </span>
                    </div>
                    <p className="mt-2">
                      <b>{fmt(u.totalQuantity - u.doneQuantity)} un</b> <span style={{ color: c.muted }}>pendentes</span>
                    </p>
                    {u.status === "ATIVO" && (
                      <button type="button" onClick={() => go("liberar")} className={`${c.btn} ${c.btnSecondary} w-full mt-2`}>
                        Liberar produção
                      </button>
                    )}
                  </Card>
                );
              })}
              {activeUrgents.length === 0 && <p style={{ color: c.muted }}>Nenhuma demanda nesta aba.</p>}
            </div>
          </>
        )}

        {page === "diary" && (
          <>
            <Eyebrow kicker="CONTEXTO DA EQUIPE" title="Diário da Produção" sub="Acompanhe o trabalho, valorize as pessoas e registre o que importa." />
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <b>{evaluations.length} de {eligible.length} pessoas avaliadas</b>
                  <br />
                  <small style={{ color: c.muted }}>{new Date().toLocaleDateString("pt-BR")} · Fábrica</small>
                </div>
                <span className={c.tag} style={{ background: diary?.status === "CONCLUIDO" ? "#e9f7ef" : undefined, color: diary?.status === "CONCLUIDO" ? "#288258" : undefined }}>
                  {diary?.status === "CONCLUIDO" ? "DIÁRIO CONCLUÍDO" : "EM ACOMPANHAMENTO"}
                </span>
              </div>
            </Card>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div>
                <Card>
                  <h2 className="mb-3 text-lg font-bold">Nossa equipe hoje</h2>
                  {eligible.map((emp) => {
                    const evalRow = evaluations.find((e) => e.employeeId === emp.id);
                    return (
                      <div key={emp.id} className="my-2 flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: c.line }}>
                        <span className="grid h-8.5 w-8.5 place-items-center rounded-full font-bold" style={{ background: "#edf3fd", color: c.blue }}>
                          {emp.name[0]}
                        </span>
                        <div className="flex-1">
                          <b>{emp.name}</b>
                          <br />
                          <small style={{ color: c.muted }}>{evalRow ? "Avaliação salva" : "Avaliação pendente"}</small>
                        </div>
                        <button type="button" onClick={() => setEvalEmployee(emp.id)} className={`${c.btn} ${c.btnSecondary}`}>
                          {evalRow ? "Revisar" : "Avaliar"}
                        </button>
                      </div>
                    );
                  })}
                </Card>
                <Card>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-bold">Ocorrências</h2>
                    <button type="button" onClick={() => setShowOccForm((v) => !v)} className={`${c.btn} ${c.btnGhost}`}>
                      Adicionar
                    </button>
                  </div>
                  {showOccForm && <OccurrenceForm employees={eligible} onSave={async (id, type, text) => { await addOccurrence(id, type, text); setShowOccForm(false); }} />}
                  {occurrences.map((o) => (
                    <div key={o.id} className="border-b py-2" style={{ borderColor: c.line }}>
                      <span className={c.tag}>{o.occurrenceType}</span> <b>{employeeById.get(o.employeeId)?.name}</b>
                      <p className="mt-1">{o.description}</p>
                    </div>
                  ))}
                  {occurrences.length === 0 && <p style={{ color: c.muted }}>Nenhuma ocorrência registrada.</p>}
                </Card>
              </div>
              <div>
                <Card>
                  <h2 className="mb-3 text-lg font-bold">Outras atividades</h2>
                  {activities.map((a) => (
                    <div key={a.id} className="border-b py-2" style={{ borderColor: c.line }}>
                      <b>{employeeById.get(a.employeeId)?.name}</b>
                      <br />
                      <span>{a.activity}</span>
                      {a.period && <small className="block" style={{ color: c.muted }}>{a.period}</small>}
                    </div>
                  ))}
                  {activities.length === 0 && <p style={{ color: c.muted }}>Atividades informadas ao retirar participantes aparecem aqui.</p>}
                  {showActForm ? (
                    <ActivityForm employees={eligible} onSave={async (id, act, period) => { await addOtherActivity(id, act, period); setShowActForm(false); }} />
                  ) : (
                    <button type="button" onClick={() => setShowActForm(true)} className={`${c.btn} ${c.btnSecondary} w-full mt-2`}>
                      Registrar atividade
                    </button>
                  )}
                </Card>
                <Card>
                  <h2 className="mb-2 text-lg font-bold">Fechar o acompanhamento</h2>
                  <p style={{ color: c.muted }}>O fechamento reúne o dia. Novas produções continuam permitidas.</p>
                  <button
                    type="button"
                    onClick={() => (diary?.status === "CONCLUIDO" ? reopenDiary() : closeDiary(""))}
                    className={`${c.btn} ${c.btnPrimary} w-full mt-2`}
                  >
                    {diary?.status === "CONCLUIDO" ? "Reabrir diário" : "Concluir Diário"}
                  </button>
                </Card>
              </div>
            </div>
            {evalEmployee && (
              <EvaluationModal
                name={employeeById.get(evalEmployee)?.name ?? ""}
                existing={evaluations.find((e) => e.employeeId === evalEmployee)}
                onClose={() => setEvalEmployee(null)}
                onSave={async (pace, quality, commitment, note) => {
                  await saveEvaluation(evalEmployee, pace, quality, commitment, note);
                  setEvalEmployee(null);
                }}
              />
            )}
          </>
        )}

        {page === "produced" && (
          <>
            <Eyebrow kicker="TRABALHO REALIZADO" title="Produzido" sub="Cada registro faz parte da nossa história." />
            <div className="mb-4 flex max-w-[330px] gap-1 rounded-xl bg-[#edf1f7] p-1">
              {(["Hoje", "Semana"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setPeriod(t)} className={`flex-1 rounded-lg py-2 text-sm font-bold ${period === t ? "bg-white shadow" : ""}`} style={{ color: period === t ? c.blue : c.navy }}>
                  {t}
                </button>
              ))}
            </div>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card>
                <small style={{ color: c.muted }}>Unidades produzidas</small>
                <div className="text-3xl font-extrabold">{fmt(periodTotal)}</div>
                <span className={c.tag}>{period.toUpperCase()}</span>
              </Card>
              <Card>
                <small style={{ color: c.muted }}>Registros confirmados</small>
                <div className="text-3xl font-extrabold">{periodRecords.length}</div>
              </Card>
              <Card>
                <small style={{ color: c.muted }}>Produtos diferentes</small>
                <div className="text-3xl font-extrabold">{new Set(periodRecords.map((r) => r.productId)).size}</div>
              </Card>
            </div>
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">Registros {period === "Hoje" ? "de hoje" : "da semana"}</h2>
                <button type="button" onClick={() => go("liberar")} className={`${c.btn} ${c.btnSecondary}`}>
                  Nova produção
                </button>
              </div>
              {periodRecords.length === 0 ? (
                <p style={{ color: c.muted }}>Vamos registrar a primeira produção?</p>
              ) : (
                [...periodRecords].reverse().map((r) => (
                  <div key={r.id} className="border-b py-3" style={{ borderColor: c.line }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <b>{productById.get(r.productId)?.name}</b>{" "}
                        <span className={c.tag} style={{ background: r.status === "reversed" ? "#fff0ef" : "#e9f7ef", color: r.status === "reversed" ? "#b44840" : "#288258" }}>
                          {r.status === "reversed" ? "ESTORNADO" : "CONFIRMADO"}
                        </span>
                        <br />
                        <small style={{ color: c.muted }}>{new Date(r.confirmedAt).toLocaleString("pt-BR")}</small>
                      </div>
                      <b>{fmt(r.unitsQuantity)} un</b>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </>
        )}

        {page === "results" && (
          <>
            <Eyebrow kicker="NOSSA EVOLUÇÃO" title="Nossos Resultados" sub="O resultado de uma equipe que produz junto." />
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card>
                <small style={{ color: c.muted }}>Produção do mês</small>
                <div className="text-3xl font-extrabold">{fmt(monthTotal)}</div>
              </Card>
              <Card>
                <small style={{ color: c.muted }}>Registros no mês</small>
                <div className="text-3xl font-extrabold">{monthRecords.length}</div>
              </Card>
              <Card>
                <small style={{ color: c.muted }}>Produtos diferentes</small>
                <div className="text-3xl font-extrabold">{productRanking.length}</div>
              </Card>
            </div>
            <Card>
              <h2 className="mb-3 text-lg font-bold">Produtos mais produzidos</h2>
              {productRanking.map(({ product, qty }) => (
                <div key={product?.id} className="flex justify-between border-b py-2" style={{ borderColor: c.line }}>
                  {product ? (
                    <Link to={`/admin/produtos/${product.id}`} className="hover:underline" style={{ color: c.blue }}>
                      {product.name}
                    </Link>
                  ) : (
                    <span>-----</span>
                  )}
                  <b>{fmt(qty)} un</b>
                </div>
              ))}
              {productRanking.length === 0 && <p style={{ color: c.muted }}>Nenhuma produção registrada neste mês.</p>}
            </Card>
            <Card>
              <h2 className="mb-3 text-lg font-bold">Necessidade atual de estoque</h2>
              {products.filter((p) => p.active && p.currentStock < p.minStock).map((p) => (
                <div key={p.id} className="border-b py-2" style={{ borderColor: c.line }}>
                  <div className="flex justify-between">
                    <span>{p.name}</span>
                    <b>{fmt(Math.max(0, p.minStock - p.currentStock))} un pendentes</b>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#edf0f5]">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (p.currentStock / (p.minStock || 1)) * 100)}%`, background: c.blue }} />
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-center gap-2 border-t bg-white/95 px-4 py-2.5 backdrop-blur" style={{ borderColor: c.line }}>
        {([
          ["liberar", "Liberar Produção"],
          ["diary", "Diário"],
          ["produced", "Produzido"],
          ["results", "Resultados"],
        ] as [Page, string][]).map(([p, label]) => (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            className="w-[150px] rounded-xl py-2 text-xs font-semibold"
            style={{ background: page === p ? "#eaf3ff" : "transparent", color: page === p ? c.blue : c.muted }}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function LiberarProducaoView({
  products,
  query,
  setQuery,
  urgentDemands,
  saving,
  onSubmit,
}: {
  products: Product[];
  query: string;
  setQuery: (v: string) => void;
  urgentDemands: { id: string; productId: string; name: string; totalQuantity: number; doneQuantity: number; status: string }[];
  saving: boolean;
  onSubmit: (productId: string, packs: number, reason: string, note: string, urgentDemandId: string | null, idempotencyKey: string) => void;
}) {
  const [productId, setProductId] = useState<string | null>(null);
  const [packs, setPacks] = useState(1);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [urgentId, setUrgentId] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const filtered = products.filter((p) => p.active && (p.name + p.code).toLowerCase().includes(query.toLowerCase()));
  const selected = products.find((p) => p.id === productId) ?? null;
  const urgentOptions = selected ? urgentDemands.filter((u) => u.productId === selected.id && u.status === "ATIVO") : [];

  return (
    <>
      <Eyebrow kicker="LIBERAR PRODUÇÃO" title="Abastece o Chão de Fábrica." sub="Sem participantes, sem rateio. Efeito de estoque = zero." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="mb-3 text-lg font-bold">Qual item produtivo?</h2>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome ou código do produto" className={c.input} />
          <div className="mt-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProductId(p.id)}
                className="flex w-full items-center justify-between border-b py-3 text-left"
                style={{ borderColor: c.line }}
              >
                <div>
                  <h3 className="font-bold">{p.name}</h3>
                  <small style={{ color: c.muted }}>{p.code}</small>
                </div>
                {productId === p.id && <span className={c.tag}>SELECIONADO</span>}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-bold">Detalhes da liberação</h2>
          {!selected ? (
            <p style={{ color: c.muted }}>Selecione um item produtivo ao lado.</p>
          ) : (
            <>
              <p className="mb-2">
                <b>{selected.name}</b>
              </p>
              <label className="mb-1 block text-xs font-bold">Quantidade (packs)</label>
              <input type="number" min={1} value={packs} onChange={(e) => setPacks(Math.max(1, Number(e.target.value)))} className={`${c.input} mb-3`} />
              <label className="mb-1 block text-xs font-bold">Motivo</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: reposição de estoque" className={`${c.input} mb-3`} />
              <label className="mb-1 block text-xs font-bold">Observação (opcional)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} className={`${c.input} mb-3 min-h-[70px]`} />
              {urgentOptions.length > 0 && (
                <>
                  <label className="mb-1 block text-xs font-bold">Vincular a urgente (opcional)</label>
                  <select value={urgentId} onChange={(e) => setUrgentId(e.target.value)} className={`${c.input} mb-3`}>
                    <option value="">Sem vínculo</option>
                    {urgentOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · faltam {u.totalQuantity - u.doneQuantity}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => onSubmit(selected.id, packs, reason, note, urgentId || null, idempotencyKey)}
                className={`${c.btn} ${c.btnPrimary} w-full mt-1`}
              >
                {saving ? "Liberando..." : "Liberar Produção"}
              </button>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

function ConfirmarProducaoView({
  products,
  query,
  setQuery,
  urgentDemands,
  floorExecutions,
  confirmProductId,
  setConfirmProductId,
  saving,
  onConfirm,
}: {
  products: Product[];
  query: string;
  setQuery: (v: string) => void;
  urgentDemands: { id: string; productId: string; name: string; totalQuantity: number; doneQuantity: number; status: string }[];
  floorExecutions: { id: string; productId: string; status: string; targetQuantity: number; operationalQuantity: number; productionRecordId: string | null }[];
  confirmProductId: string | null;
  setConfirmProductId: (v: string | null) => void;
  saving: boolean;
  onConfirm: (productId: string, packs: number, urgentDemandId: string | null, floorExecutionId: string | null, idempotencyKey: string) => void;
}) {
  const [packs, setPacks] = useState(1);
  const [urgentId, setUrgentId] = useState("");
  const [floorExecutionId, setFloorExecutionId] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const filtered = products.filter((p) => p.active && (p.name + p.code).toLowerCase().includes(query.toLowerCase()));
  const selected = products.find((p) => p.id === confirmProductId) ?? null;
  const urgentOptions = selected ? urgentDemands.filter((u) => u.productId === selected.id && u.status === "ATIVO") : [];
  const readyExecutions = selected
    ? floorExecutions.filter((e) => e.productId === selected.id && e.status === "CONCLUIDO" && !e.productionRecordId)
    : [];

  return (
    <>
      <Eyebrow kicker="QR/CÓDIGO" title="Fecha o produto acabado." sub="Confirmação oficial: entra no estoque uma única vez." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="mb-3 text-lg font-bold">Encontrar produto</h2>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome ou código do produto" className={c.input} />
          <div className="mt-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setConfirmProductId(p.id)}
                className="flex w-full items-center justify-between border-b py-3 text-left"
                style={{ borderColor: c.line }}
              >
                <div>
                  <h3 className="font-bold">{p.name}</h3>
                  <small style={{ color: c.muted }}>{p.code}</small>
                </div>
                {confirmProductId === p.id && <span className={c.tag}>SELECIONADO</span>}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-bold">Confirmar Produção</h2>
          {!selected ? (
            <p style={{ color: c.muted }}>Selecione um produto ao lado.</p>
          ) : (
            <>
              <p className="mb-2">
                <b>{selected.name}</b>
              </p>
              {readyExecutions.length > 0 && (
                <>
                  <label className="mb-1 block text-xs font-bold">Vincular execução do Chão (opcional)</label>
                  <select
                    value={floorExecutionId}
                    onChange={(e) => {
                      setFloorExecutionId(e.target.value);
                      const exec = readyExecutions.find((x) => x.id === e.target.value);
                      if (exec && selected.packQuantity > 0) {
                        setPacks(Math.max(1, Math.floor(exec.operationalQuantity / selected.packQuantity)));
                      }
                    }}
                    className={`${c.input} mb-3`}
                  >
                    <option value="">Sem vínculo</option>
                    {readyExecutions.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.operationalQuantity}/{e.targetQuantity} un concluídas
                      </option>
                    ))}
                  </select>
                </>
              )}
              <label className="mb-1 block text-xs font-bold">Quantidade (packs)</label>
              <input
                type="number"
                min={1}
                value={packs}
                disabled={!!floorExecutionId}
                onChange={(e) => setPacks(Math.max(1, Number(e.target.value)))}
                className={`${c.input} mb-1`}
              />
              {floorExecutionId &&
                (() => {
                  const exec = readyExecutions.find((x) => x.id === floorExecutionId);
                  if (!exec) return null;
                  const remainder = exec.operationalQuantity % selected.packQuantity;
                  return (
                    <p className="mb-3 text-xs" style={{ color: c.muted }}>
                      {exec.operationalQuantity} un produzidas no Chão ÷ {selected.packQuantity} un/pack = {packs} pack(s)
                      {remainder > 0 ? ` + ${remainder} un de sobra (não vira pack fictício)` : ""}.
                    </p>
                  );
                })()}
              {urgentOptions.length > 0 && (
                <>
                  <label className="mb-1 block text-xs font-bold">Apropriar em urgente (opcional)</label>
                  <select value={urgentId} onChange={(e) => setUrgentId(e.target.value)} className={`${c.input} mb-3`}>
                    <option value="">Sem vínculo</option>
                    {urgentOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · faltam {u.totalQuantity - u.doneQuantity}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => onConfirm(selected.id, packs, urgentId || null, floorExecutionId || null, idempotencyKey)}
                className={`${c.btn} ${c.btnPrimary} w-full mt-1`}
              >
                {saving ? "Confirmando..." : "Confirmar Produção"}
              </button>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

function NewUrgentForm({
  products,
  onCreate,
}: {
  products: { id: string; name: string }[];
  onCreate: (productId: string, name: string, qty: number) => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [name, setName] = useState("");
  const [qty, setQty] = useState(100);
  return (
    <div className="flex flex-col gap-3">
      <select value={productId} onChange={(e) => setProductId(e.target.value)} className={c.input}>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input placeholder="Nome da demanda (ex: Pedido especial · Cliente X)" value={name} onChange={(e) => setName(e.target.value)} className={c.input} />
      <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={c.input} />
      <button type="button" onClick={() => onCreate(productId, name, qty)} className={`${c.btn} ${c.btnPrimary}`}>
        Criar demanda
      </button>
    </div>
  );
}

function OccurrenceForm({ employees, onSave }: { employees: { id: string; name: string }[]; onSave: (id: string, type: OccurrenceType, text: string) => void }) {
  const [id, setId] = useState(employees[0]?.id ?? "");
  const [type, setType] = useState<OccurrenceType>(OCCURRENCE_TYPES[0]);
  const [text, setText] = useState("");
  return (
    <div className="mb-3 flex flex-col gap-2">
      <select value={id} onChange={(e) => setId(e.target.value)} className={c.input}>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <select value={type} onChange={(e) => setType(e.target.value as OccurrenceType)} className={c.input}>
        {OCCURRENCE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <textarea value={text} onChange={(e) => setText(e.target.value)} className={`${c.input} min-h-[80px]`} placeholder="Relato" />
      <button type="button" onClick={() => onSave(id, type, text)} className={`${c.btn} ${c.btnPrimary}`}>
        Salvar ocorrência
      </button>
    </div>
  );
}

function ActivityForm({ employees, onSave }: { employees: { id: string; name: string }[]; onSave: (id: string, activity: string, period: string) => void }) {
  const [id, setId] = useState(employees[0]?.id ?? "");
  const [activity, setActivity] = useState("");
  const [period, setPeriod] = useState("");
  return (
    <div className="mt-2 flex flex-col gap-2">
      <select value={id} onChange={(e) => setId(e.target.value)} className={c.input}>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <input placeholder="Atividade realizada" value={activity} onChange={(e) => setActivity(e.target.value)} className={c.input} />
      <input placeholder="Período (opcional)" value={period} onChange={(e) => setPeriod(e.target.value)} className={c.input} />
      <button type="button" onClick={() => onSave(id, activity, period)} className={`${c.btn} ${c.btnPrimary}`}>
        Salvar atividade
      </button>
    </div>
  );
}

function EvaluationModal({
  name,
  existing,
  onClose,
  onSave,
}: {
  name: string;
  existing?: { paceGrade: string; qualityGrade: string; commitmentGrade: string; note: string };
  onClose: () => void;
  onSave: (pace: string, quality: string, commitment: string, note: string) => void;
}) {
  const [pace, setPace] = useState(existing?.paceGrade ?? "");
  const [quality, setQuality] = useState(existing?.qualityGrade ?? "");
  const [commitment, setCommitment] = useState(existing?.commitmentGrade ?? "");
  const [note, setNote] = useState(existing?.note ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#12274277] p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <h2 className="mb-3 text-lg font-bold">Avaliação · {name}</h2>
        {[
          ["Ritmo de trabalho", pace, setPace],
          ["Qualidade e cuidado", quality, setQuality],
          ["Comprometimento", commitment, setCommitment],
        ].map(([label, value, setter]) => (
          <div key={label as string} className="mb-3">
            <label className="mb-1 block text-xs font-bold">{label as string}</label>
            <select value={value as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} className={c.input}>
              <option value="">Selecionar</option>
              {DIARY_GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        ))}
        <label className="mb-1 block text-xs font-bold">Observação (opcional)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} className={`${c.input} min-h-[70px]`} />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${c.btn} ${c.btnGhost}`}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              if (!pace || !quality || !commitment) {
                toast.error("Selecione os três critérios");
                return;
              }
              onSave(pace, quality, commitment, note);
            }}
            className={`${c.btn} ${c.btnPrimary}`}
          >
            Salvar e Próximo
          </button>
        </div>
      </div>
    </div>
  );
}
