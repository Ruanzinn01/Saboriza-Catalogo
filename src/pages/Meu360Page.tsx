import { useEffect, useMemo, useState } from "react";
import { useMeu360Store } from "@/store/meu360-store";

const c = {
  blue: "#1767d8",
  navy: "#172e50",
  muted: "#728096",
  line: "#e4eaf2",
  bg: "#f4f7fb",
};

export function Meu360Page() {
  const step = useMeu360Store((s) => s.step);
  const init = useMeu360Store((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto" style={{ background: c.bg, color: c.navy, fontFamily: "system-ui,-apple-system,Segoe UI,sans-serif" }}>
      <header className="bg-white border-b px-6 py-5" style={{ borderColor: c.line }}>
        <h1 className="text-xl font-extrabold" style={{ color: c.blue }}>
          Meu 360
        </h1>
        <p className="text-xs" style={{ color: c.muted }}>
          Sua sessão pessoal no Chão de Fábrica
        </p>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-8">
        {step === "no-device" && <NoDevice />}
        {step === "matricula" && <Matricula />}
        {step === "pin" && <Pin />}
        {step === "sessao" && <Sessao />}
      </main>
    </div>
  );
}

function NoDevice() {
  return (
    <div className="rounded-2xl border bg-white p-6 text-center" style={{ borderColor: c.line }}>
      <p className="font-bold">Este dispositivo ainda não está pareado.</p>
      <p className="mt-2 text-sm" style={{ color: c.muted }}>
        Pareie primeiro pelo Terminal de Ponto (mesma credencial de dispositivo é reaproveitada aqui) e volte a esta tela.
      </p>
    </div>
  );
}

function Matricula() {
  const employeeCode = useMeu360Store((s) => s.employeeCode);
  const setEmployeeCode = useMeu360Store((s) => s.setEmployeeCode);
  const submitEmployeeCode = useMeu360Store((s) => s.submitEmployeeCode);
  const busy = useMeu360Store((s) => s.busy);
  const error = useMeu360Store((s) => s.error);

  return (
    <div className="rounded-2xl border bg-white p-6" style={{ borderColor: c.line }}>
      <p className="mb-3 font-bold">Sua matrícula</p>
      <input
        value={employeeCode}
        onChange={(e) => setEmployeeCode(e.target.value)}
        inputMode="numeric"
        placeholder="Matrícula"
        className="w-full rounded-xl border px-4 py-4 text-center text-2xl tracking-widest"
        style={{ borderColor: c.line }}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={busy || !employeeCode}
        onClick={() => void submitEmployeeCode()}
        className="mt-4 w-full rounded-xl py-3 font-semibold text-white disabled:opacity-50"
        style={{ background: c.blue }}
      >
        {busy ? "Verificando..." : "Continuar"}
      </button>
    </div>
  );
}

function Pin() {
  const employeeFirstName = useMeu360Store((s) => s.employeeFirstName);
  const pin = useMeu360Store((s) => s.pin);
  const setPin = useMeu360Store((s) => s.setPin);
  const submitPin = useMeu360Store((s) => s.submitPin);
  const busy = useMeu360Store((s) => s.busy);
  const error = useMeu360Store((s) => s.error);

  return (
    <div className="rounded-2xl border bg-white p-6" style={{ borderColor: c.line }}>
      <p className="mb-3 font-bold">Oi, {employeeFirstName}. Seu PIN?</p>
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        type="password"
        placeholder="PIN"
        className="w-full rounded-xl border px-4 py-4 text-center text-2xl tracking-[0.5em]"
        style={{ borderColor: c.line }}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={busy || pin.length < 4}
        onClick={() => void submitPin()}
        className="mt-4 w-full rounded-xl py-3 font-semibold text-white disabled:opacity-50"
        style={{ background: c.blue }}
      >
        {busy ? "Entrando..." : "Entrar"}
      </button>
    </div>
  );
}

function Sessao() {
  const executions = useMeu360Store((s) => s.executions);
  const products = useMeu360Store((s) => s.products);
  const employeeFirstName = useMeu360Store((s) => s.employeeFirstName);
  const employeeId = useMeu360Store((s) => s.employeeId);
  const assumir = useMeu360Store((s) => s.assumir);
  const avancar = useMeu360Store((s) => s.avancar);
  const concluir = useMeu360Store((s) => s.concluir);
  const logout = useMeu360Store((s) => s.logout);
  const busy = useMeu360Store((s) => s.busy);
  const [qty, setQty] = useState<Record<string, number>>({});

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const mine = executions.filter((e) => e.assumedByEmployeeId === employeeId);
  const available = executions.filter((e) => e.status === "DISPONIVEL");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="font-bold">Oi, {employeeFirstName}</p>
        <button type="button" onClick={logout} className="text-sm underline" style={{ color: c.muted }}>
          Sair
        </button>
      </div>

      {mine.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase" style={{ color: c.muted }}>
            Sua execução
          </p>
          {mine.map((e) => (
            <div key={e.id} className="mb-2 rounded-2xl border bg-white p-4" style={{ borderColor: c.line }}>
              <p className="font-bold">{productById.get(e.productId)?.name ?? "Produto"}</p>
              <p className="text-sm" style={{ color: c.muted }}>
                {e.operationalQuantity}/{e.targetQuantity} un · {e.routeVersionLabel}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={qty[e.id] ?? ""}
                  onChange={(ev) => setQty((prev) => ({ ...prev, [e.id]: Number(ev.target.value) }))}
                  placeholder="Qtd"
                  className="w-20 rounded-lg border px-2 py-2 text-sm"
                  style={{ borderColor: c.line }}
                />
                <button
                  type="button"
                  disabled={busy || !qty[e.id]}
                  onClick={() => void avancar(e.id, qty[e.id])}
                  className="rounded-lg px-3 py-2 text-sm font-semibold"
                  style={{ background: "#edf4ff", color: c.blue }}
                >
                  Avançar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void concluir(e.id)}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-white"
                  style={{ background: c.blue }}
                >
                  Concluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase" style={{ color: c.muted }}>
          Disponível pra assumir
        </p>
        {available.length === 0 ? (
          <p className="text-sm" style={{ color: c.muted }}>
            Nada disponível agora.
          </p>
        ) : (
          available.map((e) => (
            <div key={e.id} className="mb-2 flex items-center justify-between rounded-2xl border bg-white p-4" style={{ borderColor: c.line }}>
              <div>
                <p className="font-bold">{productById.get(e.productId)?.name ?? "Produto"}</p>
                <p className="text-sm" style={{ color: c.muted }}>
                  Alvo {e.targetQuantity} un
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void assumir(e.id)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-white"
                style={{ background: c.blue }}
              >
                Assumir
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
