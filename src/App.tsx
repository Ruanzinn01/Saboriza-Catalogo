import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { CatalogPage } from "@/pages/CatalogPage";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ProtectedRoute } from "@/components/admin/ProtectedRoute";
import { WhatsAppFloatingButton } from "@/components/layout/WhatsAppFloatingButton";
import { PublicCompanyGate } from "@/components/layout/PublicCompanyGate";
import { ProtectedPlatformRoute } from "@/components/platform/ProtectedPlatformRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { AdminState } from "@/components/admin/AdminState";

const CheckoutPage = lazy(() => import("@/pages/CheckoutPage").then((m) => ({ default: m.CheckoutPage })));
const OrderConfirmedPage = lazy(() => import("@/pages/OrderConfirmedPage").then((m) => ({ default: m.OrderConfirmedPage })));
const PontoOrisTerminalPage = lazy(() => import("@/pages/PontoOrisTerminalPage").then((m) => ({ default: m.PontoOrisTerminalPage })));
const Meu360Page = lazy(() => import("@/pages/Meu360Page").then((m) => ({ default: m.Meu360Page })));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const AdminLoginPage = lazy(() => import("@/pages/admin/AdminLoginPage").then((m) => ({ default: m.AdminLoginPage })));
const IndicatorsPage = lazy(() => import("@/pages/admin/IndicatorsPage").then((m) => ({ default: m.IndicatorsPage })));
const ProductsPage = lazy(() => import("@/pages/admin/ProductsPage").then((m) => ({ default: m.ProductsPage })));
const ProductFormPage = lazy(() => import("@/pages/admin/ProductFormPage").then((m) => ({ default: m.ProductFormPage })));
const RawMaterialCategoriesPage = lazy(() => import("@/pages/admin/RawMaterialCategoriesPage").then((m) => ({ default: m.RawMaterialCategoriesPage })));
const CategoriesPage = lazy(() => import("@/pages/admin/CategoriesPage").then((m) => ({ default: m.CategoriesPage })));
const CustomersPage = lazy(() => import("@/pages/admin/CustomersPage").then((m) => ({ default: m.CustomersPage })));
const CustomerFormPage = lazy(() => import("@/pages/admin/CustomerFormPage").then((m) => ({ default: m.CustomerFormPage })));
const CustomerDetailPage = lazy(() => import("@/pages/admin/CustomerDetailPage").then((m) => ({ default: m.CustomerDetailPage })));
const EmployeesPage = lazy(() => import("@/pages/admin/EmployeesPage").then((m) => ({ default: m.EmployeesPage })));
const EmployeeProfilePage = lazy(() => import("@/pages/admin/EmployeeProfilePage").then((m) => ({ default: m.EmployeeProfilePage })));
const EmployeeTimesheetPage = lazy(() => import("@/pages/admin/EmployeeTimesheetPage").then((m) => ({ default: m.EmployeeTimesheetPage })));
const SuppliersPage = lazy(() => import("@/pages/admin/SuppliersPage").then((m) => ({ default: m.SuppliersPage })));
const SupplierFormPage = lazy(() => import("@/pages/admin/SupplierFormPage").then((m) => ({ default: m.SupplierFormPage })));
const SupplierDetailPage = lazy(() => import("@/pages/admin/SupplierDetailPage").then((m) => ({ default: m.SupplierDetailPage })));
const RawMaterialsPage = lazy(() => import("@/pages/admin/RawMaterialsPage").then((m) => ({ default: m.RawMaterialsPage })));
const RawMaterialFormPage = lazy(() => import("@/pages/admin/RawMaterialFormPage").then((m) => ({ default: m.RawMaterialFormPage })));
const RawMaterialDetailPage = lazy(() => import("@/pages/admin/RawMaterialDetailPage").then((m) => ({ default: m.RawMaterialDetailPage })));
const ProduzirRegistraPage = lazy(() => import("@/pages/admin/ProduzirRegistraPage").then((m) => ({ default: m.ProduzirRegistraPage })));
const ChaoDeFabricaPage = lazy(() => import("@/pages/admin/ChaoDeFabricaPage").then((m) => ({ default: m.ChaoDeFabricaPage })));
const RotasProducaoPage = lazy(() => import("@/pages/admin/RotasProducaoPage").then((m) => ({ default: m.RotasProducaoPage })));
const PlanosProducaoPage = lazy(() => import("@/pages/admin/PlanosProducaoPage").then((m) => ({ default: m.PlanosProducaoPage })));
const CentralProducaoPage = lazy(() => import("@/pages/admin/CentralProducaoPage").then((m) => ({ default: m.CentralProducaoPage })));
const IntegracoesFinanceirasPage = lazy(() => import("@/pages/admin/IntegracoesFinanceirasPage").then((m) => ({ default: m.IntegracoesFinanceirasPage })));
const ErrosSistemaPage = lazy(() => import("@/pages/admin/ErrosSistemaPage").then((m) => ({ default: m.ErrosSistemaPage })));
const ProductionPanelPage = lazy(() => import("@/pages/admin/ProductionPanelPage").then((m) => ({ default: m.ProductionPanelPage })));
const StockPage = lazy(() => import("@/pages/admin/StockPage").then((m) => ({ default: m.StockPage })));
const StockInsightsPage = lazy(() => import("@/pages/admin/StockInsightsPage").then((m) => ({ default: m.StockInsightsPage })));
const ProductStockDetailPage = lazy(() => import("@/pages/admin/ProductStockDetailPage").then((m) => ({ default: m.ProductStockDetailPage })));
const OrdersPage = lazy(() => import("@/pages/admin/OrdersPage").then((m) => ({ default: m.OrdersPage })));
const OrderEditorPage = lazy(() => import("@/pages/admin/OrderEditorPage").then((m) => ({ default: m.OrderEditorPage })));
const FaturarListPage = lazy(() => import("@/pages/admin/FaturarListPage").then((m) => ({ default: m.FaturarListPage })));
const FaturarOrderPage = lazy(() => import("@/pages/admin/FaturarOrderPage").then((m) => ({ default: m.FaturarOrderPage })));
const AportesPage = lazy(() => import("@/pages/admin/AportesPage").then((m) => ({ default: m.AportesPage })));
const DespesasPage = lazy(() => import("@/pages/admin/DespesasPage").then((m) => ({ default: m.DespesasPage })));
const NovaDespesaPage = lazy(() => import("@/pages/admin/NovaDespesaPage").then((m) => ({ default: m.NovaDespesaPage })));
const DespesasOrigemPage = lazy(() => import("@/pages/admin/despesas/DespesasOrigemPage").then((m) => ({ default: m.DespesasOrigemPage })));
const DespesasPessoalPage = lazy(() => import("@/pages/admin/despesas/DespesasPessoalPage").then((m) => ({ default: m.DespesasPessoalPage })));
const DespesasColaboradorPage = lazy(() => import("@/pages/admin/despesas/DespesasColaboradorPage").then((m) => ({ default: m.DespesasColaboradorPage })));
const DespesasComissoesPage = lazy(() => import("@/pages/admin/despesas/DespesasComissoesPage").then((m) => ({ default: m.DespesasComissoesPage })));
const DespesasVencimentosPage = lazy(() => import("@/pages/admin/despesas/DespesasVencimentosPage").then((m) => ({ default: m.DespesasVencimentosPage })));
const ReceitasPage = lazy(() => import("@/pages/admin/ReceitasPage").then((m) => ({ default: m.ReceitasPage })));
const PatrimonioPage = lazy(() => import("@/pages/admin/PatrimonioPage").then((m) => ({ default: m.PatrimonioPage })));
const DREPage = lazy(() => import("@/pages/admin/DREPage").then((m) => ({ default: m.DREPage })));
const FechamentoPage = lazy(() => import("@/pages/admin/FechamentoPage").then((m) => ({ default: m.FechamentoPage })));
const SeparaConferePage = lazy(() => import("@/pages/admin/SeparaConferePage").then((m) => ({ default: m.SeparaConferePage })));
const SeparaConfereOrderPage = lazy(() => import("@/pages/admin/SeparaConfereOrderPage").then((m) => ({ default: m.SeparaConfereOrderPage })));
const CarregaEntregaPage = lazy(() => import("@/pages/admin/CarregaEntregaPage").then((m) => ({ default: m.CarregaEntregaPage })));
const CarregamentoOrderPage = lazy(() => import("@/pages/admin/CarregamentoOrderPage").then((m) => ({ default: m.CarregamentoOrderPage })));
const EntregaConfirmacaoPage = lazy(() => import("@/pages/admin/EntregaConfirmacaoPage").then((m) => ({ default: m.EntregaConfirmacaoPage })));
const SettingsPage = lazy(() => import("@/pages/admin/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const TeamPage = lazy(() => import("@/pages/admin/TeamPage").then((m) => ({ default: m.TeamPage })));
const ForcaDeVendasPage = lazy(() => import("@/pages/admin/ForcaDeVendasPage").then((m) => ({ default: m.ForcaDeVendasPage })));
const TarefasPage = lazy(() => import("@/pages/admin/TarefasPage").then((m) => ({ default: m.TarefasPage })));
const PulsoPage = lazy(() => import("@/pages/admin/PulsoPage").then((m) => ({ default: m.PulsoPage })));
const PainelProprietarioPage = lazy(() => import("@/pages/admin/PainelProprietarioPage").then((m) => ({ default: m.PainelProprietarioPage })));
const FinanceiroGeralPage = lazy(() => import("@/pages/admin/FinanceiroGeralPage").then((m) => ({ default: m.FinanceiroGeralPage })));
const PlatformDashboardPage = lazy(() => import("@/pages/platform/PlatformDashboardPage").then((m) => ({ default: m.PlatformDashboardPage })));
const PlatformCompanyDetailPage = lazy(() => import("@/pages/platform/PlatformCompanyDetailPage").then((m) => ({ default: m.PlatformCompanyDetailPage })));

function RouteFallback() {
  return <AdminState variant="loading" message="Carregando..." />;
}

export function App() {
  const { pathname } = useLocation();
  const isCustomerFacing = !pathname.startsWith("/admin") && !pathname.startsWith("/platform");

  useEffect(() => {
    useAdminAuthStore.getState().init();
  }, []);

  return (
    <>
      <Toaster position="top-center" richColors />
      {isCustomerFacing && <WhatsAppFloatingButton />}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<PublicCompanyGate />}>
            <Route path="/" element={<CatalogPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/pedido-confirmado/:orderId" element={<OrderConfirmedPage />} />

            <Route path="/:companySlug" element={<CatalogPage />} />
            <Route path="/:companySlug/checkout" element={<CheckoutPage />} />
            <Route path="/:companySlug/pedido-confirmado/:orderId" element={<OrderConfirmedPage />} />
          </Route>

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
              <Route path="despesas/nova" element={<NovaDespesaPage />} />
              <Route path="despesas/pessoal" element={<DespesasPessoalPage />} />
              <Route path="despesas/pessoal/:employeeId" element={<DespesasColaboradorPage />} />
              <Route path="despesas/comissoes" element={<DespesasComissoesPage />} />
              <Route path="despesas/vencimentos" element={<DespesasVencimentosPage />} />
              <Route path="despesas/origem/:origin" element={<DespesasOrigemPage />} />
              <Route path="despesas/:expenseId" element={<DespesasPage />} />
              <Route path="receitas" element={<ReceitasPage />} />
              <Route path="patrimonio" element={<PatrimonioPage />} />
              <Route path="dre" element={<DREPage />} />
              <Route path="fechamento" element={<FechamentoPage />} />
              <Route path="integracoes" element={<IntegracoesFinanceirasPage />} />
              <Route path="erros-sistema" element={<ErrosSistemaPage />} />
              <Route path="vendas" element={<ForcaDeVendasPage />} />
              <Route path="tarefas" element={<TarefasPage />} />
              <Route path="pulso" element={<PulsoPage />} />
              <Route path="painel-proprietario" element={<PainelProprietarioPage />} />
              <Route path="financeiro-geral" element={<FinanceiroGeralPage />} />
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
      </Suspense>
    </>
  );
}
