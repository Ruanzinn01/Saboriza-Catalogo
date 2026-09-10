import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  destructive?: boolean;
  extraAction?: { label: string; onClick: () => void };
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  destructive = false,
  extraAction,
}: ConfirmDialogProps) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return createPortal(
    <div className={cn("fixed inset-0 z-[60] flex items-center justify-center p-4", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <div
        className={cn(
          "absolute inset-0 bg-ink-900/50 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full max-w-sm rounded-3xl bg-cream-50 p-6 shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        )}
      >
        <h2 className="text-lg font-bold text-ink-900">{title}</h2>
        <div className="mt-2 text-sm text-ink-700/70">{description}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          {extraAction && (
            <Button type="button" variant="secondary" size="sm" onClick={extraAction.onClick}>
              {extraAction.label}
            </Button>
          )}
          {onConfirm && (
            <Button
              type="button"
              size="sm"
              onClick={onConfirm}
              className={
                destructive
                  ? "from-red-600 to-red-700 text-cream-50 shadow-red-700/20 hover:from-red-500 hover:to-red-600"
                  : undefined
              }
            >
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
