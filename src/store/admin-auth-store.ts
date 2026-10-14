import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAccessStore } from "@/store/access-store";

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
      if (data.session) void supabase.rpc("oris360_accept_invite");
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== useAdminAuthStore.getState().session?.user.id) useAccessStore.getState().reset();
      set({ session, isAuthenticated: session !== null, isLoading: false });
    });
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return { success: false, error: error?.message ?? "E-mail ou senha inválidos" };
    }
    useAccessStore.getState().reset();
    set({ session: data.session, isAuthenticated: true, isLoading: false });
    // Convite pendente (status INVITED) vira ACTIVE no primeiro login bem-sucedido.
    void supabase.rpc("oris360_accept_invite");
    return { success: true };
  },

  logout: async () => {
    await supabase.auth.signOut();
    useAccessStore.getState().reset();
    set({ session: null, isAuthenticated: false });
  },
}));
