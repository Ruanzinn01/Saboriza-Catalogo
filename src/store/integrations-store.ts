import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";
import type {
  ConnectionErrorKind,
  IntegrationCredential,
  IntegrationEnvironment,
  IntegrationEvent,
  IntegrationProvider,
  IntegrationStatus,
} from "@/types/integrations";

type CredentialRow = {
  id: string;
  provider: string;
  environment: string;
  key_last4: string | null;
  wallet_id: string | null;
  fiscal_provider_name: string | null;
  status: string;
  is_active: boolean;
  activated_at: string | null;
  last_validated_at: string | null;
  last_error: string | null;
  has_webhook_token: boolean;
  updated_at: string;
};

type EventRow = {
  id: string;
  event_type: string;
  environment: string | null;
  received_at: string;
  processed_at: string | null;
  process_error: string | null;
};

function fromCredentialRow(row: CredentialRow): IntegrationCredential {
  return {
    id: row.id,
    provider: row.provider as IntegrationProvider,
    environment: row.environment as IntegrationEnvironment,
    keyLast4: row.key_last4,
    walletId: row.wallet_id,
    fiscalProviderName: row.fiscal_provider_name,
    status: row.status as IntegrationStatus,
    isActive: row.is_active,
    activatedAt: row.activated_at,
    lastValidatedAt: row.last_validated_at,
    lastError: row.last_error,
    hasWebhookToken: row.has_webhook_token,
    updatedAt: row.updated_at,
  };
}

function fromEventRow(row: EventRow, provider: IntegrationProvider): IntegrationEvent {
  return {
    id: row.id,
    provider,
    eventType: row.event_type,
    environment: row.environment as IntegrationEnvironment | null,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
    processError: row.process_error,
  };
}

const EVENT_PROVIDERS: IntegrationProvider[] = ["ASAAS", "BASE"];

function errorMessage(error: { message?: string } | null, fallback: string) {
  return error?.message ?? fallback;
}

interface ConnectionResult {
  ok: boolean;
  kind?: ConnectionErrorKind;
  error?: string;
}

const TEST_CONNECTION_FUNCTION: Partial<Record<IntegrationProvider, string>> = {
  ASAAS: "asaas-test-connection",
  BASE: "base-test-connection",
};

interface IntegrationsState {
  companyId: string | null;
  credentials: IntegrationCredential[];
  events: IntegrationEvent[];
  canManage: boolean;
  status: "idle" | "loading" | "ready" | "error";
  errorMessage: string | null;
  fetchAll: () => Promise<void>;
  fetchEvents: () => Promise<void>;
  saveCredential: (
    provider: IntegrationProvider,
    environment: IntegrationEnvironment,
    apiKey: string,
    walletId?: string | null,
    fiscalProviderName?: string | null
  ) => Promise<boolean>;
  removeCredential: (provider: IntegrationProvider, environment: IntegrationEnvironment) => Promise<boolean>;
  setActiveEnvironment: (provider: IntegrationProvider, environment: IntegrationEnvironment | null) => Promise<boolean>;
  testConnection: (credentialId: string, provider: IntegrationProvider) => Promise<ConnectionResult>;
  getWebhookToken: (provider: IntegrationProvider, environment: IntegrationEnvironment) => Promise<string | null>;
  rotateWebhookToken: (provider: IntegrationProvider, environment: IntegrationEnvironment) => Promise<string | null>;
}

export const useIntegrationsStore = create<IntegrationsState>()((set, get) => ({
  companyId: null,
  credentials: [],
  events: [],
  canManage: false,
  status: "idle",
  errorMessage: null,

  fetchAll: async () => {
    set({ status: "loading", errorMessage: null });
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) {
      set({ status: "error", errorMessage: "Nenhuma empresa selecionada" });
      return;
    }

    const [listResult, permissionResult] = await Promise.all([
      supabase.rpc("list_integration_credentials", { p_company_id: companyId }),
      supabase.rpc("oris360_has_permission", { p_company_id: companyId, p_permission_key: "financeiro.integracoes.manage" }),
    ]);

    if (listResult.error) {
      set({ companyId, status: "error", errorMessage: errorMessage(listResult.error, "Não foi possível carregar as integrações"), credentials: [] });
      return;
    }

    set({
      companyId,
      canManage: permissionResult.data === true,
      credentials: ((listResult.data as CredentialRow[] | null) ?? []).map(fromCredentialRow),
      status: "ready",
    });
    await get().fetchEvents();
  },

  fetchEvents: async () => {
    const companyId = get().companyId;
    if (!companyId) return;
    const results = await Promise.all(
      EVENT_PROVIDERS.map((provider) => supabase.rpc("list_integration_events", { p_company_id: companyId, p_provider: provider, p_limit: 20 }))
    );
    const events = results.flatMap((result, index) =>
      result.error ? [] : ((result.data as EventRow[] | null) ?? []).map((row) => fromEventRow(row, EVENT_PROVIDERS[index]))
    );
    events.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    set({ events });
  },

  saveCredential: async (provider, environment, apiKey, walletId, fiscalProviderName) => {
    const companyId = get().companyId;
    if (!companyId) return false;
    const { error } = await supabase.rpc("save_integration_credential", {
      p_company_id: companyId,
      p_provider: provider,
      p_environment: environment,
      p_api_key: apiKey,
      p_wallet_id: walletId ?? undefined,
      p_fiscal_provider_name: fiscalProviderName ?? undefined,
    });
    if (error) {
      toast.error(errorMessage(error, "Não foi possível salvar a credencial"));
      return false;
    }
    await get().fetchAll();
    toast.success("Chave salva. Agora teste a conexão para validá-la.");
    return true;
  },

  removeCredential: async (provider, environment) => {
    const companyId = get().companyId;
    if (!companyId) return false;
    const { error } = await supabase.rpc("remove_integration_credential", {
      p_company_id: companyId,
      p_provider: provider,
      p_environment: environment,
    });
    if (error) {
      toast.error(errorMessage(error, "Não foi possível remover a credencial"));
      return false;
    }
    await get().fetchAll();
    toast.success("Integração removida. Cobranças e notas já emitidas foram mantidas.");
    return true;
  },

  setActiveEnvironment: async (provider, environment) => {
    const companyId = get().companyId;
    if (!companyId) return false;
    const { error } = await supabase.rpc("set_active_integration_credential", {
      p_company_id: companyId,
      p_provider: provider,
      p_environment: environment as string,
    });
    if (error) {
      toast.error(errorMessage(error, "Não foi possível alterar o ambiente ativo"));
      return false;
    }
    await get().fetchAll();
    toast.success(environment ? "Ambiente ativo atualizado" : "Integração pausada: nenhuma cobrança será criada até reativar");
    return true;
  },

  testConnection: async (credentialId, provider) => {
    const functionName = TEST_CONNECTION_FUNCTION[provider];
    if (!functionName) {
      toast.error("Este provedor ainda não tem teste de conexão");
      return { ok: false, kind: "CONNECTION", error: "provedor sem teste de conexão" };
    }
    const { data, error } = await supabase.functions.invoke(functionName, { body: { credential_id: credentialId } });
    await get().fetchAll();
    if (error) {
      toast.error("Não foi possível testar a conexão agora. Tente novamente.");
      return { ok: false, kind: "CONNECTION", error: error.message };
    }
    if (!data?.ok) {
      toast.error(data?.error ?? "Falha na conexão");
      return { ok: false, kind: data?.kind, error: data?.error };
    }
    toast.success("Conexão validada");
    return { ok: true };
  },

  getWebhookToken: async (provider, environment) => {
    const companyId = get().companyId;
    if (!companyId) return null;
    const { data, error } = await supabase.rpc("get_integration_webhook_token", {
      p_company_id: companyId,
      p_provider: provider,
      p_environment: environment,
    });
    if (error) {
      toast.error(errorMessage(error, "Não foi possível obter o token do webhook"));
      return null;
    }
    return data as string;
  },

  rotateWebhookToken: async (provider, environment) => {
    const companyId = get().companyId;
    if (!companyId) return null;
    const { data, error } = await supabase.rpc("rotate_integration_webhook_token", {
      p_company_id: companyId,
      p_provider: provider,
      p_environment: environment,
    });
    if (error) {
      toast.error(errorMessage(error, "Não foi possível gerar um novo token"));
      return null;
    }
    await get().fetchAll();
    toast.success("Novo token gerado. Atualize o webhook no painel Asaas: o token antigo deixou de funcionar.");
    return data as string;
  },
}));
