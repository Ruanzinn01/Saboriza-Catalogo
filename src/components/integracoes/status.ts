import type { EnvironmentState, IntegrationCredential } from "@/types/integrations";

export function deriveEnvironmentState(credential: IntegrationCredential | null): EnvironmentState {
  if (!credential) return "NAO_CONFIGURADO";
  if (credential.status === "ERRO") return "ERRO_CREDENCIAL";
  if (credential.status === "CONFIGURADO") return "CHAVE_SALVA";
  return credential.isActive ? "ATIVO" : "CONEXAO_VALIDA";
}

export const ENVIRONMENT_STATE_LABEL: Record<EnvironmentState, string> = {
  NAO_CONFIGURADO: "Não configurado",
  CHAVE_SALVA: "Chave salva — falta testar",
  CONEXAO_VALIDA: "Conexão validada — inativo",
  ATIVO: "Ativo",
  ERRO_CREDENCIAL: "Chave recusada",
};

export const ENVIRONMENT_STATE_TONE: Record<EnvironmentState, string> = {
  NAO_CONFIGURADO: "bg-forest-950/5 text-ink-muted",
  CHAVE_SALVA: "bg-amber-100 text-amber-700",
  CONEXAO_VALIDA: "bg-sky-100 text-sky-700",
  ATIVO: "bg-emerald-100 text-emerald-700",
  ERRO_CREDENCIAL: "bg-red-100 text-red-700",
};
