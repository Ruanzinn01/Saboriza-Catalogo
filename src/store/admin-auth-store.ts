import { create } from "zustand";

const ADMIN_CREDENTIALS = {
  email: "admin@saboriza.com.br",
  password: "saboriza123",
};

interface AdminAuthState {
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  isAuthenticated: false,
  login: (email, password) => {
    const valid = email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password;
    if (valid) set({ isAuthenticated: true });
    return valid;
  },
  logout: () => set({ isAuthenticated: false }),
}));
