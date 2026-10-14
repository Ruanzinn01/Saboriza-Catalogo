export type OperatorAppId = "separa_confere" | "producao" | "entrega";

export interface OperatorApp {
  id: OperatorAppId;
  name: string;
  shortName: string;
  base: string;
  permission: string;
  manifest: string;
  appleIcon: string;
  icon: string;
}

export const OPERATOR_HUB = "/operacao";

export const OPERATOR_APPS: Record<OperatorAppId, OperatorApp> = {
  separa_confere: {
    id: "separa_confere",
    name: "Separa Confere",
    shortName: "Separa Confere",
    base: "/operacao/separa-confere",
    permission: "separa_confere.operar",
    manifest: "/separa-confere/manifest.webmanifest",
    appleIcon: "/separa-confere/apple-touch-icon.png",
    icon: "/separa-confere/icon-192.png",
  },
  producao: {
    id: "producao",
    name: "Produziu Registra",
    shortName: "Produziu",
    base: "/operacao/produziu-registra",
    permission: "producao.operar",
    manifest: "/produziu-registra/manifest.webmanifest",
    appleIcon: "/produziu-registra/apple-touch-icon.png",
    icon: "/produziu-registra/icon-192.png",
  },
  entrega: {
    id: "entrega",
    name: "Entrega Registra",
    shortName: "Entrega",
    base: "/operacao/entrega-registra",
    permission: "entrega.operar",
    manifest: "/entrega-registra/manifest.webmanifest",
    appleIcon: "/entrega-registra/apple-touch-icon.png",
    icon: "/entrega-registra/icon-192.png",
  },
};

export const OPERATOR_APP_IDS = Object.keys(OPERATOR_APPS) as OperatorAppId[];

export function isOperatorAppId(value: unknown): value is OperatorAppId {
  return typeof value === "string" && value in OPERATOR_APPS;
}

export function isOperatorPath(pathname: string): boolean {
  return pathname === OPERATOR_HUB || pathname.startsWith(`${OPERATOR_HUB}/`);
}

export function appFromPath(pathname: string): OperatorApp | null {
  return OPERATOR_APP_IDS.map((id) => OPERATOR_APPS[id]).find((app) => pathname === app.base || pathname.startsWith(`${app.base}/`)) ?? null;
}

export function homeFor(apps: OperatorAppId[]): string {
  return apps.length === 1 ? OPERATOR_APPS[apps[0]].base : OPERATOR_HUB;
}

export interface AccessProfileRow {
  company_id?: string;
  restricted?: boolean;
  can_manage_inventory?: boolean;
}

export interface AppAccessRow extends AccessProfileRow {
  apps?: string[] | null;
  admin_access?: boolean;
}

export interface DerivedAccess {
  apps: OperatorAppId[];
  adminAccess: boolean;
  restricted: boolean;
  canManageInventory: boolean;
}

/** Perfil novo (my_app_access) quando existe; senão o legado (my_access_profile), sem inventar permissão. */
export function deriveAccess(row: AppAccessRow | undefined): DerivedAccess {
  const canManageInventory = Boolean(row?.can_manage_inventory);
  if (row && Array.isArray(row.apps)) {
    return {
      apps: row.apps.filter(isOperatorAppId),
      adminAccess: Boolean(row.admin_access),
      restricted: Boolean(row.restricted),
      canManageInventory,
    };
  }
  if (!row) return { apps: [], adminAccess: false, restricted: false, canManageInventory };
  const restricted = Boolean(row.restricted);
  return {
    apps: restricted ? ["separa_confere"] : [...OPERATOR_APP_IDS],
    adminAccess: !restricted,
    restricted,
    canManageInventory,
  };
}
