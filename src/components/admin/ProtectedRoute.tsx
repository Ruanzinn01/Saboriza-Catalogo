import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { useAccessStore } from "@/store/access-store";
import { OPERATOR_SEPARA_BASE } from "@/lib/separa-base";

export function ProtectedRoute() {
  const isAuthenticated = useAdminAuthStore((state) => state.isAuthenticated);
  const isLoading = useAdminAuthStore((state) => state.isLoading);
  const accessStatus = useAccessStore((state) => state.status);
  const restricted = useAccessStore((state) => state.restricted);
  const fetchAccess = useAccessStore((state) => state.fetch);

  useEffect(() => {
    if (isAuthenticated && accessStatus === "idle") void fetchAccess();
  }, [isAuthenticated, accessStatus, fetchAccess]);

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  if (accessStatus === "idle" || accessStatus === "loading") return null;
  if (restricted) return <Navigate to={OPERATOR_SEPARA_BASE} replace />;
  return <Outlet />;
}
