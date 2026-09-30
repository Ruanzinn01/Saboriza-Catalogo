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

export interface FloorExecution {
  id: string;
  productId: string;
  productionReleaseId: string | null;
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
