import { useEffect } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { ClipboardList, History, LayoutGrid, LogOut, ScanBarcode, WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { useOnline } from "@/lib/use-online";
import { OPERATOR_APPS, OPERATOR_HUB } from "@/lib/operator-apps";
import { OPERATOR_SEPARA_BASE } from "@/lib/separa-base";
import { useAccessStore } from "@/store/access-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { OperatorNoAccess } from "./OperatorAppShell";
import { useInstallableIdentity } from "./use-installable-identity";

const TABS = [
  {
    to: OPERATOR_SEPARA_BASE,
    label: "Pedidos",
    icon: ClipboardList,
    match: (path: string) => path === OPERATOR_SEPARA_BASE || path.startsWith(`${OPERATOR_SEPARA_BASE}/pedido`),
  },
  {
    to: `${OPERATOR_SEPARA_BASE}/inventario`,
    label: "Inventário",
    icon: ScanBarcode,
    match: (path: string) => path.startsWith(`${OPERATOR_SEPARA_BASE}/inventario`),
  },
  {
    to: `${OPERATOR_SEPARA_BASE}/historico`,
    label: "Histórico",
    icon: History,
    match: (path: string) => path.startsWith(`${OPERATOR_SEPARA_BASE}/historico`),
  },
];

/** Área operacional: sem menu global, sem Produzir/Estoque/Mais e sem caminho de volta ao portal. */
export function OperatorShell() {
  const { pathname } = useLocation();
  const online = useOnline();
  const isAuthenticated = useAdminAuthStore((state) => state.isAuthenticated);
  const isLoading = useAdminAuthStore((state) => state.isLoading);
  const operatorName = useAdminAuthStore((state) => state.session?.user.user_metadata?.name || state.session?.user.email || "");
  const logout = useAdminAuthStore((state) => state.logout);
  const accessStatus = useAccessStore((state) => state.status);
  const apps = useAccessStore((state) => state.apps);
  const fetchAccess = useAccessStore((state) => state.fetch);
  useInstallableIdentity(OPERATOR_APPS.separa_confere);

  useEffect(() => {
    if (isAuthenticated && accessStatus === "idle") void fetchAccess();
  }, [isAuthenticated, accessStatus, fetchAccess]);

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to={`${OPERATOR_SEPARA_BASE}/entrar`} replace />;
  if (accessStatus === "idle" || accessStatus === "loading") return null;
  if (accessStatus === "error" || !apps.includes("separa_confere")) return <OperatorNoAccess appName={OPERATOR_APPS.separa_confere.name} />;

  return (
    <div className="flex h-dvh flex-col bg-cream-100">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-black/10 bg-forest-950 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-cream-50">
        <div className="min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-400">Óris 360</span>
          <p className="truncate text-lg font-extrabold leading-none">Separa Confere</p>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden max-w-[10rem] truncate text-xs text-cream-100/80 sm:block">{operatorName}</span>
          {apps.length > 1 && (
            <Link to={OPERATOR_HUB} aria-label="Trocar de app" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-cream-50/10">
              <LayoutGrid size={18} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Sair"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-cream-50/10"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {!online && (
        <div role="alert" className="flex shrink-0 items-center gap-2 bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900">
          <WifiOff size={14} /> Sem conexão. Não é possível carregar nem confirmar nada agora; nenhuma contagem fica guardada no aparelho.
        </div>
      )}

      <main id="conteudo" className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <Outlet />
        <div aria-hidden className="h-[calc(4.5rem+env(safe-area-inset-bottom))]" />
      </main>

      <nav
        aria-label="Navegação do Separa Confere"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-forest-950/10 bg-cream-50/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-md"
      >
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={active ? "page" : undefined}
              className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors", active ? "text-forest-950" : "text-ink-muted")}
            >
              <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", active && "bg-gold-500/25")}>
                <Icon size={20} />
              </span>
              <span className={cn(active && "underline underline-offset-4")}>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
