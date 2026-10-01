import { create } from "zustand";
import { supabase } from "@/lib/supabase";

const DEVICE_STORAGE_KEY = "ponto-oris:device";

interface StoredDevice {
  deviceId: string;
  deviceCredential: string;
  companyLabel: string;
}

export interface Meu360Execution {
  id: string;
  productId: string;
  status: string;
  targetQuantity: number;
  operationalQuantity: number;
  routeVersionLabel: string;
  assumedByEmployeeId: string | null;
}

type Step = "no-device" | "matricula" | "pin" | "sessao";

interface Meu360State {
  step: Step;
  device: StoredDevice | null;
  employeeCode: string;
  employeeId: string | null;
  employeeFirstName: string | null;
  pin: string;
  busy: boolean;
  error: string | null;
  executions: Meu360Execution[];
  products: { id: string; name: string }[];

  init: () => void;
  setEmployeeCode: (v: string) => void;
  submitEmployeeCode: () => Promise<void>;
  setPin: (v: string) => void;
  submitPin: () => Promise<void>;
  refreshSession: () => Promise<void>;
  assumir: (execId: string) => Promise<void>;
  avancar: (execId: string, delta: number) => Promise<void>;
  concluir: (execId: string) => Promise<void>;
  logout: () => void;
}

function invoke<T>(body: Record<string, unknown>) {
  return supabase.functions.invoke<T & { error?: string }>("meu360-terminal", { body });
}

export const useMeu360Store = create<Meu360State>()((set, get) => ({
  step: "no-device",
  device: null,
  employeeCode: "",
  employeeId: null,
  employeeFirstName: null,
  pin: "",
  busy: false,
  error: null,
  executions: [],
  products: [],

  init: () => {
    const raw = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!raw) {
      set({ step: "no-device" });
      return;
    }
    try {
      const device = JSON.parse(raw) as StoredDevice;
      set({ device, step: "matricula" });
    } catch {
      set({ step: "no-device" });
    }
  },

  setEmployeeCode: (v) => set({ employeeCode: v, error: null }),

  submitEmployeeCode: async () => {
    const { device, employeeCode } = get();
    if (!device || !employeeCode) return;
    set({ busy: true, error: null });
    const { data, error } = await invoke<{ employee_id?: string; first_name?: string }>({
      action: "identify",
      device_id: device.deviceId,
      device_credential: device.deviceCredential,
      employee_code: employeeCode,
    });
    if (error || !data || data.error || !data.employee_id) {
      set({ busy: false, error: data?.error ?? "Matrícula inválida" });
      return;
    }
    set({ busy: false, employeeId: data.employee_id, employeeFirstName: data.first_name ?? null, step: "pin" });
  },

  setPin: (v) => set({ pin: v, error: null }),

  submitPin: async () => {
    const { device, employeeId, pin } = get();
    if (!device || !employeeId || pin.length < 4) return;
    set({ busy: true, error: null });
    const { data, error } = await invoke<{ employee_name?: string; executions?: Meu360Execution[]; products?: { id: string; name: string }[] }>({
      action: "session",
      device_id: device.deviceId,
      device_credential: device.deviceCredential,
      employee_id: employeeId,
      pin,
    });
    if (error || !data || data.error) {
      set({ busy: false, error: data?.error ?? "PIN inválido", pin: "" });
      return;
    }
    set({
      busy: false,
      step: "sessao",
      executions: ((data.executions ?? []) as unknown as Record<string, unknown>[]).map((e) => ({
        id: e.id as string,
        productId: e.product_id as string,
        status: e.status as string,
        targetQuantity: e.target_quantity as number,
        operationalQuantity: e.operational_quantity as number,
        routeVersionLabel: e.route_version_label as string,
        assumedByEmployeeId: e.assumed_by_employee_id as string | null,
      })),
      products: data.products ?? [],
    });
  },

  refreshSession: async () => {
    const { device, employeeId, pin } = get();
    if (!device || !employeeId || !pin) return;
    const { data } = await invoke<{ executions?: Record<string, unknown>[] }>({
      action: "session",
      device_id: device.deviceId,
      device_credential: device.deviceCredential,
      employee_id: employeeId,
      pin,
    });
    if (data?.executions) {
      set({
        executions: data.executions.map((e) => ({
          id: e.id as string,
          productId: e.product_id as string,
          status: e.status as string,
          targetQuantity: e.target_quantity as number,
          operationalQuantity: e.operational_quantity as number,
          routeVersionLabel: e.route_version_label as string,
          assumedByEmployeeId: e.assumed_by_employee_id as string | null,
        })),
      });
    }
  },

  assumir: async (execId) => {
    const { device, employeeId, pin } = get();
    if (!device || !employeeId) return;
    set({ busy: true });
    await invoke({ action: "do", op: "assumir", device_id: device.deviceId, device_credential: device.deviceCredential, employee_id: employeeId, pin, floor_execution_id: execId });
    set({ busy: false });
    await get().refreshSession();
  },

  avancar: async (execId, delta) => {
    const { device, employeeId, pin } = get();
    if (!device || !employeeId) return;
    set({ busy: true });
    await invoke({ action: "do", op: "avancar", device_id: device.deviceId, device_credential: device.deviceCredential, employee_id: employeeId, pin, floor_execution_id: execId, quantity_delta: delta });
    set({ busy: false });
    await get().refreshSession();
  },

  concluir: async (execId) => {
    const { device, employeeId, pin } = get();
    if (!device || !employeeId) return;
    set({ busy: true });
    await invoke({ action: "do", op: "concluir", device_id: device.deviceId, device_credential: device.deviceCredential, employee_id: employeeId, pin, floor_execution_id: execId });
    set({ busy: false });
    await get().refreshSession();
  },

  logout: () => set({ step: "matricula", employeeCode: "", employeeId: null, employeeFirstName: null, pin: "", executions: [], products: [] }),
}));
