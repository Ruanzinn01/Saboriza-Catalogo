import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface TeamMember {
  membershipId: string;
  userId: string;
  email: string;
  status: string;
  roleNames: string[];
  createdAt: string;
}

export interface RoleOption {
  id: string;
  name: string;
}

interface TeamState {
  companyId: string | null;
  members: TeamMember[];
  roles: RoleOption[];
  status: "idle" | "loading" | "ready" | "error";
  fetchTeam: () => Promise<void>;
  inviteMember: (email: string, roleId: string) => Promise<string | null>;
  revokeMember: (membershipId: string) => Promise<string | null>;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  companyId: null,
  members: [],
  roles: [],
  status: "idle",

  fetchTeam: async () => {
    set({ status: "loading" });

    const { data: company } = await supabase.from("companies").select("id").limit(1).maybeSingle();
    if (!company) {
      set({ status: "error" });
      return;
    }

    const [{ data: members, error: membersError }, { data: roles }] = await Promise.all([
      supabase.rpc("oris360_list_company_members", { p_company_id: company.id }),
      supabase.rpc("oris360_list_roles", { p_company_id: company.id }),
    ]);

    if (membersError) {
      set({ status: "error" });
      return;
    }

    set({
      companyId: company.id,
      members: (members ?? []).map((m) => ({
        membershipId: m.membership_id,
        userId: m.user_id,
        email: m.email,
        status: m.status,
        roleNames: m.role_names ?? [],
        createdAt: m.created_at,
      })),
      roles: (roles ?? []).map((r) => ({ id: r.id, name: r.name })),
      status: "ready",
    });
  },

  inviteMember: async (email, roleId) => {
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("iam-manage-members", {
      body: { action: "invite", email, role_id: roleId },
    });
    if (error || !data?.ok) return data?.error ?? "Não foi possível convidar este e-mail";
    await get().fetchTeam();
    return null;
  },

  revokeMember: async (membershipId) => {
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("iam-manage-members", {
      body: { action: "revoke", membership_id: membershipId },
    });
    if (error || !data?.ok) return data?.error ?? "Não foi possível revogar o acesso";
    await get().fetchTeam();
    return null;
  },
}));
