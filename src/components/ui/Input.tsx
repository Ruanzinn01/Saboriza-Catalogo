import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-sm font-semibold text-ink-900">{label}</span>}
      <input
        ref={ref}
        id={id}
        className={cn(
          "h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none transition-colors focus:border-forest-700",
          error && "border-red-500",
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
);
Input.displayName = "Input";
