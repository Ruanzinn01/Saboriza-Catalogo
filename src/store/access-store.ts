import { create } from "zustand";
import { rpcUntyped } from "@/lib/supabase-rpc";

interface ProfileRow {
  company_id: string;
  restricted: boolean;
  can_manage_inventory: boolean;
}

interface AccessState {
  status: "idle" | "loading" | "ready" | "error";
  restricted: boolean;
  canManageInventory: boolean;
  fetch: () => Promise<void>;
  reset: () => void;
}

let inflight: Promise<void> | null = null;

export const useAccessStore = create<AccessState>()((set) => ({
  status: "idle",
  restricted: false,
  canManageInventory: false,

  fetch: () => {
    if (inflight) return inflight;
    set({ status: "loading" });
    inflight = (async () => {
      const { data, error } = await rpcUntyped("my_access_profile");
      const row = (data as ProfileRow[] | null)?.[0];
      if (error) set({ status: "error", restricted: false, canManageInventory: false });
      else set({ status: "ready", restricted: Boolean(row?.restricted), canManageInventory: Boolean(row?.can_manage_inventory) });
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  },

  reset: () => set({ status: "idle", restricted: false, canManageInventory: false }),
}));
