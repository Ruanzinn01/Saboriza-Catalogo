import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ClipboardList, LayoutDashboard, LogOut, Package, Settings, Tag } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAdminAuthStore } from "@/store/admin-auth-store";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/produtos", label: "Produtos", icon: Package, end: false },
  { to: "/admin/categorias", label: "Categorias", icon: Tag, end: false },
  { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, end: false },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings, end: false },
];

export function AdminLayout() {
  const logout = useAdminAuthStore((state) => state.logout);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-cream-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-black/10 bg-forest-950 px-4 py-6 text-cream-50">
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
        <button
          onClick={() => {
            logout();
            navigate("/admin/login");
          }}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-cream-100/80 hover:bg-cream-50/10"
        >
          <LogOut size={18} />
          Sair
        </button>
      </aside>
      <main className="flex-1 overflow-x-auto p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
