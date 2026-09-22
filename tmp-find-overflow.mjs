import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await ctx.newPage();
await page.goto("http://localhost:5173/admin/login");
await page.fill('input[type="email"]', "teste.uiaudit@saboriza.app");
await page.fill('input[type="password"]', "TesteUiAudit2026!");
await page.click('button[type="submit"]');
await page.waitForURL("**/admin", { timeout: 15000 });

for (const path of ["/admin/producao", "/admin/configuracoes", "/admin/produtos"]) {
  await page.goto(`http://localhost:5173${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const offenders = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("body *"));
    const results = [];
    for (const el of all) {
      const rect = el.getBoundingClientRect();
      if (rect.right > 380) {
        results.push({
          tag: el.tagName,
          cls: (el.className || "").toString().slice(0, 80),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          text: (el.textContent || "").trim().slice(0, 50),
        });
      }
    }
    results.sort((a, b) => b.right - a.right);
    return results.slice(0, 8);
  });
  console.log(`\n=== ${path} ===`);
  console.log(JSON.stringify(offenders, null, 2));
}

await browser.close();
