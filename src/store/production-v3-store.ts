import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";
import type {
  DiaryEvaluation,
  DiaryOccurrence,
  DiaryOtherActivity,
  OccurrenceType,
  ProductionDiary,
  UrgentDemand,
} from "@/types/production-v3";

function urgentFromRow(row: {
  id: string;
  product_id: string;
  name: string;
  total_quantity: number;
  done_quantity: number;
  status: string;
  created_at: string;
}): UrgentDemand {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    totalQuantity: row.total_quantity,
    doneQuantity: row.done_quantity,
    status: row.status as UrgentDemand["status"],
    createdAt: row.created_at,
  };
}

function diaryFromRow(row: { id: string; local_date: string; status: string; general_note: string | null; closed_at: string | null }): ProductionDiary {
  return {
    id: row.id,
    localDate: row.local_date,
    status: row.status as ProductionDiary["status"],
    generalNote: row.general_note ?? "",
    closedAt: row.closed_at,
  };
}

interface ProductionV3State {
  urgentDemands: UrgentDemand[];
  diary: ProductionDiary | null;
  evaluations: DiaryEvaluation[];
  occurrences: DiaryOccurrence[];
  activities: DiaryOtherActivity[];
  fetchUrgentDemands: () => Promise<void>;
  createUrgentDemand: (productId: string, name: string, totalQuantity: number) => Promise<boolean>;
  ensureTodayDiary: () => Promise<ProductionDiary | null>;
  fetchEvaluationsAndEvents: (diaryId: string) => Promise<void>;
  saveEvaluation: (employeeId: string, pace: string, quality: string, commitment: string, note: string) => Promise<void>;
  addOccurrence: (employeeId: string, type: OccurrenceType, description: string) => Promise<void>;
  addOtherActivity: (employeeId: string, activity: string, period: string) => Promise<void>;
  closeDiary: (generalNote: string) => Promise<void>;
  reopenDiary: () => Promise<void>;
}

export const useProductionV3Store = create<ProductionV3State>()((set, get) => ({
  urgentDemands: [],
  diary: null,
  evaluations: [],
  occurrences: [],
  activities: [],

  fetchUrgentDemands: async () => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return;
    const { data, error } = await supabase.from("urgent_demands").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
    if (error || !data) return;
    set({ urgentDemands: data.map(urgentFromRow) });
  },

  createUrgentDemand: async (productId, name, totalQuantity) => {
    if (!name.trim() || totalQuantity <= 0) {
      toast.error("Informe nome e quantidade válida");
      return false;
    }
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) {
      toast.error("Não foi possível identificar a empresa");
      return false;
    }
    const { data, error } = await supabase
      .from("urgent_demands")
      .insert({ product_id: productId, name: name.trim(), total_quantity: totalQuantity, company_id: companyId })
      .select("*")
      .single();
    if (error || !data) {
      toast.error("Não foi possível criar a demanda");
      return false;
    }
    set((state) => ({ urgentDemands: [urgentFromRow(data), ...state.urgentDemands] }));
    toast.success("Demanda urgente cadastrada");
    return true;
  },

  ensureTodayDiary: async () => {
    const today = new Date().toISOString().slice(0, 10);
    const existing = get().diary;
    if (existing?.localDate === today) return existing;

    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return null;

    const { data: found } = await supabase
      .from("production_diaries")
      .select("*")
      .eq("company_id", companyId)
      .eq("local_date", today)
      .maybeSingle();
    if (found) {
      const diary = diaryFromRow(found);
      set({ diary });
      await get().fetchEvaluationsAndEvents(diary.id);
      return diary;
    }

    const { data: created, error } = await supabase
      .from("production_diaries")
      .insert({ local_date: today, company_id: companyId })
      .select("*")
      .single();
    if (error || !created) return null;
    const diary = diaryFromRow(created);
    set({ diary, evaluations: [], occurrences: [], activities: [] });
    return diary;
  },

  fetchEvaluationsAndEvents: async (diaryId: string) => {
    const [evals, occ, acts] = await Promise.all([
      supabase.from("diary_evaluations").select("*").eq("diary_id", diaryId),
      supabase.from("diary_occurrences").select("*").eq("diary_id", diaryId).order("created_at", { ascending: false }),
      supabase.from("diary_other_activities").select("*").eq("diary_id", diaryId).order("created_at", { ascending: false }),
    ]);
    set({
      evaluations: (evals.data ?? []).map((r) => ({
        id: r.id,
        diaryId: r.diary_id,
        employeeId: r.employee_id,
        paceGrade: r.pace_grade,
        qualityGrade: r.quality_grade,
        commitmentGrade: r.commitment_grade,
        note: r.note ?? "",
      })),
      occurrences: (occ.data ?? []).map((r) => ({
        id: r.id,
        diaryId: r.diary_id,
        employeeId: r.employee_id,
        occurrenceType: r.occurrence_type as OccurrenceType,
        description: r.description,
        createdAt: r.created_at,
      })),
      activities: (acts.data ?? []).map((r) => ({
        id: r.id,
        diaryId: r.diary_id,
        employeeId: r.employee_id,
        activity: r.activity,
        period: r.period ?? "",
        createdAt: r.created_at,
      })),
    });
  },

  saveEvaluation: async (employeeId, pace, quality, commitment, note) => {
    const diary = get().diary ?? (await get().ensureTodayDiary());
    if (!diary) return;
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return;
    const { data, error } = await supabase
      .from("diary_evaluations")
      .upsert(
        {
          diary_id: diary.id,
          employee_id: employeeId,
          pace_grade: pace,
          quality_grade: quality,
          commitment_grade: commitment,
          note: note || null,
          company_id: companyId,
        },
        { onConflict: "diary_id,employee_id" }
      )
      .select("*")
      .single();
    if (error || !data) {
      toast.error("Não foi possível salvar a avaliação");
      return;
    }
    set((state) => ({
      evaluations: [
        ...state.evaluations.filter((e) => e.employeeId !== employeeId),
        { id: data.id, diaryId: data.diary_id, employeeId: data.employee_id, paceGrade: data.pace_grade, qualityGrade: data.quality_grade, commitmentGrade: data.commitment_grade, note: data.note ?? "" },
      ],
    }));
  },

  addOccurrence: async (employeeId, type, description) => {
    const diary = get().diary ?? (await get().ensureTodayDiary());
    if (!diary || !description.trim()) return;
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return;
    const { data, error } = await supabase
      .from("diary_occurrences")
      .insert({ diary_id: diary.id, employee_id: employeeId, occurrence_type: type, description: description.trim(), company_id: companyId })
      .select("*")
      .single();
    if (error || !data) {
      toast.error("Não foi possível registrar a ocorrência");
      return;
    }
    set((state) => ({
      occurrences: [
        { id: data.id, diaryId: data.diary_id, employeeId: data.employee_id, occurrenceType: data.occurrence_type as OccurrenceType, description: data.description, createdAt: data.created_at },
        ...state.occurrences,
      ],
    }));
    toast.success("Ocorrência registrada");
  },

  addOtherActivity: async (employeeId, activity, period) => {
    const diary = get().diary ?? (await get().ensureTodayDiary());
    if (!diary || !activity.trim()) return;
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return;
    const { data, error } = await supabase
      .from("diary_other_activities")
      .insert({ diary_id: diary.id, employee_id: employeeId, activity: activity.trim(), period: period || null, company_id: companyId })
      .select("*")
      .single();
    if (error || !data) return;
    set((state) => ({
      activities: [
        { id: data.id, diaryId: data.diary_id, employeeId: data.employee_id, activity: data.activity, period: data.period ?? "", createdAt: data.created_at },
        ...state.activities,
      ],
    }));
  },

  closeDiary: async (generalNote) => {
    const diary = get().diary;
    if (!diary) return;
    const { data, error } = await supabase
      .from("production_diaries")
      .update({ status: "CONCLUIDO", closed_at: new Date().toISOString(), general_note: generalNote || null })
      .eq("id", diary.id)
      .select("*")
      .single();
    if (error || !data) {
      toast.error("Não foi possível concluir o diário");
      return;
    }
    set({ diary: diaryFromRow(data) });
    toast.success("Diário concluído. Novas produções continuam permitidas.");
  },

  reopenDiary: async () => {
    const diary = get().diary;
    if (!diary) return;
    const { data, error } = await supabase.from("production_diaries").update({ status: "EM_ANDAMENTO" }).eq("id", diary.id).select("*").single();
    if (error || !data) return;
    set({ diary: diaryFromRow(data) });
  },
}));
