import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface PlatformCompany {
  id: string;
  displayName: string;
  status: string;
  createdAt: string;
  activeUsers: number;
  ordersThisMonth: number;
}

export interface PlatformCompanyMember {
  membershipId: string;
  userId: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface PlatformCompanyDetail {
  id: string;
  displayName: string;
  legalName: string | null;
  document: string | null;
  segment: string | null;
  status: string;
  createdAt: string;
  members: PlatformCompanyMember[];
  ordersThisMonth: number;
  activeUsers: number;
}

interface PlatformState {
  isPlatformAdmin: boolean | null;
  companies: PlatformCompany[];
  listStatus: "idle" | "loading" | "ready" | "error";
  detail: PlatformCompanyDetail | null;
  detailStatus: "idle" | "loading" | "ready" | "error";

  checkAccess: () => Promise<boolean>;
  fetchCompanies: () => Promise<void>;
  fetchCompanyDetail: (companyId: string) => Promise<void>;
  createCompany: (input: { displayName: string; legalName?: string; document?: string; segment?: string }) => Promise<string | null>;
  setCompanyStatus: (companyId: string, status: "ACTIVE" | "SUSPENSA") => Promise<string | null>;
}

export const usePlatformStore = create<PlatformState>((set, get) => ({
  isPlatformAdmin: null,
  companies: [],
  listStatus: "idle",
  detail: null,
  detailStatus: "idle",

  checkAccess: async () => {
    const { data, error } = await supabase.rpc("get_platform_companies");
    const allowed = !error && data !== null;
    set({ isPlatformAdmin: allowed });
    return allowed;
  },

  fetchCompanies: async () => {
    set({ listStatus: "loading" });

    const { data, error } = await supabase.rpc("get_platform_companies");
    if (error) {
      set({ listStatus: "error", isPlatformAdmin: false });
      return;
    }

    set({
      isPlatformAdmin: true,
      companies: (data ?? []).map((c) => ({
        id: c.company_id,
        displayName: c.display_name,
        status: c.status,
        createdAt: c.created_at,
        activeUsers: c.active_users,
        ordersThisMonth: c.orders_this_month,
      })),
      listStatus: "ready",
    });
  },

  fetchCompanyDetail: async (companyId) => {
    set({ detailStatus: "loading" });

    const { data, error } = await supabase.rpc("get_platform_company_detail", { p_company_id: companyId });
    if (error || !data) {
      set({ detailStatus: "error" });
      return;
    }

    const raw = data as {
      company: {
        id: string;
        display_name: string;
        legal_name: string | null;
        document: string | null;
        segment: string | null;
        status: string;
        created_at: string;
      };
      members: { membership_id: string; user_id: string; email: string; status: string; created_at: string }[];
      metrics: { orders_this_month: number; active_users: number };
    };

    set({
      detail: {
        id: raw.company.id,
        displayName: raw.company.display_name,
        legalName: raw.company.legal_name,
        document: raw.company.document,
        segment: raw.company.segment,
        status: raw.company.status,
        createdAt: raw.company.created_at,
        members: raw.members.map((m) => ({
          membershipId: m.membership_id,
          userId: m.user_id,
          email: m.email,
          status: m.status,
          createdAt: m.created_at,
        })),
        ordersThisMonth: raw.metrics.orders_this_month,
        activeUsers: raw.metrics.active_users,
      },
      detailStatus: "ready",
    });
  },

  createCompany: async (input) => {
    const { error } = await supabase.rpc("create_platform_company", {
      p_display_name: input.displayName,
      p_legal_name: input.legalName || undefined,
      p_document: input.document || undefined,
      p_segment: input.segment || undefined,
    });
    if (error) return error.message;
    await get().fetchCompanies();
    return null;
  },

  setCompanyStatus: async (companyId, status) => {
    const { error } = await supabase.rpc("set_platform_company_status", { p_company_id: companyId, p_status: status });
    if (error) return error.message;
    await Promise.all([get().fetchCompanies(), get().fetchCompanyDetail(companyId)]);
    return null;
  },
}));
