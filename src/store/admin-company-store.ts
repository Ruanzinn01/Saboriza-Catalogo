import { create } from "zustand";
import { listMyCompanies, resolveCurrentCompany, setSelectedCompanyId, type CurrentCompany } from "@/lib/current-company";

interface AdminCompanyState {
  company: CurrentCompany | null;
  companies: CurrentCompany[];
  status: "idle" | "loading" | "ready" | "error";
  fetch: () => Promise<void>;
  switchCompany: (companyId: string) => void;
}

// Empresa "ativa" da sessão admin (resolvida pelo seletor, se houver mais de um vínculo) +
// lista de empresas que o usuário logado pode gerenciar. Fonte única pra nome/slug no admin —
// nunca settings.fantasyName, que é um campo de razão social livre e pode divergir do nome na plataforma.
export const useAdminCompanyStore = create<AdminCompanyState>((set, get) => ({
  company: null,
  companies: [],
  status: "idle",

  fetch: async () => {
    set({ status: "loading" });
    const [company, companies] = await Promise.all([resolveCurrentCompany(), listMyCompanies()]);
    set({ company, companies, status: company ? "ready" : "error" });
  },

  switchCompany: (companyId) => {
    if (companyId === get().company?.id) return;
    setSelectedCompanyId(companyId);
    window.location.href = "/admin";
  },
}));
