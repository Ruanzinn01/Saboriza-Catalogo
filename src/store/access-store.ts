import { create } from "zustand";
import { rpcUntyped } from "@/lib/supabase-rpc";
import { type AppAccessRow, type OperatorAppId, deriveAccess } from "@/lib/operator-apps";

interface AccessState {
  status: "idle" | "loading" | "ready" | "error";
  restricted: boolean;
  apps: OperatorAppId[];
  adminAccess: boolean;
  canManageInventory: boolean;
  fetch: () => Promise<void>;
  reset: () => void;
}

let inflight: Promise<void> | null = null;

const EMPTY = { restricted: false, apps: [] as OperatorAppId[], adminAccess: false, canManageInventory: false };

async function loadProfile(): Promise<{ row: AppAccessRow | undefined; failed: boolean }> {
  const current = await rpcUntyped("my_app_access");
  if (!current.error) return { row: (current.data as AppAccessRow[] | null)?.[0], failed: false };
  const legacy = await rpcUntyped("my_access_profile");
  if (legacy.error) return { row: undefined, failed: true };
  return { row: (legacy.data as AppAccessRow[] | null)?.[0], failed: false };
}

export const useAccessStore = create<AccessState>()((set) => ({
  status: "idle",
  ...EMPTY,

  fetch: () => {
    if (inflight) return inflight;
    set({ status: "loading" });
    inflight = (async () => {
      const { row, failed } = await loadProfile();
      if (failed) set({ status: "error", ...EMPTY });
      else set({ status: "ready", ...deriveAccess(row) });
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  },

  reset: () => set({ status: "idle", ...EMPTY }),
}));
