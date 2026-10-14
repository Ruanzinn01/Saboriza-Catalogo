import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePurchaseStore } from "@/store/purchase-store";
import type { LaunchDraft } from "./draft";

export type DraftSaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

const SAVE_DELAY_MS = 1200;

function isEmptyDraft(draft: LaunchDraft): boolean {
  return draft.cart.length === 0 && draft.supplierId === "" && draft.partnerId === "" && draft.documentRef === "" && draft.observations === "";
}

/** Salva o rascunho no servidor a cada alteração (com atraso curto), com controle de versão:
 * duas abas não sobrescrevem uma à outra em silêncio. Dados ficam também no navegador (draft.ts). */
export function usePurchaseDraftSync(
  snapshot: LaunchDraft,
  supplierLabel: string,
  initial: { id: string | null; version: number },
  apply: (draft: LaunchDraft) => void
) {
  const saveDraftRemote = usePurchaseStore((s) => s.saveDraft);
  const loadDraftRemote = usePurchaseStore((s) => s.loadDraft);
  const closeDraftRemote = usePurchaseStore((s) => s.closeDraft);
  const fetchDrafts = usePurchaseStore((s) => s.fetchDrafts);

  const [status, setStatus] = useState<DraftSaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [draftId, setDraftId] = useState<string | null>(initial.id);
  const idRef = useRef<string | null>(initial.id);
  const versionRef = useRef(initial.version);
  const inFlight = useRef(false);
  const pending = useRef(false);
  const latest = useRef({ snapshot, supplierLabel });
  const conflictRef = useRef(false);
  latest.current = { snapshot, supplierLabel };

  const key = JSON.stringify(snapshot);

  const flush = useCallback(async () => {
    if (conflictRef.current) return;
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    const { snapshot: current, supplierLabel: label } = latest.current;
    if (isEmptyDraft(current)) return;
    inFlight.current = true;
    setStatus("saving");
    const result = await saveDraftRemote({
      draftId: idRef.current,
      version: versionRef.current,
      supplierLabel: label,
      documentRef: current.documentRef,
      payload: current,
    });
    inFlight.current = false;
    if ("error" in result) {
      if (result.conflict) {
        conflictRef.current = true;
        setStatus("conflict");
      } else {
        setStatus("error");
      }
      return;
    }
    idRef.current = result.draftId;
    versionRef.current = result.version;
    setDraftId(result.draftId);
    setSavedAt(new Date());
    setStatus("saved");
    if (pending.current) {
      pending.current = false;
      void flush();
    }
  }, [saveDraftRemote]);

  useEffect(() => {
    const timer = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [key, flush]);

  useEffect(() => {
    void fetchDrafts();
  }, [fetchDrafts]);

  /** Retoma um rascunho do servidor (próprio ou de outra sessão). */
  const resume = useCallback(
    async (id: string) => {
      const loaded = await loadDraftRemote(id);
      if (!loaded) {
        toast.error("Rascunho não encontrado ou já finalizado.");
        return;
      }
      idRef.current = id;
      versionRef.current = loaded.version;
      conflictRef.current = false;
      setDraftId(id);
      setStatus("saved");
      apply(loaded.payload as LaunchDraft);
      toast.success("Rascunho recuperado.");
    },
    [loadDraftRemote, apply]
  );

  /** Conflito entre abas: carrega a versão mais nova do servidor. */
  const reloadNewest = useCallback(async () => {
    if (idRef.current) await resume(idRef.current);
  }, [resume]);

  /** Começa um lançamento novo sem apagar o rascunho anterior do servidor. */
  const startNew = useCallback(() => {
    idRef.current = null;
    versionRef.current = 0;
    conflictRef.current = false;
    setDraftId(null);
    setStatus("idle");
  }, []);

  const finish = useCallback(
    async (state: "DONE" | "DISCARDED") => {
      const id = idRef.current;
      conflictRef.current = true; // impede novo salvamento do que acabou de ser registrado
      if (id) await closeDraftRemote(id, state);
      idRef.current = null;
      versionRef.current = 0;
      setDraftId(null);
      setStatus("idle");
      conflictRef.current = false;
    },
    [closeDraftRemote]
  );

  return { status, savedAt, draftId, version: versionRef, saveNow: flush, resume, reloadNewest, startNew, finish };
}
