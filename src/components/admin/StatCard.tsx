import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "danger" | "warning";
  className?: string;
}

const valueClasses = {
  default: "text-forest-950",
  danger: "text-red-600",
  warning: "text-amber-700",
};

export function StatCard({ label, value, hint, tone = "default", className }: StatCardProps) {
  return (
    <div className={cn("rounded-2xl border border-forest-950/10 bg-white p-4", className)}>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-extrabold leading-tight", valueClasses[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
