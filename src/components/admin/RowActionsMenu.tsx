import { type ReactNode, useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/cn";

interface RowActionsMenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

interface RowActionsMenuProps {
  items: RowActionsMenuItem[];
}

export function RowActionsMenu({ items }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label="Mais ações"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-700/60 hover:bg-ink-900/5"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 min-w-[180px] rounded-2xl border border-forest-950/10 bg-white p-1.5 shadow-xl">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold",
                item.destructive ? "text-red-600 hover:bg-red-50" : "text-ink-900 hover:bg-ink-900/5"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
