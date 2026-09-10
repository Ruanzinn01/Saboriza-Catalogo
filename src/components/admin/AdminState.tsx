import { Loader2 } from "lucide-react";

interface AdminStateProps {
  variant: "loading" | "empty" | "error";
  message: string;
}

export function AdminState({ variant, message }: AdminStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-forest-950/10 bg-white p-10 text-center">
      {variant === "loading" && <Loader2 size={24} className="animate-spin text-forest-700" />}
      <p className={variant === "error" ? "text-sm font-semibold text-red-600" : "text-sm text-ink-700/60"}>{message}</p>
    </div>
  );
}
