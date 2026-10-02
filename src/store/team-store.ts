import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";

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
  permissionKeys: string[];
}

export interface PermissionInfo {
  key: string;
  name: string;
  description: string;
  sensitivity: string;
}

interface TeamState {
  companyId: string | null;
  members: TeamMember[];
  roles: RoleOption[];
  permissions: PermissionInfo[];
  status: "idle" | "loading" | "ready" | "error";
  fetchTeam: () => Promise<void>;
  fetchRolesCatalog: () => Promise<void>;
  inviteMember: (email: string, roleId: string) => Promise<string | null>;
  revokeMember: (membershipId: string) => Promise<string | null>;
  updateMemberRole: (membershipId: string, roleId: string) => Promise<string | null>;
  createRole: (name: string) => Promise<string | null>;
  saveRolePermissions: (roleId: string, permissionKeys: string[]) => Promise<string | null>;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  companyId: null,
  members: [],
  roles: [],
  permissions: [],
  status: "idle",

  fetchTeam: async () => {
    set({ status: "loading" });

    const companyId = await resolveCurrentCompanyId();
    if (!companyId) {
      set({ status: "error" });
      return;
    }

    const [{ data: members, error: membersError }, { data: roles }] = await Promise.all([
      supabase.rpc("oris360_list_company_members", { p_company_id: companyId }),
      supabase.rpc("oris360_list_roles", { p_company_id: companyId }),
    ]);

    if (membersError) {
      set({ status: "error" });
      return;
    }

    set({
      companyId,
      members: (members ?? []).map((m) => ({
        membershipId: m.membership_id,
        userId: m.user_id,
        email: m.email,
        status: m.status,
        roleNames: m.role_names ?? [],
        createdAt: m.created_at,
      })),
      roles: (roles ?? []).map((r) => ({ id: r.id, name: r.name, permissionKeys: [] })),
      status: "ready",
    });
  },

  fetchRolesCatalog: async () => {
    const companyId = get().companyId ?? (await resolveCurrentCompanyId());
    if (!companyId) return;
    const { data, error } = await supabase.functions.invoke<{
      roles?: { id: string; name: string; permission_keys: string[] }[];
      permissions?: PermissionInfo[];
      error?: string;
    }>("iam-manage-members", { body: { action: "list-roles", company_id: companyId } });

    if (error || !data || data.error) return;

    set({
      roles: (data.roles ?? []).map((r) => ({ id: r.id, name: r.name, permissionKeys: r.permission_keys })),
      permissions: data.permissions ?? [],
    });
  },

  inviteMember: async (email, roleId) => {
    const companyId = get().companyId ?? (await resolveCurrentCompanyId());
    if (!companyId) return "Não foi possível identificar a empresa";
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("iam-manage-members", {
      body: { action: "invite", email, role_id: roleId, company_id: companyId },
    });
    if (error || !data?.ok) return data?.error ?? "Não foi possível convidar este e-mail";
    await get().fetchTeam();
    return null;
  },

  revokeMember: async (membershipId) => {
    const companyId = get().companyId ?? (await resolveCurrentCompanyId());
    if (!companyId) return "Não foi possível identificar a empresa";
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("iam-manage-members", {
      body: { action: "revoke", membership_id: membershipId, company_id: companyId },
    });
    if (error || !data?.ok) return data?.error ?? "Não foi possível revogar o acesso";
    await get().fetchTeam();
    return null;
  },

  updateMemberRole: async (membershipId, roleId) => {
    const companyId = get().companyId ?? (await resolveCurrentCompanyId());
    if (!companyId) return "Não foi possível identificar a empresa";
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("iam-manage-members", {
      body: { action: "update-member-role", membership_id: membershipId, role_id: roleId, company_id: companyId },
    });
    if (error || !data?.ok) return data?.error ?? "Não foi possível trocar o papel";
    await get().fetchTeam();
    return null;
  },

  createRole: async (name) => {
    const companyId = get().companyId ?? (await resolveCurrentCompanyId());
    if (!companyId) return "Não foi possível identificar a empresa";
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; role_id?: string; error?: string }>(
      "iam-manage-members",
      { body: { action: "create-role", name, company_id: companyId } }
    );
    if (error || !data?.ok) return data?.error ?? "Não foi possível criar o papel";
    await get().fetchRolesCatalog();
    return null;
  },

  saveRolePermissions: async (roleId, permissionKeys) => {
    const companyId = get().companyId ?? (await resolveCurrentCompanyId());
    if (!companyId) return "Não foi possível identificar a empresa";
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("iam-manage-members", {
      body: { action: "update-role-permissions", role_id: roleId, permission_keys: permissionKeys, company_id: companyId },
    });
    if (error || !data?.ok) return data?.error ?? "Não foi possível salvar as permissões";
    await get().fetchRolesCatalog();
    return null;
  },
}));
