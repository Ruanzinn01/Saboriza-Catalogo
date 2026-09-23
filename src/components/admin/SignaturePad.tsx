import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toBlob: () => Promise<Blob | null>;
  clear: () => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  function setupCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    // Reatribuir width/height (em vez de só clearRect) força o navegador a descartar
    // o bitmap inteiro e as transformações acumuladas — é o único jeito garantido
    // pela spec do canvas de limpar de verdade um contexto já escalado por dpr.
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0a2a1f";
  }

  useEffect(() => {
    setupCanvas();
  }, []);

  function pointerPos(e: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasStrokeRef.current) {
      hasStrokeRef.current = true;
      setHasStroke(true);
    }
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  function clear() {
    setupCanvas();
    hasStrokeRef.current = false;
    setHasStroke(false);
  }

  useImperativeHandle(ref, () => ({
    isEmpty: () => !hasStrokeRef.current,
    clear,
    toBlob: () =>
      new Promise((resolve) => {
        const canvas = canvasRef.current;
        if (!canvas) return resolve(null);
        canvas.toBlob((blob) => resolve(blob), "image/png");
      }),
  }));

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-48 w-full overflow-hidden rounded-2xl border-2 border-dashed border-ink-900/20 bg-white touch-none">
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {!hasStroke && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
            Assine aqui
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="flex min-h-11 items-center justify-center gap-2 self-start rounded-xl px-3 text-xs font-bold text-ink-muted hover:bg-ink-900/5"
      >
        <Eraser size={14} /> Limpar assinatura
      </button>
    </div>
  );
});
SignaturePad.displayName = "SignaturePad";
