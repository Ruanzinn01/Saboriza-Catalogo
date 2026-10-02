import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";

export interface Seller {
  id: string;
  name: string;
  commissionRatePercent: number | null;
}

export type CommissionStatus = "PREVISTA" | "REALIZADA";

export interface SalesCommission {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  employeeId: string;
  employeeName: string;
  installmentNumber: number | null;
  saleAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: CommissionStatus;
  dueDate: string;
  realizedAt: string | null;
}

interface VendasState {
  sellers: Seller[];
  commissions: SalesCommission[];
  status: "idle" | "loading" | "ready" | "error";

  fetchSellers: () => Promise<void>;
  updateCommissionRate: (employeeId: string, ratePercent: number | null) => Promise<boolean>;
  fetchCommissions: (filters?: { employeeId?: string; periodStart?: string; periodEnd?: string }) => Promise<void>;
}

export const useVendasStore = create<VendasState>()((set, get) => ({
  sellers: [],
  commissions: [],
  status: "idle",

  fetchSellers: async () => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return;
    const { data, error } = await supabase
      .from("employees")
      .select("id, name, commission_rate_percent")
      .eq("company_id", companyId)
      .eq("status", "ATIVO")
      .order("name", { ascending: true });

    if (error || !data) return;

    set({
      sellers: data.map((row) => ({
        id: row.id,
        name: row.name,
        commissionRatePercent: row.commission_rate_percent,
      })),
    });
  },

  updateCommissionRate: async (employeeId, ratePercent) => {
    const { error } = await supabase.from("employees").update({ commission_rate_percent: ratePercent }).eq("id", employeeId);
    if (error) {
      toast.error("Não foi possível atualizar a taxa de comissão");
      return false;
    }
    set((state) => ({
      sellers: state.sellers.map((seller) => (seller.id === employeeId ? { ...seller, commissionRatePercent: ratePercent } : seller)),
    }));
    toast.success("Taxa de comissão atualizada");
    return true;
  },

  fetchCommissions: async (filters) => {
    set({ status: "loading" });
    const { data, error } = await supabase.rpc("get_sales_commissions_report", {
      p_employee_id: filters?.employeeId ?? undefined,
      p_period_start: filters?.periodStart ?? undefined,
      p_period_end: filters?.periodEnd ?? undefined,
    });

    if (error || !data) {
      set({ status: "error" });
      return;
    }

    set({
      commissions: data.map((row) => ({
        id: row.commission_id,
        orderId: row.order_id,
        orderNumber: row.order_number,
        customerName: row.customer_name,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        installmentNumber: row.installment_number,
        saleAmount: row.sale_amount,
        commissionRate: row.commission_rate,
        commissionAmount: row.commission_amount,
        status: row.status as CommissionStatus,
        dueDate: row.due_date,
        realizedAt: row.realized_at,
      })),
      status: "ready",
    });
  },
}));
