import { cn } from "@/lib/cn";

interface ActiveStatusSelectProps {
  value: boolean;
  onChange: (active: boolean) => void;
  ariaLabel: string;
}

export function ActiveStatusSelect({ value, onChange, ariaLabel }: ActiveStatusSelectProps) {
  return (
    <select
      aria-label={ariaLabel}
      value={value ? "active" : "inactive"}
      onChange={(e) => onChange(e.target.value === "active")}
      className={cn(
        "h-9 rounded-full border px-3 text-sm font-semibold outline-none",
        value ? "border-forest-700/30 bg-forest-700/10 text-forest-800" : "border-ink-900/20 bg-ink-900/5 text-ink-700"
      )}
    >
      <option value="active">Ativo</option>
      <option value="inactive">Inativo</option>
    </select>
  );
}
