import { type ReactNode } from "react";

interface FormCardProps {
  title: string;
  action?: ReactNode;
  id?: string;
  children: ReactNode;
}

export function FormCard({ title, action, id, children }: FormCardProps) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
