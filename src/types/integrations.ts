export type IntegrationProvider = "ASAAS" | "FISCAL" | "BASE";
export type IntegrationEnvironment = "SANDBOX" | "PRODUCAO";
export type IntegrationStatus = "NAO_CONFIGURADO" | "CONFIGURADO" | "VALIDADO" | "ERRO";

export interface IntegrationCredential {
  id: string;
  provider: IntegrationProvider;
  environment: IntegrationEnvironment;
  keyLast4: string | null;
  walletId: string | null;
  fiscalProviderName: string | null;
  status: IntegrationStatus;
  isActive: boolean;
  activatedAt: string | null;
  lastValidatedAt: string | null;
  lastError: string | null;
  hasWebhookToken: boolean;
  updatedAt: string;
}

export interface IntegrationEvent {
  id: string;
  provider: IntegrationProvider;
  eventType: string;
  environment: IntegrationEnvironment | null;
  receivedAt: string;
  processedAt: string | null;
  processError: string | null;
}

export type ConnectionErrorKind = "CREDENTIAL" | "CONNECTION";

export type EnvironmentState = "NAO_CONFIGURADO" | "CHAVE_SALVA" | "CONEXAO_VALIDA" | "ATIVO" | "ERRO_CREDENCIAL";
