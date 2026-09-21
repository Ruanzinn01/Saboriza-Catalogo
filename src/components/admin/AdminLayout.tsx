import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ClipboardCheck, ClipboardList, ExternalLink, LayoutGrid, LogOut, Menu, Warehouse } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { useOrdersStore } from "@/store/orders-store";
import { useSettingsStore } from "@/store/settings-store";
import { Sheet } from "@/components/ui/Sheet";
import { AdminNav, isNavItemActive, useNavBadges, type NavItem } from "@/components/admin/AdminNav";

const FLOOR_ROUTE = "/admin/produzir";

const TAB_ITEMS: NavItem[] = [
  { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, badge: "newOrders" },
  { to: FLOOR_ROUTE, label: "Produzir", icon: ClipboardCheck, highlight: true },
  { to: "/admin/estoque", label: "Estoque", icon: Warehouse, badge: "criticalStock", excludePrefixes: ["/admin/estoque/indicadores"] },
];

function UserBadge({ email, tone }: { email: string; tone: "dark" | "light" }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span
        aria-hidden
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold uppercase",
          tone === "dark" ? "bg-gold-500 text-forest-950" : "bg-forest-950 text-cream-50"
        )}
      >
        {email.charAt(0) || "A"}
      </span>
      <div className="min-w-0">
        <p className={cn("text-[10px] font-mono uppercase tracking-[0.2em]", tone === "dark" ? "text-gold-400/80" : "text-gold-600")}>Conectado</p>
        <p className={cn("truncate text-xs font-semibold", tone === "dark" ? "text-cream-100" : "text-ink-900")}>{email}</p>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const logout = useAdminAuthStore((state) => state.logout);
  const email = useAdminAuthStore((state) => state.session?.user.email ?? "");
  const fetchSettings = useSettingsStore((state) => state.fetchSettings);
  const ordersStatus = useOrdersStore((state) => state.status);
  const fetchOrders = useOrdersStore((state) => state.fetchOrders);
  const badges = useNavBadges();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const showTabBar = pathname !== FLOOR_ROUTE;

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (ordersStatus === "idle") fetchOrders();
  }, [ordersStatus, fetchOrders]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await logout();
    navigate("/admin/login");
  }

  const footerLinkClasses = "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors";

  return (
    <div className="flex h-dvh bg-cream-100">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-forest-950 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-cream-50"
      >
        Pular para o conteúdo
      </a>

      <aside className="hidden w-64 shrink-0 flex-col border-r border-black/10 bg-forest-950 text-cream-50 lg:flex">
        <div className="px-6 pb-4 pt-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-400">Admin</span>
          <p className="text-xl font-extrabold">Saboriza</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cream-100/50">Fábrica de temperos</p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <AdminNav variant="sidebar" />
        </div>

        <div className="flex flex-col gap-1 border-t border-cream-50/10 px-3 py-3">
          {email && <UserBadge email={email} tone="dark" />}
          <a href="/" target="_blank" rel="noreferrer" className={cn(footerLinkClasses, "text-cream-100/85 hover:bg-cream-50/5 hover:text-cream-50")}>
            <ExternalLink size={18} />
            Voltar ao site
          </a>
          <button onClick={() => void handleLogout()} className={cn(footerLinkClasses, "text-cream-100/85 hover:bg-cream-50/5 hover:text-cream-50")}>
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-black/10 bg-forest-950 px-4 py-3 text-cream-50 lg:hidden">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-400">Admin</span>
            <p className="text-lg font-extrabold leading-none">Saboriza</p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-cream-50/10"
          >
            <Menu size={20} />
          </button>
        </header>

        <main id="conteudo" className="min-h-0 flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
          {showTabBar && <div aria-hidden className="h-[calc(4.5rem+env(safe-area-inset-bottom))] lg:hidden" />}
        </main>

        {showTabBar && (
          <nav
            aria-label="Atalhos"
            className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-forest-950/10 bg-cream-50/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-md lg:hidden"
          >
            {TAB_ITEMS.map((item) => {
              const active = isNavItemActive(pathname, item);
              const Icon = item.icon;
              const count = item.badge ? badges[item.badge] : 0;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors",
                    active ? "text-forest-950" : "text-ink-muted"
                  )}
                >
                  <span
                    className={cn(
                      "relative flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                      active ? "bg-gold-500/25" : item.highlight && "bg-forest-950/5"
                    )}
                  >
                    <Icon size={20} />
                    {count > 0 && (
                      <span
                        className={cn(
                          "absolute -right-0.5 -top-1 min-w-4 rounded-full px-1 py-0.5 text-center text-[10px] font-bold leading-none",
                          item.badge === "criticalStock" ? "bg-red-600 text-white" : "bg-gold-500 text-forest-950"
                        )}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </span>
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-ink-muted"
            >
              <span className="flex h-8 w-12 items-center justify-center">
                <LayoutGrid size={20} />
              </span>
              Mais
            </button>
          </nav>
        )}
      </div>

      <Sheet open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} title="Menu">
        <div className="flex flex-col gap-5">
          {email && <UserBadge email={email} tone="light" />}
          <AdminNav variant="sheet" onNavigate={() => setMobileMenuOpen(false)} />
          <div className="flex flex-col gap-1 border-t border-ink-900/10 pt-3">
            <a href="/" target="_blank" rel="noreferrer" className={cn(footerLinkClasses, "text-ink-900 hover:bg-ink-900/5")}>
              <ExternalLink size={18} />
              Voltar ao site
            </a>
            <button onClick={() => void handleLogout()} className={cn(footerLinkClasses, "text-ink-900 hover:bg-ink-900/5")}>
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
