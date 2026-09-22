import { chromium } from "playwright";

const shots = "C:/Users/rruan/AppData/Local/Temp/claude/c--Users-rruan-Desktop-PROJETOS-Cardapios/df1b466f-fc04-4350-891c-3abb4e5295f1/scratchpad/ui-audit";
import { mkdirSync } from "fs";
mkdirSync(shots, { recursive: true });

const consoleErrors = {};

async function checkPage(context, path, name, { mobile }) {
  const page = await context.newPage();
  const errs = [];
  page.on("console", (msg) => { if (msg.type() === "error") errs.push(msg.text()); });
  page.on("pageerror", (err) => errs.push(String(err)));
  page.on("response", (res) => { if (res.status() >= 400) errs.push(`HTTP ${res.status()} ${res.url()}`); });

  await page.goto(`http://localhost:5173${path}`, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const suffix = mobile ? "mobile" : "desktop";
  await page.screenshot({ path: `${shots}/${name}-${suffix}.png`, fullPage: true });

  const overflow = await page.evaluate(() => {
    const html = document.documentElement;
    return { scrollWidth: html.scrollWidth, clientWidth: html.clientWidth };
  });
  const hasHorizontalScroll = overflow.scrollWidth > overflow.clientWidth + 2;

  let smallTargets = [];
  if (mobile) {
    smallTargets = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, a, input[type="checkbox"], input[type="radio"], [role="button"]'));
      const bad = [];
      for (const el of els) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue; // hidden
        if ((rect.width < 40 || rect.height < 40) && rect.width > 0 && rect.height > 0) {
          bad.push({
            tag: el.tagName,
            text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          });
        }
      }
      return bad.slice(0, 15);
    });
  }

  consoleErrors[`${name}-${suffix}`] = {
    errors: errs,
    hasHorizontalScroll,
    scrollWidth: overflow.scrollWidth,
    clientWidth: overflow.clientWidth,
    smallTargets,
  };
  await page.close();
}

const browser = await chromium.launch();

// --- Login pra pegar sessão reutilizável ---
const loginCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const loginPage = await loginCtx.newPage();
await loginPage.goto("http://localhost:5173/admin/login");
await loginPage.fill('input[type="email"]', "teste.uiaudit@saboriza.app");
await loginPage.fill('input[type="password"]', "TesteUiAudit2026!");
await loginPage.click('button[type="submit"]');
await loginPage.waitForURL("**/admin", { timeout: 15000 });
const storageState = await loginCtx.storageState();
await loginCtx.close();

const publicRoutes = [
  ["/", "01-catalogo"],
  ["/checkout", "02-checkout"],
];

const adminRoutes = [
  ["/admin/login", "10-admin-login"],
  ["/admin", "11-admin-dashboard"],
  ["/admin/pedidos", "12-admin-pedidos"],
  ["/admin/produtos", "13-admin-produtos"],
  ["/admin/clientes", "14-admin-clientes"],
  ["/admin/fornecedores", "15-admin-fornecedores"],
  ["/admin/materias-primas", "16-admin-materias-primas"],
  ["/admin/produzir", "17-admin-produzir"],
  ["/admin/producao", "18-admin-producao"],
  ["/admin/estoque", "19-admin-estoque"],
  ["/admin/separa-confere", "20-admin-separa-confere"],
  ["/admin/configuracoes", "21-admin-configuracoes"],
];

for (const mobile of [false, true]) {
  const viewport = mobile ? { width: 375, height: 812 } : { width: 1280, height: 900 };

  const pubCtx = await browser.newContext({ viewport });
  for (const [path, name] of publicRoutes) await checkPage(pubCtx, path, name, { mobile });
  await pubCtx.close();

  const admCtx = await browser.newContext({ viewport, storageState });
  for (const [path, name] of adminRoutes) await checkPage(admCtx, path, name, { mobile });
  await admCtx.close();
}

await browser.close();

console.log(JSON.stringify(consoleErrors, null, 2));
