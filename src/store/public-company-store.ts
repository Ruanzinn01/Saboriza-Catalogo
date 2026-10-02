import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface PublicCompany {
  id: string;
  slug: string;
  displayName: string;
}

interface PublicCompanyState {
  company: PublicCompany | null;
  status: "idle" | "loading" | "ready" | "error";
  lastSlug: string | null;
  resolve: (slug: string | undefined) => Promise<void>;
}

// Resolve a empresa do site publico pela slug da URL (/:companySlug). Sem slug (rotas legadas
// "/", "/checkout" etc.), cai na empresa marcada como is_default no banco.
export const usePublicCompanyStore = create<PublicCompanyState>((set, get) => ({
  company: null,
  status: "idle",
  lastSlug: null,

  resolve: async (slug) => {
    const key = slug ?? null;
    const state = get();
    if (state.status === "ready" && state.lastSlug === key) return;

    set({ status: "loading", lastSlug: key });

    const query = supabase.from("companies").select("id, slug, display_name").eq("status", "ACTIVE");
    const { data, error } = key ? await query.eq("slug", key).maybeSingle() : await query.eq("is_default", true).maybeSingle();

    if (error || !data) {
      set({ status: "error", company: null });
      return;
    }

    set({
      company: { id: data.id, slug: data.slug, displayName: data.display_name },
      status: "ready",
    });
  },
}));
