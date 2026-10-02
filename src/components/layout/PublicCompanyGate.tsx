import { useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";
import { usePublicCompanyStore } from "@/store/public-company-store";
import { useCatalogStore } from "@/store/catalog-store";
import { useSettingsStore } from "@/store/settings-store";
import { AdminState } from "@/components/admin/AdminState";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function PublicCompanyGate() {
  const { companySlug } = useParams();
  const company = usePublicCompanyStore((s) => s.company);
  const status = usePublicCompanyStore((s) => s.status);
  const resolve = usePublicCompanyStore((s) => s.resolve);

  useEffect(() => {
    void resolve(companySlug);
  }, [companySlug, resolve]);

  useEffect(() => {
    if (!company) return;
    void useCatalogStore.getState().fetchCatalog(company.id);
    void useSettingsStore.getState().fetchSettings(company.id);
  }, [company]);

  if (status === "idle" || status === "loading") return <AdminState variant="loading" message="Carregando..." />;
  if (status === "error" || !company) return <NotFoundPage />;

  return <Outlet />;
}
