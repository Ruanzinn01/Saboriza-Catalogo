import { useLocation } from "react-router-dom";
import { OPERATOR_APPS } from "@/lib/operator-apps";

export const ADMIN_ENTREGA_BASE = "/admin/carrega-entrega";
export const OPERATOR_ENTREGA_BASE = OPERATOR_APPS.entrega.base;

export function entregaBaseFor(pathname: string): string {
  return pathname === OPERATOR_ENTREGA_BASE || pathname.startsWith(`${OPERATOR_ENTREGA_BASE}/`) ? OPERATOR_ENTREGA_BASE : ADMIN_ENTREGA_BASE;
}

export function useEntregaBase(): string {
  return entregaBaseFor(useLocation().pathname);
}
