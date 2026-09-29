import { create } from "zustand";
import { supabase } from "@/lib/supabase";

type TerminalStep = "device-setup" | "matricula" | "pin" | "tipo" | "foto" | "enviando" | "sucesso";

export type PunchType = "ENTRADA" | "INTERVALO" | "RETORNO" | "SAIDA";

const DEVICE_STORAGE_KEY = "ponto-oris:device";

interface StoredDevice {
  deviceId: string;
  deviceCredential: string;
  companyLabel: string;
}

interface PontoOrisTerminalState {
  step: TerminalStep;
  device: StoredDevice | null;

  employeeCode: string;
  employeeId: string | null;
  employeeFirstName: string | null;

  pin: string;
  punchType: PunchType | null;
  photoBase64: string | null;

  errorMessage: string | null;
  isBusy: boolean;
  lastConfirmedType: PunchType | null;

  loadDevice: () => void;
  saveDevice: (device: StoredDevice) => void;
  forgetDevice: () => void;

  setEmployeeCode: (value: string) => void;
  submitEmployeeCode: () => Promise<void>;

  setPin: (value: string) => void;
  submitPin: () => void;

  selectPunchType: (type: PunchType) => void;

  setPhoto: (base64: string) => void;
  retakePhoto: () => void;
  confirmPunch: () => Promise<void>;

  dismissError: () => void;
  reset: () => void;
}

function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export const usePontoOrisTerminalStore = create<PontoOrisTerminalState>((set, get) => ({
  step: "device-setup",
  device: null,

  employeeCode: "",
  employeeId: null,
  employeeFirstName: null,

  pin: "",
  punchType: null,
  photoBase64: null,

  errorMessage: null,
  isBusy: false,
  lastConfirmedType: null,

  loadDevice: () => {
    const raw = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!raw) {
      set({ step: "device-setup" });
      return;
    }
    try {
      const device = JSON.parse(raw) as StoredDevice;
      set({ device, step: "matricula" });
    } catch {
      set({ step: "device-setup" });
    }
  },

  saveDevice: (device) => {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(device));
    set({ device, step: "matricula" });
  },

  forgetDevice: () => {
    localStorage.removeItem(DEVICE_STORAGE_KEY);
    set({ device: null, step: "device-setup" });
  },

  setEmployeeCode: (value) => set({ employeeCode: value }),

  submitEmployeeCode: async () => {
    const { device, employeeCode } = get();
    if (!device || !employeeCode) return;

    set({ isBusy: true, errorMessage: null });

    const { data, error } = await supabase.functions.invoke<{
      employee_id?: string;
      first_name?: string;
      error?: string;
    }>("ponto-oris-terminal", {
      body: {
        action: "identify",
        device_id: device.deviceId,
        device_credential: device.deviceCredential,
        employee_code: employeeCode,
      },
    });

    if (error || !data || data.error || !data.employee_id) {
      set({ isBusy: false, errorMessage: "Matrícula inválida", employeeCode: "" });
      return;
    }

    set({
      isBusy: false,
      employeeId: data.employee_id,
      employeeFirstName: data.first_name ?? null,
      step: "pin",
    });
  },

  setPin: (value) => set({ pin: value }),

  submitPin: () => {
    const { pin } = get();
    if (pin.length < 4) return;
    set({ step: "tipo" });
  },

  selectPunchType: (type) => set({ punchType: type, step: "foto" }),

  setPhoto: (base64) => set({ photoBase64: base64 }),

  retakePhoto: () => set({ photoBase64: null }),

  confirmPunch: async () => {
    const { device, employeeId, pin, punchType, photoBase64 } = get();
    if (!device || !employeeId || !pin || !punchType || !photoBase64) return;

    set({ step: "enviando", errorMessage: null });

    const idempotencyKey = generateIdempotencyKey();

    const { data, error } = await supabase.functions.invoke<{
      punch_id?: string;
      type?: PunchType;
      error?: string;
    }>("ponto-oris-terminal", {
      body: {
        action: "punch",
        device_id: device.deviceId,
        device_credential: device.deviceCredential,
        employee_id: employeeId,
        pin,
        type: punchType,
        photo_base64: photoBase64,
        device_reported_time: new Date().toISOString(),
        idempotency_key: idempotencyKey,
      },
    });

    if (error || !data || data.error || !data.punch_id) {
      set({
        step: "foto",
        errorMessage: data?.error === "PIN inválido" ? "PIN inválido" : "Sem conexão. Tente novamente.",
      });
      return;
    }

    set({ step: "sucesso", lastConfirmedType: data.type ?? punchType });
  },

  dismissError: () => set({ errorMessage: null }),

  reset: () =>
    set({
      step: "matricula",
      employeeCode: "",
      employeeId: null,
      employeeFirstName: null,
      pin: "",
      punchType: null,
      photoBase64: null,
      errorMessage: null,
      isBusy: false,
    }),
}));
