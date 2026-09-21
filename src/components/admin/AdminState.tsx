import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface AdminStateProps {
  variant: "loading" | "empty" | "error";
  message: string;
  onRetry?: () => void;
}

export function AdminState({ variant, message, onRetry }: AdminStateProps) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-forest-950/10 bg-white p-10 text-center"
    >
      {variant === "loading" && <Loader2 size={24} className="animate-spin text-forest-700" aria-hidden />}
      <p className={variant === "error" ? "text-sm font-semibold text-red-600" : "text-sm text-ink-muted"}>{message}</p>
      {variant === "error" && onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}
