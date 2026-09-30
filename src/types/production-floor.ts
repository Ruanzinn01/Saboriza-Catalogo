export type FloorExecutionStatus = "DISPONIVEL" | "EM_ANDAMENTO" | "PAUSADO" | "CONCLUIDO" | "CANCELADO";

export interface ProductionRelease {
  id: string;
  productId: string;
  requestedPacks: number;
  requestedUnits: number;
  reason: string | null;
  note: string | null;
  urgentDemandId: string | null;
  origin: "MANUAL" | "PLANO";
  createdAt: string;
}

export interface ProductionRoute {
  id: string;
  productId: string;
  version: number;
  status: "ATIVA" | "ARQUIVADA";
  createdAt: string;
}

export interface ProductionRouteStage {
  id: string;
  routeId: string;
  sequenceOrder: number;
  name: string;
}

export interface ProductionPlan {
  id: string;
  productId: string;
  plannedDate: string;
  plannedPacks: number;
  status: "PENDENTE" | "LIBERADO" | "CANCELADO";
  productionReleaseId: string | null;
  createdAt: string;
}

export interface FloorExecution {
  id: string;
  productId: string;
  productionReleaseId: string | null;
  routeId: string | null;
  routeVersion: number | null;
  routeVersionLabel: string;
  status: FloorExecutionStatus;
  targetQuantity: number;
  operationalQuantity: number;
  assumedByEmployeeId: string | null;
  assumedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  productionRecordId: string | null;
  createdAt: string;
  updatedAt: string;
}
