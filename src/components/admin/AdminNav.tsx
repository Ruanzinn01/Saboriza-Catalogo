import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  Factory,
  Package,
  Settings,
  Tag,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { healthLevel } from "@/lib/stock-insights";
import { useCatalogStore } from "@/store/catalog-store";
import { useOrdersStore } from "@/store/orders-store";

export type NavBadgeKey = "newOrders" | "criticalStock";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  excludePrefixes?: string[];
  badge?: NavBadgeKey;
  highlight?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { to: "/admin", label: "Indicadores", icon: TrendingUp, end: true },
      { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, badge: "newOrders" },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { to: "/admin/produtos", label: "Produtos", icon: Package },
      { to: "/admin/categorias", label: "Categorias", icon: Tag },
      { to: "/admin/clientes", label: "Clientes", icon: Users },
      { to: "/admin/fornecedores", label: "Fornecedores", icon: Truck },
    ],
  },
  {
    label: "Fábrica",
    items: [
      { to: "/admin/materias-primas", label: "Matérias-primas", icon: Boxes },
      { to: "/admin/produzir", label: "Produziu, Registra", icon: ClipboardCheck, highlight: true },
      { to: "/admin/producao", label: "Painel de produção", icon: Factory },
    ],
  },
  {
    label: "Estoque",
    items: [
      { to: "/admin/estoque", label: "Estoque", icon: Warehouse, excludePrefixes: ["/admin/estoque/indicadores"], badge: "criticalStock" },
      { to: "/admin/estoque/indicadores", label: "Indicadores de estoque", icon: BarChart3 },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { to: "/admin/configuracoes", label: "Configurações", icon: Settings };

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.excludePrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return false;
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function useNavBadges(): Record<NavBadgeKey, number> {
  const newOrders = useOrdersStore((state) => state.orders.filter((order) => order.status === "NEW").length);
  const criticalStock = useCatalogStore((state) => state.products.filter((product) => product.active && healthLevel(product) === "red").length);
  return { newOrders, criticalStock };
}

type NavVariant = "sidebar" | "sheet";

const variantClasses: Record<NavVariant, { item: string; active: string; idle: string; group: string; badge: Record<NavBadgeKey, string> }> = {
  sidebar: {
    item: "text-cream-100/85",
    active: "bg-cream-50/10 text-cream-50 before:bg-gold-500",
    idle: "hover:bg-cream-50/5 hover:text-cream-50",
    group: "text-gold-400/80",
    badge: { newOrders: "bg-gold-500 text-forest-950", criticalStock: "bg-red-500 text-white" },
  },
  sheet: {
    item: "text-ink-900",
    active: "bg-forest-950/5 text-forest-950 before:bg-gold-500",
    idle: "hover:bg-ink-900/5",
    group: "text-gold-600",
    badge: { newOrders: "bg-gold-500 text-forest-950", criticalStock: "bg-red-600 text-white" },
  },
};

interface AdminNavProps {
  variant: NavVariant;
  onNavigate?: () => void;
}

export function AdminNav({ variant, onNavigate }: AdminNavProps) {
  const { pathname } = useLocation();
  const badges = useNavBadges();
  const styles = variantClasses[variant];

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
          <span
            aria-label={`${badgeCount} ${item.badge === "newOrders" ? "pedidos novos" : "itens críticos"}`}
            className={cn("min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold leading-none", item.badge && styles.badge[item.badge])}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </Link>
    );
  }

  return (
    <nav aria-label="Menu do administrador" className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className={cn("px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em]", styles.group)}>{group.label}</p>
          {group.items.map(renderItem)}
        </div>
      ))}
      <div className="flex flex-col gap-1">{renderItem(SETTINGS_ITEM)}</div>
    </nav>
  );
}
