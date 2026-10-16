import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useId } from "react";
import { cn } from "@/lib/cn";

const control =
  "min-h-11 w-full rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none transition-colors focus:border-forest-700 disabled:bg-forest-950/5 disabled:text-ink-muted";

interface FieldShellProps {
  label: string;
  required?: boolean;
  error?: string;
  help?: ReactNode;
  className?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

export function FieldShell({ label, required, error, help, className, children }: FieldShellProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-900">
        {label}
        {required && <b className="ml-0.5 text-red-600">*</b>}
      </label>
      {children(id, describedBy)}
      {error ? (
        <span id={`${id}-error`} role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : help ? (
        <span id={`${id}-help`} className="text-xs text-ink-muted">
          {help}
        </span>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & { label: string; error?: string; help?: ReactNode; className?: string; fieldClassName?: string };

export function TextField({ label, error, help, className, fieldClassName, required, ...props }: TextFieldProps) {
  return (
    <FieldShell label={label} required={required} error={error} help={help} className={className}>
      {(id, describedBy) => <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cn(control, error && "border-red-500", fieldClassName)} {...props} />}
    </FieldShell>
  );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & { label: string; error?: string; help?: ReactNode; className?: string; options: { value: string; label: string }[] };

export function SelectField({ label, error, help, className, options, required, ...props }: SelectFieldProps) {
  return (
    <FieldShell label={label} required={required} error={error} help={help} className={className}>
      {(id, describedBy) => (
        <select id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cn(control, "bg-white", error && "border-red-500")} {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & { label: string; error?: string; help?: ReactNode; className?: string };

export function TextAreaField({ label, error, help, className, required, ...props }: TextAreaFieldProps) {
  return (
    <FieldShell label={label} required={required} error={error} help={help} className={className}>
      {(id, describedBy) => <textarea id={id} rows={3} aria-describedby={describedBy} className={cn(control, "py-3", error && "border-red-500")} {...props} />}
    </FieldShell>
  );
}

export function CheckField({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm text-ink-900">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-forest-700" />
      {label}
    </label>
  );
}

export function SectionCard({ id, title, hint, step, children }: { id?: string; title: string; hint?: string; step?: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-forest-950">{title}</h2>
          {hint && <p className="text-xs text-ink-muted">{hint}</p>}
        </div>
        {step && <span className="font-mono text-[10px] tracking-widest text-ink-muted">{step}</span>}
      </div>
      {children}
    </section>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink-900">{label}</span>
      <div role="group" aria-label={label} className="flex rounded-xl bg-forest-950/5 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn("min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors", value === option.value ? "bg-white text-forest-950 shadow-sm" : "text-ink-700 hover:bg-white/60")}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
