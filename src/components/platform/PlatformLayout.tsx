import { Link, Outlet, useNavigate } from "react-router-dom";
import { LayoutGrid, LogOut, ShieldCheck } from "lucide-react";
import { useAdminAuthStore } from "@/store/admin-auth-store";

export function PlatformLayout() {
  const logout = useAdminAuthStore((state) => state.logout);
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/admin/login");
  }

  return (
    <div className="min-h-screen bg-forest-950 text-cream-50">
      <header className="flex items-center justify-between border-b border-cream-50/10 px-6 py-4">
        <Link to="/platform" className="flex items-center gap-2 font-extrabold">
          <ShieldCheck size={20} className="text-gold-400" />
          Oris360 · Plataforma
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/admin" className="flex items-center gap-1.5 text-sm text-cream-50/70 hover:text-cream-50">
            <LayoutGrid size={16} /> Painel Saboriza
          </Link>
          <button onClick={() => void handleLogout()} className="flex items-center gap-1.5 text-sm text-cream-50/70 hover:text-cream-50">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
