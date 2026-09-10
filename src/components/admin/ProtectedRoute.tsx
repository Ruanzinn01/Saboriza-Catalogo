import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuthStore } from "@/store/admin-auth-store";

export function ProtectedRoute() {
  const isAuthenticated = useAdminAuthStore((state) => state.isAuthenticated);
  const isLoading = useAdminAuthStore((state) => state.isLoading);

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}
