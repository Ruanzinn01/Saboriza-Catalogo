import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  back?: { to: string; label: string };
  actions?: ReactNode;
}

export function PageHeader({ title, description, eyebrow, back, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            to={back.to}
            className="mb-1 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-forest-700 hover:underline"
          >
            <ChevronLeft size={14} /> {back.label}
          </Link>
        )}
        {eyebrow && <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold-600">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold text-forest-950">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
