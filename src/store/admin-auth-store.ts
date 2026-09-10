import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AdminAuthState {
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  init: () => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  session: null,
  isAuthenticated: false,
  isLoading: true,

  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, isAuthenticated: data.session !== null, isLoading: false });
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, isAuthenticated: session !== null, isLoading: false });
    });
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return { success: false, error: error?.message ?? "E-mail ou senha inválidos" };
    }
    set({ session: data.session, isAuthenticated: true, isLoading: false });
    return { success: true };
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ session: null, isAuthenticated: false });
  },
}));
