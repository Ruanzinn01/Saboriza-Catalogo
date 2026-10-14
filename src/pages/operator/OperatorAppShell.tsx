import { useEffect } from "react";
import { Link, Navigate, Outlet } from "react-router-dom";
import { LayoutGrid, LogOut, WifiOff } from "lucide-react";
import { useOnline } from "@/lib/use-online";
import { OPERATOR_APPS, OPERATOR_HUB, type OperatorAppId, homeFor } from "@/lib/operator-apps";
import { useAccessStore } from "@/store/access-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { useInstallableIdentity } from "./use-installable-identity";

export function OperatorNoAccess({ appName }: { appName: string }) {
  const logout = useAdminAuthStore((state) => state.logout);
  const apps = useAccessStore((state) => state.apps);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream-100 px-4">
      <div role="alert" className="w-full max-w-sm rounded-3xl bg-cream-50 p-8 text-center shadow-xl">
        <h1 className="text-xl font-extrabold text-forest-950">Você não tem acesso a esta área.</h1>
        <p className="mt-2 text-sm text-ink-700/80">Sua conta não está autorizada a usar o {appName}. Fale com quem administra o sistema.</p>
        <div className="mt-6 flex flex-col gap-2">
          {apps.length > 0 && (
            <Link to={homeFor(apps)} className="flex min-h-11 items-center justify-center rounded-2xl bg-forest-950 px-4 text-sm font-bold text-cream-50">
              Ir para meus apps
            </Link>
          )}
          <button type="button" onClick={() => void logout()} className="min-h-11 rounded-2xl border border-forest-950/15 px-4 text-sm font-bold text-forest-950">
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

/** Área operacional isolada: sem menu global, sem caminho para o painel administrativo. A autorização real está no banco. */
export function OperatorAppShell({ appId, fullBleed = false }: { appId: OperatorAppId; fullBleed?: boolean }) {
  const app = OPERATOR_APPS[appId];
  const online = useOnline();
  const isAuthenticated = useAdminAuthStore((state) => state.isAuthenticated);
  const isLoading = useAdminAuthStore((state) => state.isLoading);
  const operatorName = useAdminAuthStore((state) => state.session?.user.user_metadata?.name || state.session?.user.email || "");
  const logout = useAdminAuthStore((state) => state.logout);
  const accessStatus = useAccessStore((state) => state.status);
  const apps = useAccessStore((state) => state.apps);
  const fetchAccess = useAccessStore((state) => state.fetch);
  useInstallableIdentity(app);

  useEffect(() => {
    if (isAuthenticated && accessStatus === "idle") void fetchAccess();
  }, [isAuthenticated, accessStatus, fetchAccess]);

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to={`${app.base}/entrar`} replace />;
  if (accessStatus === "idle" || accessStatus === "loading") return null;
  if (accessStatus === "error" || !apps.includes(appId)) return <OperatorNoAccess appName={app.name} />;

  const offline = !online && (
    <div role="alert" className="fixed inset-x-0 top-0 z-[60] flex items-center gap-2 bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900">
      <WifiOff size={14} /> Sem conexão. Não é possível carregar nem confirmar nada agora; nada fica guardado no aparelho.
    </div>
  );

  if (fullBleed) {
    return (
      <>
        {offline}
        <Outlet />
      </>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-cream-100">
      {offline}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-black/10 bg-forest-950 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-cream-50">
        <div className="min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-400">Óris 360</span>
          <p className="truncate text-lg font-extrabold leading-none">{app.name}</p>
        </div>
        <div className="flex min-w-0 items-center gap-1">
          <span className="hidden max-w-[10rem] truncate text-xs text-cream-100/80 sm:block">{operatorName}</span>
          {apps.length > 1 && (
            <Link to={OPERATOR_HUB} aria-label="Trocar de app" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-cream-50/10">
              <LayoutGrid size={18} />
            </Link>
          )}
          <button type="button" onClick={() => void logout()} aria-label="Sair" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-cream-50/10">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main id="conteudo" className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <Outlet />
        <div aria-hidden className="h-[calc(2rem+env(safe-area-inset-bottom))]" />
      </main>
    </div>
  );
}
