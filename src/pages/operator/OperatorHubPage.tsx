import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { OPERATOR_APPS, OPERATOR_HUB, homeFor } from "@/lib/operator-apps";
import { useAccessStore } from "@/store/access-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";

/** Seleção entre os apps autorizados. Quem tem só um app é levado direto a ele. */
export function OperatorHubPage() {
  const isAuthenticated = useAdminAuthStore((state) => state.isAuthenticated);
  const isLoading = useAdminAuthStore((state) => state.isLoading);
  const logout = useAdminAuthStore((state) => state.logout);
  const accessStatus = useAccessStore((state) => state.status);
  const apps = useAccessStore((state) => state.apps);
  const fetchAccess = useAccessStore((state) => state.fetch);

  useEffect(() => {
    if (isAuthenticated && accessStatus === "idle") void fetchAccess();
  }, [isAuthenticated, accessStatus, fetchAccess]);

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to={`${OPERATOR_HUB}/entrar`} replace />;
  if (accessStatus === "idle" || accessStatus === "loading") return null;
  if (accessStatus === "ready" && apps.length === 1) return <Navigate to={homeFor(apps)} replace />;

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-forest-950 px-4 py-8">
      <div className="mx-auto w-full max-w-sm rounded-3xl bg-cream-50 p-6 shadow-xl">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-700">Óris 360</span>
        <h1 className="mb-4 text-2xl font-extrabold text-forest-950">Escolha o app</h1>
        {accessStatus === "error" || apps.length === 0 ? (
          <p role="alert" className="text-sm text-ink-700/80">
            Você não tem acesso a esta área. Fale com quem administra o sistema.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {apps.map((id) => (
              <li key={id}>
                <Link
                  to={OPERATOR_APPS[id].base}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-forest-950/10 bg-white p-3 font-bold text-forest-950 hover:border-forest-950/30"
                >
                  <img src={OPERATOR_APPS[id].icon} alt="" className="h-10 w-10 rounded-xl" />
                  {OPERATOR_APPS[id].name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={() => void logout()} className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-forest-950/15 text-sm font-bold text-forest-950">
          <LogOut size={16} /> Sair
        </button>
      </div>
    </div>
  );
}
