import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ClipboardList, ExternalLink, LayoutDashboard, LogOut, Menu, Package, Settings, Tag, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { useSettingsStore } from "@/store/settings-store";
import { Sheet } from "@/components/ui/Sheet";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/produtos", label: "Produtos", icon: Package, end: false },
  { to: "/admin/categorias", label: "Categorias", icon: Tag, end: false },
  { to: "/admin/clientes", label: "Clientes", icon: Users, end: false },
  { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, end: false },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings, end: false },
];

export function AdminLayout() {
  const logout = useAdminAuthStore((state) => state.logout);
  const fetchSettings = useSettingsStore((state) => state.fetchSettings);
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  function handleLogout() {
    logout();
    navigate("/admin/login");
  }

  return (
    <div className="flex h-screen bg-cream-100">
      <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-black/10 bg-forest-950 px-4 py-6 text-cream-50 lg:flex">
        <div className="mb-8 px-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-400">Admin</span>
          <p className="text-xl font-extrabold">Saboriza</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  isActive ? "bg-gold-500 text-forest-950" : "text-cream-100/80 hover:bg-cream-50/10"
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-cream-100/80 hover:bg-cream-50/10"
        >
          <ExternalLink size={18} />
          Voltar ao site
        </a>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-cream-100/80 hover:bg-cream-50/10"
        >
          <LogOut size={18} />
          Sair
        </button>
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
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <Sheet open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} title="Menu">
        <nav className="flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  isActive ? "bg-gold-500 text-forest-950" : "text-ink-900 hover:bg-ink-900/5"
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-900 hover:bg-ink-900/5"
          >
            <ExternalLink size={18} />
            Voltar ao site
          </a>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-900 hover:bg-ink-900/5"
          >
            <LogOut size={18} />
            Sair
          </button>
        </nav>
      </Sheet>
    </div>
  );
}
