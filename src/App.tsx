import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { useCatalogStore } from "@/store/catalog-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { CatalogPage } from "@/pages/CatalogPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { OrderConfirmedPage } from "@/pages/OrderConfirmedPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { AdminLoginPage } from "@/pages/admin/AdminLoginPage";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ProtectedRoute } from "@/components/admin/ProtectedRoute";
import { DashboardPage } from "@/pages/admin/DashboardPage";
import { ProductsPage } from "@/pages/admin/ProductsPage";
import { ProductFormPage } from "@/pages/admin/ProductFormPage";
import { CategoriesPage } from "@/pages/admin/CategoriesPage";
import { OrdersPage } from "@/pages/admin/OrdersPage";
import { SettingsPage } from "@/pages/admin/SettingsPage";
import { WhatsAppFloatingButton } from "@/components/layout/WhatsAppFloatingButton";

export function App() {
  useEffect(() => {
    useCatalogStore.getState().fetchCatalog();
    useAdminAuthStore.getState().init();
  }, []);

  return (
    <>
      <Toaster position="top-center" richColors />
      <WhatsAppFloatingButton />
      <Routes>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/pedido-confirmado/:orderId" element={<OrderConfirmedPage />} />

        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="produtos" element={<ProductsPage />} />
            <Route path="produtos/:productId" element={<ProductFormPage />} />
            <Route path="categorias" element={<CategoriesPage />} />
            <Route path="pedidos" element={<OrdersPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
