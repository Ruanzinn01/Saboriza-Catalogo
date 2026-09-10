import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { couponFromRow, couponToRow } from "@/lib/mappers/coupon-mapper";
import type { Coupon } from "@/types/coupon";

interface CouponsState {
  coupons: Coupon[];
  status: "idle" | "loading" | "ready" | "error";
  fetchCoupons: () => Promise<void>;
  addCoupon: (coupon: Coupon) => void;
  updateCoupon: (id: string, patch: Partial<Coupon>) => void;
  removeCoupon: (id: string) => void;
}

export const useCouponsStore = create<CouponsState>()((set, get) => ({
  coupons: [],
  status: "idle",

  fetchCoupons: async () => {
    set({ status: "loading" });
    const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });

    if (error) {
      toast.error("Não foi possível carregar os cupons");
      set({ status: "error" });
      return;
    }

    set({ coupons: (data ?? []).map(couponFromRow), status: "ready" });
  },

  addCoupon: (coupon) => {
    set((state) => ({ coupons: [coupon, ...state.coupons] }));
    supabase
      .from("coupons")
      .insert(couponToRow(coupon))
      .then(({ error }) => {
        if (error) {
          toast.error(
            error.code === "23505" ? "Já existe um cupom com esse código" : "Não foi possível salvar o cupom"
          );
          set((state) => ({ coupons: state.coupons.filter((item) => item.id !== coupon.id) }));
        } else {
          toast.success("Cupom criado com sucesso");
        }
      });
  },

  updateCoupon: (id, patch) => {
    const previous = get().coupons;
    set((state) => ({
      coupons: state.coupons.map((coupon) => (coupon.id === id ? { ...coupon, ...patch } : coupon)),
    }));
    const updated = get().coupons.find((coupon) => coupon.id === id);
    if (!updated) return;
    supabase
      .from("coupons")
      .update(couponToRow(updated))
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          toast.error("Não foi possível atualizar o cupom");
          set({ coupons: previous });
        } else if (Object.keys(patch).length === 1 && "active" in patch) {
          toast.success(updated.active ? "Cupom ativado" : "Cupom desativado");
        } else {
          toast.success("Cupom atualizado");
        }
      });
  },

  removeCoupon: (id) => {
    const previous = get().coupons;
    set((state) => ({ coupons: state.coupons.filter((coupon) => coupon.id !== id) }));
    supabase
      .from("coupons")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          toast.error("Não foi possível excluir o cupom");
          set({ coupons: previous });
        } else {
          toast.success("Cupom excluído");
        }
      });
  },
}));
