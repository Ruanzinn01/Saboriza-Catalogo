import { useId } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

interface ReadOnlyCodeFieldProps {
  label: string;
  value: string;
  placeholder?: string;
}

export function ReadOnlyCodeField({ label, value, placeholder = "Gerado ao salvar" }: ReadOnlyCodeFieldProps) {
  const id = useId();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Código copiado");
    } catch {
      toast.error("Não foi possível copiar o código");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink-900">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          value={value}
          disabled
          placeholder={value ? "" : placeholder}
          className={cn(
            "h-11 w-full rounded-xl border border-ink-900/15 bg-ink-900/5 px-4 pr-12 text-sm text-ink-700 outline-none disabled:cursor-not-allowed"
          )}
        />
        {value && (
          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-label="Copiar código"
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-900/10"
          >
            <Copy size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
