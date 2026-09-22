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
import { RawMaterialCategoriesPage } from "@/pages/admin/RawMaterialCategoriesPage";
import { CategoriesPage } from "@/pages/admin/CategoriesPage";
import { CustomersPage } from "@/pages/admin/CustomersPage";
import { CustomerFormPage } from "@/pages/admin/CustomerFormPage";
import { CustomerDetailPage } from "@/pages/admin/CustomerDetailPage";
import { SuppliersPage } from "@/pages/admin/SuppliersPage";
import { SupplierFormPage } from "@/pages/admin/SupplierFormPage";
import { SupplierDetailPage } from "@/pages/admin/SupplierDetailPage";
import { RawMaterialsPage } from "@/pages/admin/RawMaterialsPage";
import { RawMaterialFormPage } from "@/pages/admin/RawMaterialFormPage";
import { RawMaterialDetailPage } from "@/pages/admin/RawMaterialDetailPage";
import { RawMaterialEntryPage } from "@/pages/admin/RawMaterialEntryPage";
import { ProduzirRegistraPage } from "@/pages/admin/ProduzirRegistraPage";
import { ProductionPanelPage } from "@/pages/admin/ProductionPanelPage";
import { StockPage } from "@/pages/admin/StockPage";
import { StockInsightsPage } from "@/pages/admin/StockInsightsPage";
import { ProductStockDetailPage } from "@/pages/admin/ProductStockDetailPage";
import { OrdersPage } from "@/pages/admin/OrdersPage";
import { OrderEditorPage } from "@/pages/admin/OrderEditorPage";
import { SeparaConferePage } from "@/pages/admin/SeparaConferePage";
import { SeparaConfereOrderPage } from "@/pages/admin/SeparaConfereOrderPage";
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
            <Route path="materias-primas" element={<RawMaterialsPage />} />
            <Route path="materias-primas/novo" element={<RawMaterialFormPage />} />
            <Route path="materias-primas/categorias" element={<RawMaterialCategoriesPage />} />
            <Route path="materias-primas/entrada" element={<RawMaterialEntryPage />} />
            <Route path="materias-primas/:rawMaterialId" element={<RawMaterialDetailPage />} />
            <Route path="materias-primas/:rawMaterialId/editar" element={<RawMaterialFormPage />} />
            <Route path="produzir" element={<ProduzirRegistraPage />} />
            <Route path="producao" element={<ProductionPanelPage />} />
            <Route path="estoque" element={<StockPage />} />
            <Route path="estoque/indicadores" element={<StockInsightsPage />} />
            <Route path="estoque/:productId" element={<ProductStockDetailPage />} />
            <Route path="fornecedores" element={<SuppliersPage />} />
            <Route path="fornecedores/novo" element={<SupplierFormPage />} />
            <Route path="fornecedores/:supplierId" element={<SupplierDetailPage />} />
            <Route path="fornecedores/:supplierId/editar" element={<SupplierFormPage />} />
            <Route path="pedidos" element={<OrdersPage />} />
            <Route path="pedidos/novo" element={<OrderEditorPage />} />
            <Route path="pedidos/:orderId" element={<OrderEditorPage />} />
            <Route path="separa-confere" element={<SeparaConferePage />} />
            <Route path="separa-confere/:orderId" element={<SeparaConfereOrderPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
