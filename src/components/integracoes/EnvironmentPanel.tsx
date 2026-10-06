import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useIntegrationsStore } from "@/store/integrations-store";
import type { IntegrationCredential, IntegrationEnvironment } from "@/types/integrations";
import { ConfirmDialog } from "./ConfirmDialog";
import { deriveEnvironmentState, ENVIRONMENT_STATE_LABEL, ENVIRONMENT_STATE_TONE } from "./status";

const ENVIRONMENT_INFO: Record<IntegrationEnvironment, { title: string; description: string }> = {
  SANDBOX: {
    title: "Sandbox",
    description: "Ambiente de testes do Asaas. As cobranças são simuladas e não movimentam dinheiro real.",
  },
  PRODUCAO: {
    title: "Produção",
    description: "Ambiente real. As cobranças geradas pelo Faturar são enviadas aos seus clientes.",
  },
};

const NEXT_STEP: Record<ReturnType<typeof deriveEnvironmentState>, string> = {
  NAO_CONFIGURADO: "Próximo passo: cole a chave de API deste ambiente e salve.",
  CHAVE_SALVA: "Próximo passo: clique em Testar conexão para confirmar que o Asaas aceita a chave.",
  CONEXAO_VALIDA: "Conexão confirmada. Ative este ambiente para o Saboriza passar a usá-lo.",
  ATIVO: "Em uso: o Faturar cria as cobranças neste ambiente.",
  ERRO_CREDENCIAL: "O Asaas recusou esta chave. Gere uma nova chave no painel Asaas e substitua aqui.",
};

interface EnvironmentPanelProps {
  environment: IntegrationEnvironment;
  credential: IntegrationCredential | null;
  canManage: boolean;
  otherEnvironmentActive: boolean;
}

export function EnvironmentPanel({ environment, credential, canManage, otherEnvironmentActive }: EnvironmentPanelProps) {
  const saveCredential = useIntegrationsStore((s) => s.saveCredential);
  const removeCredential = useIntegrationsStore((s) => s.removeCredential);
  const setActiveEnvironment = useIntegrationsStore((s) => s.setActiveEnvironment);
  const testConnection = useIntegrationsStore((s) => s.testConnection);

  const [replacingKey, setReplacingKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [walletId, setWalletId] = useState(credential?.walletId ?? "");
  const [busy, setBusy] = useState<"save" | "test" | "activate" | "pause" | "remove" | null>(null);
  const [confirm, setConfirm] = useState<"activate" | "pause" | "remove" | null>(null);

  const state = deriveEnvironmentState(credential);
  const info = ENVIRONMENT_INFO[environment];
  const showForm = !credential || replacingKey;
  const isProduction = environment === "PRODUCAO";

  async function handleSave() {
    setBusy("save");
    const ok = await saveCredential("ASAAS", environment, apiKey, walletId || null);
    setBusy(null);
    if (ok) {
      setApiKey("");
      setReplacingKey(false);
    }
  }

  async function handleTest() {
    if (!credential) return;
    setBusy("test");
    await testConnection(credential.id);
    setBusy(null);
  }

  async function handleActivate() {
    setBusy("activate");
    const ok = await setActiveEnvironment("ASAAS", environment);
    setBusy(null);
    if (ok) setConfirm(null);
  }

  async function handlePause() {
    setBusy("pause");
    const ok = await setActiveEnvironment("ASAAS", null);
    setBusy(null);
    if (ok) setConfirm(null);
  }

  async function handleRemove() {
    setBusy("remove");
    const ok = await removeCredential("ASAAS", environment);
    setBusy(null);
    if (ok) setConfirm(null);
  }

  const disabled = !canManage || busy !== null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-forest-950/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 font-bold text-forest-950">
            {info.title}
            {credential?.isActive && <span className="rounded-full bg-forest-950 px-2 py-0.5 text-[11px] font-semibold text-cream-50">em uso</span>}
          </h4>
          <p className="mt-1 text-sm text-ink-muted">{info.description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ENVIRONMENT_STATE_TONE[state]}`}>{ENVIRONMENT_STATE_LABEL[state]}</span>
      </div>

      {isProduction && !credential?.isActive && state !== "NAO_CONFIGURADO" && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Atenção: ativar a Produção faz as cobranças reais serem criadas para seus clientes.</p>
      )}

      {credential && !showForm && (
        <dl className="grid grid-cols-1 gap-2 rounded-xl bg-forest-950/5 px-4 py-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-muted">Chave de API</dt>
            <dd className="font-mono">•••• {credential.keyLast4}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Última validação</dt>
            <dd>{credential.lastValidatedAt ? new Date(credential.lastValidatedAt).toLocaleString("pt-BR") : "Ainda não testada"}</dd>
          </div>
          {credential.walletId && (
            <div>
              <dt className="text-xs text-ink-muted">Wallet ID</dt>
              <dd className="font-mono">{credential.walletId}</dd>
            </div>
          )}
        </dl>
      )}

      {credential?.lastError && (
        <p className={`text-xs ${credential.status === "VALIDADO" ? "text-amber-700" : "text-red-700"}`}>
          {credential.status === "VALIDADO" ? "Última tentativa de conexão falhou por instabilidade: " : "Último erro: "}
          {credential.lastError}
        </p>
      )}

      {showForm && (
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor={`key-${environment}`} className="mb-1 block text-xs font-bold">
              Chave de API
            </label>
            <input
              id={`key-${environment}`}
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={!canManage}
              placeholder={credential ? "Cole a nova chave (substitui a atual)" : "Cole a chave de API aqui"}
              className="w-full rounded-lg border border-forest-950/15 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-ink-muted">
              Fica criptografada no Supabase Vault. Depois de salva, só os 4 últimos caracteres aparecem.
            </p>
          </div>
          <div>
            <label htmlFor={`wallet-${environment}`} className="mb-1 block text-xs font-bold">
              Wallet ID (opcional)
            </label>
            <input
              id={`wallet-${environment}`}
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              disabled={!canManage}
              placeholder="ID da carteira usada em repasses"
              className="w-full rounded-lg border border-forest-950/15 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-ink-muted">Hoje é só informativo: nenhum fluxo do Saboriza usa este campo ainda.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={disabled || apiKey.trim().length < 8} onClick={() => void handleSave()}>
              {busy === "save" ? "Salvando..." : "Salvar chave"}
            </Button>
            {replacingKey && (
              <Button size="sm" variant="ghost" onClick={() => setReplacingKey(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}

      {!showForm && (
        <p className="text-xs text-ink-muted">{NEXT_STEP[state]}</p>
      )}

      {credential && !showForm && (
        <div className="flex flex-wrap gap-2">
          {state !== "ATIVO" && (
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => void handleTest()}>
              {busy === "test" ? "Testando..." : "Testar conexão"}
            </Button>
          )}
          {state === "CONEXAO_VALIDA" && (
            <Button size="sm" disabled={disabled} onClick={() => setConfirm("activate")}>
              Ativar este ambiente
            </Button>
          )}
          {state === "ATIVO" && (
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => setConfirm("pause")}>
              Pausar integração
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setReplacingKey(true)}>
            Trocar chave
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            className="text-red-700 hover:bg-red-50"
            onClick={() => setConfirm("remove")}
          >
            Remover
          </Button>
        </div>
      )}

      {!canManage && <p className="text-xs text-ink-muted">Sua permissão atual permite apenas consultar. Peça acesso à gestão de integrações a quem administra a empresa.</p>}

      <ConfirmDialog
        open={confirm === "activate"}
        title={`Ativar ${info.title}?`}
        description={
          <>
            {isProduction
              ? "As próximas cobranças do Faturar serão criadas como reais, para seus clientes. "
              : "As próximas cobranças do Faturar serão criadas no Sandbox, sem dinheiro real. "}
            {otherEnvironmentActive && "O outro ambiente deixará de ser usado automaticamente."}
          </>
        }
        confirmLabel="Ativar"
        busy={busy === "activate"}
        onConfirm={() => void handleActivate()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "pause"}
        title="Pausar integração?"
        description="Nenhuma cobrança será criada no Asaas até um ambiente ser ativado de novo. Cobranças já criadas continuam no Asaas e no histórico."
        confirmLabel="Pausar"
        busy={busy === "pause"}
        onConfirm={() => void handlePause()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "remove"}
        title={`Remover ${info.title}?`}
        danger
        description={
          <>
            <p>Apaga a chave e o token de webhook deste ambiente no Saboriza.</p>
            {credential?.isActive && <p className="mt-2 font-semibold text-red-700">Esta integração está ativa agora. Sem outro ambiente ativo, o Faturar deixa de criar cobranças.</p>}
            <p className="mt-2">Cobranças, pagamentos e notas já registrados são mantidos.</p>
          </>
        }
        confirmLabel="Remover integração"
        busy={busy === "remove"}
        onConfirm={() => void handleRemove()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
