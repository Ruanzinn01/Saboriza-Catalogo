import { type ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface ComboboxProps {
  label?: string;
  placeholder?: string;
  selectedLabel: string;
  disabled?: boolean;
  icon?: ReactNode;
  chevron?: boolean;
  fetchOptions: (query: string) => Promise<ComboboxOption[]>;
  onSelect: (option: ComboboxOption) => void;
}

export function Combobox({ label, placeholder, selectedLabel, disabled, icon, chevron, fetchOptions, onSelect }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetchOptions(query).then((result) => {
      if (active) setOptions(result);
    });
    return () => {
      active = false;
    };
  }, [open, query, fetchOptions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      {label && <span className="text-sm font-semibold text-ink-900">{label}</span>}
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/50">
          {icon ?? <Search size={16} />}
        </span>
        <input
          disabled={disabled}
          value={open ? query : selectedLabel}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 text-sm text-ink-900 outline-none focus:border-forest-700",
            chevron ? "pr-11" : "pr-4",
            disabled && "cursor-not-allowed bg-ink-900/5 text-ink-muted"
          )}
        />
        {chevron && <ChevronDown size={18} aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-700/60" />}
      </div>

      {open && options.length > 0 && (
        <div className="absolute top-full z-10 mt-1 flex max-h-64 w-full flex-col divide-y divide-forest-950/5 overflow-y-auto rounded-2xl border border-forest-950/10 bg-white shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onSelect(option);
                setOpen(false);
                setQuery("");
              }}
              className="flex flex-col items-start px-4 py-2.5 text-left hover:bg-forest-950/5"
            >
              <span className="text-sm font-semibold text-ink-900">{option.label}</span>
              {option.sublabel && <span className="text-xs text-ink-muted">{option.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
