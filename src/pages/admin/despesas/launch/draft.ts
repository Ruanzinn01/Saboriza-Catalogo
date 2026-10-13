import type { LaunchKind } from "@/store/expense-launch-store";
import type { CartLine } from "./types";

const DRAFT_KEY = "oris360:nova-despesa-draft";

export interface LaunchDraft {
  kind: LaunchKind;
  supplierId: string;
  partnerId: string;
  competence: string;
  documentRef: string;
  documentSeries: string;
  documentIssueDate: string;
  documentAccessKey: string;
  batch: string;
  expiryDate: string;
  cart: CartLine[];
  freight: string;
  discount: string;
  received: boolean;
  paymentMethod: string;
  paymentCondition: "term" | "cash";
  installmentCount: number;
  baseDate: string;
  recipientKey: string;
  recipientHolder: string;
  observations: string;
}

export function loadDraft(): LaunchDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as LaunchDraft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: LaunchDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // sessionStorage indisponível (modo privado, cota cheia) — segue sem rascunho
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // sem rascunho para limpar
  }
}
