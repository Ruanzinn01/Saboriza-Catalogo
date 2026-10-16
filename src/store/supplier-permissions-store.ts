import { create } from "zustand";
import { loadSupplierPermissions, NO_SUPPLIER_PERMISSIONS, type SupplierPermissions } from "@/lib/supplier-api";

interface SupplierPermissionsState {
  permissions: SupplierPermissions;
  status: "idle" | "loading" | "ready" | "error";
  load: () => Promise<void>;
}

// Só orienta a tela (esconder/mostrar). Toda operação é autorizada de novo no servidor, que também isola por empresa.
export const useSupplierPermissionsStore = create<SupplierPermissionsState>()((set, get) => ({
  permissions: NO_SUPPLIER_PERMISSIONS,
  status: "idle",
  load: async () => {
    if (get().status === "loading") return;
    set({ status: "loading" });
    const permissions = await loadSupplierPermissions();
    set(permissions ? { permissions, status: "ready" } : { status: "error" });
  },
}));
