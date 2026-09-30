import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { usePlatformStore } from "@/store/platform-store";
import { AdminState } from "@/components/admin/AdminState";

export function ProtectedPlatformRoute() {
  const isAuthenticated = useAdminAuthStore((state) => state.isAuthenticated);
  const isAuthLoading = useAdminAuthStore((state) => state.isLoading);
  const isPlatformAdmin = usePlatformStore((state) => state.isPlatformAdmin);
  const checkAccess = usePlatformStore((state) => state.checkAccess);

  useEffect(() => {
    if (isAuthenticated) void checkAccess();
  }, [isAuthenticated, checkAccess]);

  if (isAuthLoading) return null;
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  if (isPlatformAdmin === null) return <AdminState variant="loading" message="Verificando acesso..." />;
  if (!isPlatformAdmin) {
    return <AdminState variant="error" message="Esta área é restrita à equipe da plataforma. Seu usuário não tem esse acesso." />;
  }
  return <Outlet />;
}
