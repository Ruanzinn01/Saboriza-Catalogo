import { describe, expect, it } from "vitest";
import { OPERATOR_APPS, OPERATOR_HUB, appFromPath, deriveAccess, homeFor, isOperatorPath } from "./operator-apps";

describe("operator-apps", () => {
  it("reconhece só rotas sob /operacao como operacionais", () => {
    expect(isOperatorPath("/operacao")).toBe(true);
    expect(isOperatorPath("/operacao/entrega-registra/carregar/1")).toBe(true);
    expect(isOperatorPath("/operacaox")).toBe(false);
    expect(isOperatorPath("/admin/produzir")).toBe(false);
  });

  it("identifica o app pela rota sem confundir prefixos", () => {
    expect(appFromPath("/operacao/produziu-registra")?.id).toBe("producao");
    expect(appFromPath("/operacao/entrega-registra/entregar/9")?.id).toBe("entrega");
    expect(appFromPath("/operacao/separa-confere/pedido/1")?.id).toBe("separa_confere");
    expect(appFromPath("/operacao/entrega-registra-x")).toBeNull();
    expect(appFromPath("/operacao")).toBeNull();
  });

  it("manifest de cada app tem escopo próprio e distinto", () => {
    const manifests = Object.values(OPERATOR_APPS).map((app) => app.manifest);
    expect(new Set(manifests).size).toBe(3);
    Object.values(OPERATOR_APPS).forEach((app) => expect(app.base.startsWith(`${OPERATOR_HUB}/`)).toBe(true));
  });

  it("um app só vai direto; vários ou nenhum vão para a seleção", () => {
    expect(homeFor(["entrega"])).toBe("/operacao/entrega-registra");
    expect(homeFor(["producao", "entrega"])).toBe(OPERATOR_HUB);
    expect(homeFor([])).toBe(OPERATOR_HUB);
  });

  it("perfil novo: apps e acesso administrativo são independentes", () => {
    const multi = deriveAccess({ apps: ["producao", "entrega"], admin_access: false, restricted: true });
    expect(multi.apps).toEqual(["producao", "entrega"]);
    expect(multi.adminAccess).toBe(false);

    const hibrido = deriveAccess({ apps: ["producao"], admin_access: true, restricted: false });
    expect(hibrido.apps).toEqual(["producao"]);
    expect(hibrido.adminAccess).toBe(true);
  });

  it("perfil novo descarta app desconhecido", () => {
    expect(deriveAccess({ apps: ["producao", "financeiro"], admin_access: false }).apps).toEqual(["producao"]);
  });

  it("perfil legado restrito só enxerga o Separa Confere", () => {
    const legado = deriveAccess({ restricted: true });
    expect(legado.apps).toEqual(["separa_confere"]);
    expect(legado.adminAccess).toBe(false);
  });

  it("perfil legado administrativo mantém acesso administrativo", () => {
    const legado = deriveAccess({ restricted: false, can_manage_inventory: true });
    expect(legado.adminAccess).toBe(true);
    expect(legado.canManageInventory).toBe(true);
  });

  it("sem linha do servidor falha fechado: nenhum app e nenhum acesso administrativo", () => {
    const vazio = deriveAccess(undefined);
    expect(vazio.apps).toEqual([]);
    expect(vazio.adminAccess).toBe(false);
  });
});
