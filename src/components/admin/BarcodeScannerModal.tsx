import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

const SCANNER_ELEMENT_ID = "produziu-registra-scanner";

export function BarcodeScannerModal({ open, onClose, onScan }: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let handled = false;
    setError(null);

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (handled) return;
            handled = true;
            onScanRef.current(decodedText);
          },
          () => {}
        )
        .catch(() => {
          if (!cancelled) setError("Não foi possível acessar a câmera. Verifique a permissão do navegador.");
        });
    });

    return () => {
      cancelled = true;
      scannerRef.current
        ?.stop()
        .then(() => scannerRef.current?.clear())
        .catch(() => {});
      scannerRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/70 p-4">
      <div role="dialog" aria-modal="true" aria-label="Leitor de código de barras ou QR" className="w-full max-w-sm rounded-3xl bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-forest-950">Aponte pro código de barras ou QR</p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar leitor"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-ink-900/5"
          >
            <X size={18} />
          </button>
        </div>
        <div id={SCANNER_ELEMENT_ID} className={cn("overflow-hidden rounded-2xl bg-ink-900/5", "aspect-square w-full")} />
        {error && (
          <p role="alert" className="mt-3 text-xs font-semibold text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
