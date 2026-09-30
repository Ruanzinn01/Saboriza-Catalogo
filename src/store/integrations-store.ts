import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { IntegrationCredential, IntegrationEnvironment, IntegrationProvider } from "@/types/integrations";

function fromRow(row: {
  id: string;
  provider: string;
  environment: string;
  key_last4: string | null;
  wallet_id: string | null;
  fiscal_provider_name: string | null;
  status: string;
  last_validated_at: string | null;
  last_error: string | null;
  updated_at: string;
}): IntegrationCredential {
  return {
    id: row.id,
    provider: row.provider as IntegrationProvider,
    environment: row.environment as IntegrationEnvironment,
    keyLast4: row.key_last4,
    walletId: row.wallet_id,
    fiscalProviderName: row.fiscal_provider_name,
    status: row.status as IntegrationCredential["status"],
    lastValidatedAt: row.last_validated_at,
    lastError: row.last_error,
    updatedAt: row.updated_at,
  };
}

interface IntegrationsState {
  credentials: IntegrationCredential[];
  status: "idle" | "loading" | "ready" | "error";
  fetchAll: () => Promise<void>;
  saveCredential: (
    provider: IntegrationProvider,
    environment: IntegrationEnvironment,
    apiKey: string,
    walletId?: string | null,
    fiscalProviderName?: string | null
  ) => Promise<boolean>;
  removeCredential: (provider: IntegrationProvider, environment: IntegrationEnvironment) => Promise<boolean>;
}

export const useIntegrationsStore = create<IntegrationsState>()((set, get) => ({
  credentials: [],
  status: "idle",

  fetchAll: async () => {
    set({ status: "loading" });
    const { data, error } = await supabase.from("company_integration_credentials").select("*");
    if (error) {
      set({ status: "error" });
      return;
    }
    set({ credentials: data.map(fromRow), status: "ready" });
  },

  saveCredential: async (provider, environment, apiKey, walletId, fiscalProviderName) => {
    const { data, error } = await supabase
      .rpc("save_integration_credential", {
        p_provider: provider,
        p_environment: environment,
        p_api_key: apiKey,
        p_wallet_id: walletId ?? undefined,
        p_fiscal_provider_name: fiscalProviderName ?? undefined,
      })
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível salvar a credencial");
      return false;
    }
    await get().fetchAll();
    toast.success("Credencial salva. A chave fica criptografada — só os 4 últimos dígitos aparecem aqui.");
    return true;
  },

  removeCredential: async (provider, environment) => {
    const { error } = await supabase.rpc("remove_integration_credential", { p_provider: provider, p_environment: environment });
    if (error) {
      toast.error(error.message ?? "Não foi possível remover a credencial");
      return false;
    }
    await get().fetchAll();
    toast.success("Credencial removida");
    return true;
  },
}));
