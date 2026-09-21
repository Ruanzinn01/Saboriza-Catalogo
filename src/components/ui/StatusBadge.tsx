import { cn } from "@/lib/cn";

export type StatusTone = "ok" | "warning" | "critical" | "out" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  ok: "bg-forest-700/10 text-forest-800",
  warning: "bg-amber-500/15 text-amber-800",
  critical: "bg-red-500/10 text-red-700",
  out: "bg-red-600 text-white",
  neutral: "bg-ink-900/5 text-ink-700",
};

interface StatusBadgeProps {
  tone: StatusTone;
  children: string;
  className?: string;
}

export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", toneClasses[tone], className)}>
      {children}
    </span>
  );
}
