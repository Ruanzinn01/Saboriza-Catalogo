import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { useCatalogStore } from "@/store/catalog-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { useSettingsStore } from "@/store/settings-store";
import { CatalogPage } from "@/pages/CatalogPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { OrderConfirmedPage } from "@/pages/OrderConfirmedPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { AdminLoginPage } from "@/pages/admin/AdminLoginPage";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ProtectedRoute } from "@/components/admin/ProtectedRoute";
import { IndicatorsPage } from "@/pages/admin/IndicatorsPage";
import { ProductsPage } from "@/pages/admin/ProductsPage";
import { ProductFormPage } from "@/pages/admin/ProductFormPage";
import { CategoriesPage } from "@/pages/admin/CategoriesPage";
import { CustomersPage } from "@/pages/admin/CustomersPage";
import { CustomerFormPage } from "@/pages/admin/CustomerFormPage";
import { CustomerDetailPage } from "@/pages/admin/CustomerDetailPage";
import { OrdersPage } from "@/pages/admin/OrdersPage";
import { OrderEditorPage } from "@/pages/admin/OrderEditorPage";
import { SettingsPage } from "@/pages/admin/SettingsPage";
import { WhatsAppFloatingButton } from "@/components/layout/WhatsAppFloatingButton";

export function App() {
  useEffect(() => {
    useCatalogStore.getState().fetchCatalog();
    useAdminAuthStore.getState().init();
    useSettingsStore.getState().fetchSettings();
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
            <Route index element={<IndicatorsPage />} />
            <Route path="produtos" element={<ProductsPage />} />
            <Route path="produtos/:productId" element={<ProductFormPage />} />
            <Route path="categorias" element={<CategoriesPage />} />
            <Route path="clientes" element={<CustomersPage />} />
            <Route path="clientes/novo" element={<CustomerFormPage />} />
            <Route path="clientes/:customerId" element={<CustomerDetailPage />} />
            <Route path="clientes/:customerId/editar" element={<CustomerFormPage />} />
            <Route path="pedidos" element={<OrdersPage />} />
            <Route path="pedidos/novo" element={<OrderEditorPage />} />
            <Route path="pedidos/:orderId" element={<OrderEditorPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
