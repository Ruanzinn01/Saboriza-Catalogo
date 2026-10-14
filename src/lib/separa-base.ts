import { useLocation } from "react-router-dom";

export const ADMIN_SEPARA_BASE = "/admin/separa-confere";
export const OPERATOR_SEPARA_BASE = "/operacao/separa-confere";

export function separaBaseFor(pathname: string): string {
  return pathname.startsWith(OPERATOR_SEPARA_BASE) ? OPERATOR_SEPARA_BASE : ADMIN_SEPARA_BASE;
}

export function useSeparaBase(): string {
  return separaBaseFor(useLocation().pathname);
}

export function isOperatorBase(base: string): boolean {
  return base === OPERATOR_SEPARA_BASE;
}

export function orderPath(base: string, orderId: string): string {
  return isOperatorBase(base) ? `${base}/pedido/${orderId}` : `${base}/${orderId}`;
}

export function inventoryListPath(base: string): string {
  return isOperatorBase(base) ? `${base}/inventario` : `${base}?aba=inventario`;
}

export function inventoryItemPath(base: string, itemId: string): string {
  return `${base}/inventario/${itemId}`;
}

export function historyPath(base: string): string {
  return isOperatorBase(base) ? `${base}/historico` : `${base}?aba=historico`;
}
