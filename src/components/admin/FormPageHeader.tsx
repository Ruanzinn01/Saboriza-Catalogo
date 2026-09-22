import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  to?: string;
}

interface FormPageHeaderProps {
  title: string;
  crumbs: Crumb[];
  children?: ReactNode;
}

export function FormPageHeader({ title, crumbs, children }: FormPageHeaderProps) {
  const trail: Crumb[] = [{ label: "Início", to: "/admin" }, ...crumbs];
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950 sm:text-3xl">{title}</h1>
        <nav aria-label="Trilha de navegação" className="mt-1 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
          {trail.map((crumb, index) => {
            const last = index === trail.length - 1;
            return (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {crumb.to && !last ? (
                  <Link to={crumb.to} className="hover:text-forest-800 hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined}>{crumb.label}</span>
                )}
                {!last && <ChevronRight size={12} aria-hidden />}
              </span>
            );
          })}
        </nav>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
