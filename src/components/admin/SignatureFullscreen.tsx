import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SignaturePad, type SignaturePadHandle } from "@/components/admin/SignaturePad";

interface SignatureFullscreenProps {
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

export function SignatureFullscreen({ onCancel, onConfirm }: SignatureFullscreenProps) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [padKey, setPadKey] = useState(0);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void (screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> }).lock?.("landscape")?.catch(() => undefined);
    const resetPad = () => setPadKey((key) => key + 1);
    window.addEventListener("resize", resetPad);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("resize", resetPad);
      screen.orientation?.unlock?.();
    };
  }, []);

  async function handleConfirm() {
    if (!padRef.current || padRef.current.isEmpty()) {
      setEmpty(true);
      return;
    }
    const blob = await padRef.current.toBlob();
    if (blob) onConfirm(blob);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col gap-3 bg-cream-50 p-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-ink-900">Assinatura do responsável</p>
        {empty && <span className="text-xs font-semibold text-red-600">Faça a assinatura antes de concluir</span>}
      </div>
      <SignaturePad key={padKey} ref={padRef} className="min-h-0 flex-1" />
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="secondary" className="flex-[2]" onClick={() => void handleConfirm()}>
          Concluir assinatura
        </Button>
      </div>
    </div>
  );
}
