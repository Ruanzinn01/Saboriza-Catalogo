export const DIARY_GRADES = ["Precisa melhorar", "Regular", "Bom", "Muito bom", "Excelente", "Não foi possível avaliar"] as const;
export type DiaryGrade = (typeof DIARY_GRADES)[number];

export const OCCURRENCE_TYPES = ["Destaque positivo", "Atenção", "Operacional"] as const;
export type OccurrenceType = (typeof OCCURRENCE_TYPES)[number];

export const NON_PARTICIPATION_REASONS = ["Outra atividade", "Apoio a outro setor", "Folga", "Falta/Ausência", "Afastamento", "Outro"] as const;

export interface UrgentDemand {
  id: string;
  productId: string;
  name: string;
  totalQuantity: number;
  doneQuantity: number;
  status: "ATIVO" | "CONCLUIDO" | "CANCELADO";
  createdAt: string;
}

export interface ProductionDiary {
  id: string;
  localDate: string;
  status: "EM_ANDAMENTO" | "CONCLUIDO";
  generalNote: string;
  closedAt: string | null;
}

export interface DiaryEvaluation {
  id: string;
  diaryId: string;
  employeeId: string;
  paceGrade: string;
  qualityGrade: string;
  commitmentGrade: string;
  note: string;
}

export interface DiaryOccurrence {
  id: string;
  diaryId: string;
  employeeId: string;
  occurrenceType: OccurrenceType;
  description: string;
  createdAt: string;
}

export interface DiaryOtherActivity {
  id: string;
  diaryId: string;
  employeeId: string;
  activity: string;
  period: string;
  createdAt: string;
}

export interface CartItem {
  productId: string;
  packs: number;
  urgentDemandId: string | null;
}
