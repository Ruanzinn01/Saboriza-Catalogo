import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Archive,
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Database,
  Factory,
  LayoutDashboard,
  Minus,
  Package,
  PackageCheck,
  PackageSearch,
  Plus,
  Settings,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { healthLevel } from "@/lib/stock-insights";
import { slugify } from "@/lib/slugify";
import { useCatalogStore } from "@/store/catalog-store";
import { useOrdersStore } from "@/store/orders-store";

export type NavBadgeKey = "newOrders" | "criticalStock" | "pendingSeparation" | "pendingFulfillment";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  excludePrefixes?: string[];
  alsoActiveFor?: string[];
  badge?: NavBadgeKey;
  highlight?: boolean;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão geral",
    icon: LayoutDashboard,
    items: [
      { to: "/admin", label: "Indicadores", icon: TrendingUp, end: true },
      { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, badge: "newOrders" },
    ],
  },
  {
    label: "Cadastros",
    icon: Database,
    items: [
      { to: "/admin/produtos", label: "Produtos", icon: Package, alsoActiveFor: ["/admin/categorias"] },
      { to: "/admin/clientes", label: "Clientes", icon: Users },
      { to: "/admin/fornecedores", label: "Fornecedores", icon: Truck },
    ],
  },
  {
    label: "Fábrica",
    icon: Building2,
    items: [
      { to: "/admin/materias-primas", label: "Matérias-primas", icon: Boxes },
      { to: "/admin/produzir", label: "Produziu, Registra", icon: ClipboardCheck, highlight: true },
      { to: "/admin/producao", label: "Painel de produção", icon: Factory },
    ],
  },
  {
    label: "Estoque",
    icon: Archive,
    items: [
      { to: "/admin/estoque", label: "Estoque", icon: Warehouse, excludePrefixes: ["/admin/estoque/indicadores"], badge: "criticalStock" },
      { to: "/admin/estoque/indicadores", label: "Indicadores de estoque", icon: BarChart3 },
    ],
  },
];

export const STANDALONE_NAV_ITEMS: NavItem[] = [
  { to: "/admin/separa-confere", label: "Separa Confere", icon: PackageSearch, badge: "pendingSeparation" },
  { to: "/admin/carrega-entrega", label: "Carrega Entrega", icon: PackageCheck, badge: "pendingFulfillment" },
];

export const SETTINGS_ITEM: NavItem = { to: "/admin/configuracoes", label: "Configurações", icon: Settings };

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.excludePrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return false;
  if (item.alsoActiveFor?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return true;
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

const BADGE_DESCRIPTIONS: Record<NavBadgeKey, string> = {
  newOrders: "pedidos novos",
  criticalStock: "itens críticos",
  pendingSeparation: "pedidos aguardando separação",
  pendingFulfillment: "pedidos aguardando carregamento ou entrega",
};

function badgeDescription(key?: NavBadgeKey): string {
  return key ? BADGE_DESCRIPTIONS[key] : "";
}

function activeGroupFor(pathname: string): NavGroup | undefined {
  return NAV_GROUPS.find((group) => group.items.some((item) => isNavItemActive(pathname, item)));
}

export function useNavBadges(): Record<NavBadgeKey, number> {
  const newOrders = useOrdersStore((state) => state.orders.filter((order) => order.status === "NEW").length);
  const pendingSeparation = useOrdersStore(
    (state) => state.orders.filter((order) => order.status === "CONFIRMED" && !order.separationFinishedAt).length
  );
  const pendingFulfillment = useOrdersStore((state) => state.orders.filter((order) => order.status === "COMPLETED").length);
  const criticalStock = useCatalogStore((state) => state.products.filter((product) => product.active && healthLevel(product) === "red").length);
  return { newOrders, criticalStock, pendingSeparation, pendingFulfillment };
}

type NavVariant = "sidebar" | "sheet";

const variantClasses: Record<
  NavVariant,
  { item: string; active: string; idle: string; group: string; groupHover: string; badge: Record<NavBadgeKey, string>; dot: string; divider: string }
> = {
  sidebar: {
    item: "text-cream-100/85",
    active: "bg-cream-50/10 text-cream-50 before:bg-gold-500",
    idle: "hover:bg-cream-50/5 hover:text-cream-50",
    group: "text-cream-50 before:bg-gold-500/70",
    groupHover: "hover:bg-cream-50/5",
    badge: {
      newOrders: "bg-gold-500 text-forest-950",
      criticalStock: "bg-red-500 text-white",
      pendingSeparation: "bg-blue-500 text-white",
      pendingFulfillment: "bg-blue-500 text-white",
    },
    dot: "bg-gold-500",
    divider: "border-cream-50/10",
  },
  sheet: {
    item: "text-ink-900",
    active: "bg-forest-950/5 text-forest-950 before:bg-gold-500",
    idle: "hover:bg-ink-900/5",
    group: "text-ink-900 before:bg-gold-600/70",
    groupHover: "hover:bg-ink-900/5",
    badge: {
      newOrders: "bg-gold-500 text-forest-950",
      criticalStock: "bg-red-600 text-white",
      pendingSeparation: "bg-blue-600 text-white",
      pendingFulfillment: "bg-blue-600 text-white",
    },
    dot: "bg-gold-600",
    divider: "border-ink-900/10",
  },
};

function storageKey(variant: NavVariant) {
  return `saboriza:admin:nav-open-groups:${variant}`;
}

function loadOpenGroups(variant: NavVariant): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey(variant));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : null;
  } catch {
    return null;
  }
}

function saveOpenGroups(variant: NavVariant, labels: string[]) {
  try {
    localStorage.setItem(storageKey(variant), JSON.stringify(labels));
  } catch {
    // localStorage indisponível (aba privada, etc.): o estado só não persiste entre sessões
  }
}

interface AdminNavProps {
  variant: NavVariant;
  onNavigate?: () => void;
}

export function AdminNav({ variant, onNavigate }: AdminNavProps) {
  const { pathname } = useLocation();
  const badges = useNavBadges();
  const styles = variantClasses[variant];

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const stored = loadOpenGroups(variant);
    if (stored) return new Set(stored);
    const active = activeGroupFor(pathname);
    return new Set(active ? [active.label] : []);
  });

  useEffect(() => {
    const active = activeGroupFor(pathname);
    if (active && !openGroups.has(active.label)) {
      setOpenGroups((prev) => new Set(prev).add(active.label));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    saveOpenGroups(variant, [...openGroups]);
  }, [variant, openGroups]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function renderItem(item: NavItem) {
    const active = isNavItemActive(pathname, item);
    const Icon = item.icon;
    const badgeCount = item.badge ? badges[item.badge] : 0;
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-[3px] before:rounded-full",
          styles.item,
          active ? styles.active : styles.idle
        )}
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            item.highlight && "bg-gold-500/20 text-gold-500"
          )}
        >
          <Icon size={18} />
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {badgeCount > 0 && (
          <span aria-label={`${badgeCount} ${badgeDescription(item.badge)}`}
            className={cn("min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold leading-none", item.badge && styles.badge[item.badge])}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </Link>
    );
  }

  return (
    <nav aria-label="Menu do administrador" className="flex flex-col gap-1.5">
      {NAV_GROUPS.map((group) => {
        const isOpen = openGroups.has(group.label);
        const panelId = `nav-panel-${variant}-${slugify(group.label)}`;
        const pendingBadge = group.items.some((item) => item.badge && badges[item.badge] > 0);
        const inertProps = (isOpen ? {} : { inert: "" }) as Record<string, string>;

        return (
          <div key={group.label} className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => toggleGroup(group.label)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className={cn(
                "relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition-colors before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-full",
                styles.group,
                styles.groupHover
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
                <group.icon size={18} />
              </span>
              <span className="flex-1 truncate">{group.label}</span>
              {!isOpen && pendingBadge && <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", styles.dot)} />}
              {isOpen ? <Minus size={14} aria-hidden className="shrink-0" /> : <Plus size={14} aria-hidden className="shrink-0" />}
            </button>
            <div
              id={panelId}
              className={cn("grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
            >
              <div className="flex flex-col gap-1 overflow-hidden" {...inertProps}>
                {group.items.map(renderItem)}
              </div>
            </div>
          </div>
        );
      })}
      <div className={cn("mt-1 flex flex-col gap-1 border-t pt-2", styles.divider)}>
        {STANDALONE_NAV_ITEMS.map(renderItem)}
        {renderItem(SETTINGS_ITEM)}
      </div>
    </nav>
  );
}
