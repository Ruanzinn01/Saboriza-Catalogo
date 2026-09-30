import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { useCatalogStore } from "@/store/catalog-store";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { useSettingsStore } from "@/store/settings-store";
import { CatalogPage } from "@/pages/CatalogPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { OrderConfirmedPage } from "@/pages/OrderConfirmedPage";
import { PontoOrisTerminalPage } from "@/pages/PontoOrisTerminalPage";
import { Meu360Page } from "@/pages/Meu360Page";
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
import { EmployeesPage } from "@/pages/admin/EmployeesPage";
import { EmployeeProfilePage } from "@/pages/admin/EmployeeProfilePage";
import { EmployeeTimesheetPage } from "@/pages/admin/EmployeeTimesheetPage";
import { SuppliersPage } from "@/pages/admin/SuppliersPage";
import { SupplierFormPage } from "@/pages/admin/SupplierFormPage";
import { SupplierDetailPage } from "@/pages/admin/SupplierDetailPage";
import { RawMaterialsPage } from "@/pages/admin/RawMaterialsPage";
import { RawMaterialFormPage } from "@/pages/admin/RawMaterialFormPage";
import { RawMaterialDetailPage } from "@/pages/admin/RawMaterialDetailPage";
import { RawMaterialEntryPage } from "@/pages/admin/RawMaterialEntryPage";
import { ProduzirRegistraPage } from "@/pages/admin/ProduzirRegistraPage";
import { ChaoDeFabricaPage } from "@/pages/admin/ChaoDeFabricaPage";
import { RotasProducaoPage } from "@/pages/admin/RotasProducaoPage";
import { PlanosProducaoPage } from "@/pages/admin/PlanosProducaoPage";
import { CentralProducaoPage } from "@/pages/admin/CentralProducaoPage";
import { IntegracoesFinanceirasPage } from "@/pages/admin/IntegracoesFinanceirasPage";
import { ProductionPanelPage } from "@/pages/admin/ProductionPanelPage";
import { StockPage } from "@/pages/admin/StockPage";
import { StockInsightsPage } from "@/pages/admin/StockInsightsPage";
import { ProductStockDetailPage } from "@/pages/admin/ProductStockDetailPage";
import { OrdersPage } from "@/pages/admin/OrdersPage";
import { OrderEditorPage } from "@/pages/admin/OrderEditorPage";
import { FaturarListPage } from "@/pages/admin/FaturarListPage";
import { FaturarOrderPage } from "@/pages/admin/FaturarOrderPage";
import { AportesPage } from "@/pages/admin/AportesPage";
import { DespesasPage } from "@/pages/admin/DespesasPage";
import { ReceitasPage } from "@/pages/admin/ReceitasPage";
import { PatrimonioPage } from "@/pages/admin/PatrimonioPage";
import { DREPage } from "@/pages/admin/DREPage";
import { FechamentoPage } from "@/pages/admin/FechamentoPage";
import { SeparaConferePage } from "@/pages/admin/SeparaConferePage";
import { SeparaConfereOrderPage } from "@/pages/admin/SeparaConfereOrderPage";
import { CarregaEntregaPage } from "@/pages/admin/CarregaEntregaPage";
import { CarregamentoOrderPage } from "@/pages/admin/CarregamentoOrderPage";
import { EntregaConfirmacaoPage } from "@/pages/admin/EntregaConfirmacaoPage";
import { SettingsPage } from "@/pages/admin/SettingsPage";
import { TeamPage } from "@/pages/admin/TeamPage";
import { ForcaDeVendasPage } from "@/pages/admin/ForcaDeVendasPage";
import { TarefasPage } from "@/pages/admin/TarefasPage";
import { PulsoPage } from "@/pages/admin/PulsoPage";
import { PainelProprietarioPage } from "@/pages/admin/PainelProprietarioPage";
import { WhatsAppFloatingButton } from "@/components/layout/WhatsAppFloatingButton";
import { ProtectedPlatformRoute } from "@/components/platform/ProtectedPlatformRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { PlatformDashboardPage } from "@/pages/platform/PlatformDashboardPage";
import { PlatformCompanyDetailPage } from "@/pages/platform/PlatformCompanyDetailPage";

export function App() {
  const { pathname } = useLocation();
  const isCustomerFacing = !pathname.startsWith("/admin") && !pathname.startsWith("/platform");

  useEffect(() => {
    useCatalogStore.getState().fetchCatalog();
    useAdminAuthStore.getState().init();
    useSettingsStore.getState().fetchSettings();
  }, []);

  return (
    <>
      <Toaster position="top-center" richColors />
      {isCustomerFacing && <WhatsAppFloatingButton />}
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
            <Route path="chao-de-fabrica" element={<ChaoDeFabricaPage />} />
            <Route path="rotas-producao" element={<RotasProducaoPage />} />
            <Route path="planos-producao" element={<PlanosProducaoPage />} />
            <Route path="central-producao" element={<CentralProducaoPage />} />
            <Route path="producao" element={<ProductionPanelPage />} />
            <Route path="estoque" element={<StockPage />} />
            <Route path="estoque/indicadores" element={<StockInsightsPage />} />
            <Route path="estoque/:productId" element={<ProductStockDetailPage />} />
            <Route path="colaboradores" element={<EmployeesPage />} />
            <Route path="colaboradores/novo" element={<EmployeeProfilePage />} />
            <Route path="colaboradores/:employeeId" element={<EmployeeProfilePage />} />
            <Route path="colaboradores/:employeeId/espelho" element={<EmployeeTimesheetPage />} />
            <Route path="fornecedores" element={<SuppliersPage />} />
            <Route path="fornecedores/novo" element={<SupplierFormPage />} />
            <Route path="fornecedores/:supplierId" element={<SupplierDetailPage />} />
            <Route path="fornecedores/:supplierId/editar" element={<SupplierFormPage />} />
            <Route path="pedidos" element={<OrdersPage />} />
            <Route path="pedidos/novo" element={<OrderEditorPage />} />
            <Route path="pedidos/:orderId" element={<OrderEditorPage />} />
            <Route path="faturar" element={<FaturarListPage />} />
            <Route path="faturar/:orderId" element={<FaturarOrderPage />} />
            <Route path="separa-confere" element={<SeparaConferePage />} />
            <Route path="separa-confere/:orderId" element={<SeparaConfereOrderPage />} />
            <Route path="carrega-entrega" element={<CarregaEntregaPage />} />
            <Route path="carrega-entrega/carregar/:orderId" element={<CarregamentoOrderPage />} />
            <Route path="carrega-entrega/entregar/:orderId" element={<EntregaConfirmacaoPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
            <Route path="usuarios" element={<TeamPage />} />
            <Route path="ponto-oris" element={<PontoOrisTerminalPage />} />
            <Route path="meu360" element={<Meu360Page />} />
            <Route path="aportes" element={<AportesPage />} />
            <Route path="despesas" element={<DespesasPage />} />
            <Route path="receitas" element={<ReceitasPage />} />
            <Route path="patrimonio" element={<PatrimonioPage />} />
            <Route path="dre" element={<DREPage />} />
            <Route path="fechamento" element={<FechamentoPage />} />
            <Route path="integracoes" element={<IntegracoesFinanceirasPage />} />
            <Route path="vendas" element={<ForcaDeVendasPage />} />
            <Route path="tarefas" element={<TarefasPage />} />
            <Route path="pulso" element={<PulsoPage />} />
            <Route path="painel-proprietario" element={<PainelProprietarioPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedPlatformRoute />}>
          <Route path="/platform" element={<PlatformLayout />}>
            <Route index element={<PlatformDashboardPage />} />
            <Route path="empresas/:companyId" element={<PlatformCompanyDetailPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
