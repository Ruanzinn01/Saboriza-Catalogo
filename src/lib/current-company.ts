import { supabase } from "@/lib/supabase";

export interface CurrentCompany {
  id: string;
  display_name: string;
  slug: string;
}

const SELECTED_COMPANY_KEY = "oris360:selected-company-id";

export function getSelectedCompanyId(): string | null {
  try {
    return localStorage.getItem(SELECTED_COMPANY_KEY);
  } catch {
    return null;
  }
}

export function setSelectedCompanyId(companyId: string) {
  try {
    localStorage.setItem(SELECTED_COMPANY_KEY, companyId);
  } catch {
    // localStorage indisponível (modo privado etc) — segue sem persistir a escolha
  }
}

// Lista todas as empresas em que o usuário logado tem membership ACTIVE, da mais antiga pra mais nova.
export async function listMyCompanies(): Promise<CurrentCompany[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return [];

  const { data: memberships } = await supabase
    .from("memberships")
    .select("company_id, companies(id, display_name, slug)")
    .eq("user_id", userData.user.id)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: true });

  if (!memberships) return [];

  return memberships
    .map((m) => m.companies as unknown as CurrentCompany | null)
    .filter((c): c is CurrentCompany => c !== null);
}

// Resolve a empresa "ativa" da sessão admin: a que o usuário escolheu no seletor (se ainda for
// membro dela), senão a mais antiga. Nunca "a primeira empresa da tabela" nem RLS sem filtro.
export async function resolveCurrentCompany(): Promise<CurrentCompany | null> {
  const companies = await listMyCompanies();
  if (companies.length === 0) return null;

  const selectedId = getSelectedCompanyId();
  const selected = selectedId ? companies.find((c) => c.id === selectedId) : null;
  if (selected) return selected;

  const fallback = companies[0];
  setSelectedCompanyId(fallback.id);
  return fallback;
}

export async function resolveCurrentCompanyId(): Promise<string | null> {
  const company = await resolveCurrentCompany();
  return company?.id ?? null;
}
