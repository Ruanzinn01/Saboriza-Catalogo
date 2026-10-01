export type IntegrationProvider = "ASAAS" | "FISCAL";
export type IntegrationEnvironment = "SANDBOX" | "PRODUCAO";
export type IntegrationStatus = "NAO_CONFIGURADO" | "CONFIGURADO" | "VALIDADO" | "ERRO";

export interface IntegrationCredential {
  id: string;
  companyId: string;
  provider: IntegrationProvider;
  environment: IntegrationEnvironment;
  keyLast4: string | null;
  walletId: string | null;
  fiscalProviderName: string | null;
  webhookToken: string | null;
  status: IntegrationStatus;
  lastValidatedAt: string | null;
  lastError: string | null;
  updatedAt: string;
}
