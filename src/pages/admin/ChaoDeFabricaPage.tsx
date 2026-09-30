import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCatalogStore } from "@/store/catalog-store";
import { useEmployeesStore } from "@/store/employees-store";
import { useFloorStore } from "@/store/floor-store";
import type { FloorExecution } from "@/types/production-floor";

// Paleta consistente com o Produziu Registra (PRODUZIU_REGISTRA_REFERENCIA_VISUAL_V4_R2.html)
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
  tag: "inline-block px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#edf4ff] text-[#1767d8]",
  input: "w-full rounded-[10px] border border-[#dce4ef] px-3 py-3 text-[#172e50] bg-white",
};

function Card({ children }: { children: ReactNode }) {
  return <div className={c.card}>{children}</div>;
}

export function ChaoDeFabricaPage() {
  const products = useCatalogStore((s) => s.products);
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const executions = useFloorStore((s) => s.executions);
  const fetchAll = useFloorStore((s) => s.fetchAll);
  const assumeExecution = useFloorStore((s) => s.assumeExecution);
  const advanceQuantity = useFloorStore((s) => s.advanceQuantity);
  const completeExecution = useFloorStore((s) => s.completeExecution);
  const subscribeRealtime = useFloorStore((s) => s.subscribeRealtime);
  const unsubscribeRealtime = useFloorStore((s) => s.unsubscribeRealtime);

  const [assumeFor, setAssumeFor] = useState<string | null>(null);
  const [advanceQty, setAdvanceQty] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchCatalog();
    fetchEmployees();
    fetchAll();
    subscribeRealtime();
    return () => unsubscribeRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const eligible = useMemo(() => employees.filter((e) => e.status === "ATIVO" && e.canOperateProduction), [employees]);
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const available = executions.filter((e) => e.status === "DISPONIVEL");
  const inProgress = executions.filter((e) => e.status === "EM_ANDAMENTO" || e.status === "PAUSADO");
  const done = executions.filter((e) => e.status === "CONCLUIDO");

  function renderItem(exec: FloorExecution) {
    const product = productById.get(exec.productId);
    return (
      <Card key={exec.id}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold">{product?.name ?? "Produto"}</h3>
            <small style={{ color: c.muted }}>
              Rota {exec.routeVersionLabel} · Alvo {exec.targetQuantity} un
            </small>
          </div>
          <span className={c.tag}>{exec.status.replace("_", " ")}</span>
        </div>

        {exec.status !== "DISPONIVEL" && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf0f5]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, (exec.operationalQuantity / exec.targetQuantity) * 100)}%`, background: c.blue }}
            />
          </div>
        )}
        {exec.status !== "DISPONIVEL" && (
          <p className="mt-1 text-sm" style={{ color: c.muted }}>
            {exec.operationalQuantity} de {exec.targetQuantity} un ·{" "}
            {exec.assumedByEmployeeId ? employeeById.get(exec.assumedByEmployeeId)?.name : "—"}
          </p>
        )}

        {exec.status === "DISPONIVEL" &&
          (assumeFor === exec.id ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <select
                className={c.input}
                defaultValue=""
                onChange={(ev) => {
                  if (!ev.target.value) return;
                  void assumeExecution(exec.id, ev.target.value);
                  setAssumeFor(null);
                }}
              >
                <option value="" disabled>
                  Quem vai assumir?
                </option>
                {eligible.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setAssumeFor(null)} className={`${c.btn} ${c.btnGhost}`}>
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setAssumeFor(exec.id)} className={`${c.btn} ${c.btnPrimary} w-full mt-3`}>
              Assumir execução
            </button>
          ))}

        {exec.status === "EM_ANDAMENTO" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              value={advanceQty[exec.id] ?? ""}
              onChange={(ev) => setAdvanceQty((prev) => ({ ...prev, [exec.id]: Number(ev.target.value) }))}
              placeholder="Quantidade"
              className={`${c.input} w-32`}
            />
            <button
              type="button"
              onClick={() => {
                const delta = advanceQty[exec.id];
                if (delta > 0) {
                  void advanceQuantity(exec.id, delta);
                  setAdvanceQty((prev) => ({ ...prev, [exec.id]: 0 }));
                }
              }}
              className={`${c.btn} ${c.btnSecondary}`}
            >
              Avançar quantidade
            </button>
            <button type="button" onClick={() => void completeExecution(exec.id)} className={`${c.btn} ${c.btnPrimary}`}>
              Concluir execução
            </button>
          </div>
        )}

        {exec.status === "CONCLUIDO" && (
          <p className="mt-2 text-sm" style={{ color: c.muted }}>
            {exec.productionRecordId ? "Já fechada no Produziu Registra." : "Aguardando fechamento no Produziu Registra."}
          </p>
        )}
      </Card>
    );
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: c.bg, color: c.navy, fontFamily: "system-ui,-apple-system,Segoe UI,sans-serif" }}>
      <header className="bg-white border-b flex items-center gap-4 px-6 py-5" style={{ borderColor: c.line }}>
        <Link to="/admin" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-black/5" style={{ color: c.navy }}>
          <ArrowLeft size={18} /> Voltar
        </Link>
        <div className="border-l pl-4 font-bold" style={{ borderColor: c.line }}>
          Chão de Fábrica
          <small className="block font-normal text-xs" style={{ color: c.muted }}>
            Saboriza · Execução (MVP)
          </small>
        </div>
        <div className="flex-1" />
        <Link to="/admin/produzir" className={`${c.btn} ${c.btnSecondary}`}>
          Produziu Registra
        </Link>
      </header>

      <main className="mx-auto max-w-[1120px] px-6 pb-[60px] pt-8">
        <div className="text-[11px] font-extrabold tracking-[1.4px] text-[#1767d8] uppercase">EXECUÇÃO, MEDIÇÃO E CONTEXTO</div>
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#172e50] mt-1 mb-2">Chão de Fábrica</h1>
        <p className="mb-3" style={{ color: c.muted }}>
          Liberações viram trabalho aqui. Assumir, avançar e concluir não movimentam estoque — quem fecha o produto acabado é o Produziu Registra.
        </p>

        {available.length === 0 && inProgress.length === 0 && done.length === 0 && (
          <Card>
            <p style={{ color: c.muted }}>Nenhum trabalho no Chão ainda. Libere produção pelo Produziu Registra.</p>
          </Card>
        )}

        {available.length > 0 && (
          <>
            <h2 className="mb-3 text-lg font-bold">Disponível</h2>
            {available.map(renderItem)}
          </>
        )}

        {inProgress.length > 0 && (
          <>
            <h2 className="mb-3 mt-2 text-lg font-bold">Em andamento</h2>
            {inProgress.map(renderItem)}
          </>
        )}

        {done.length > 0 && (
          <>
            <h2 className="mb-3 mt-2 text-lg font-bold">Concluído operacionalmente</h2>
            {done.map(renderItem)}
          </>
        )}
      </main>
    </div>
  );
}
