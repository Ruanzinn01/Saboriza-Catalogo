// Testes da higiene de grants no banco RECONSTRUÍDO (PGlite). NÃO é homologação.
// Uso: PGLITE_DIR=<pasta com @electric-sql/pglite> node supabase/pendentes/testes_seguranca_higiene_grants.mjs [--lista]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { criarBanco, reaplicar } = await import(pathToFileURL(path.join(repo, "supabase/baseline/replay-pglite.mjs")).href);
const MIG = fs.readFileSync(path.join(repo, "supabase/pendentes/seguranca_higiene_grants.sql"), "utf8");
const REV = fs.readFileSync(path.join(repo, "supabase/pendentes/seguranca_higiene_grants_reverter.sql"), "utf8");

const db = await criarBanco();
const falhasReplay = await reaplicar(db, null, () => {});
let falhas = 0;
const ok = (nome, cond, det = "") => { if (!cond) falhas += 1; console.log(`${cond ? "[OK]   " : "[FALHA]"} ${nome}${det ? "  -> " + det : ""}`); };
ok("trilha reaplicada sem falhas", falhasReplay.length === 0, JSON.stringify(falhasReplay));

const SNAP = `select p.proname||'/'||p.pronargs sig, p.proacl::text acl,
  has_function_privilege('anon',p.oid,'execute') anon, has_function_privilege('authenticated',p.oid,'execute') auth,
  has_function_privilege('service_role',p.oid,'execute') svc, p.prosecdef def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by 1`;
const snap = async () => Object.fromEntries((await db.query(SNAP)).rows.map((r) => [r.sig, r]));

const alvo = ["create_platform_company", "get_platform_company_detail", "get_platform_company_entitlements", "platform_bootstrap_company_owner",
  "set_platform_company_entitlement", "set_platform_company_status", "get_platform_companies", "get_pulso_today", "get_owner_panel_summary",
  "get_sales_commissions_report", "set_monthly_close_automation", "oris360_apurar_dia", "oris360_apurar_dia_detalhado", "oris360_apurar_mes",
  "oris360_billing_confirm", "oris360_billing_context", "oris360_billing_quote", "oris360_fechar_competencia_ponto",
  "oris360_list_company_members", "oris360_list_roles", "oris360_resolver_banco_horas", "oris360_time_bank_balance",
  "confirm_production_release", "create_production", "reverse_production", "update_order_items"];
const eAlvo = (sig) => alvo.includes(sig.split("/")[0]);

const antes = await snap();
if (process.argv.includes("--lista")) {
  console.log("anon com EXECUTE na trilha:", Object.values(antes).filter((r) => r.anon).map((r) => r.sig + (r.def ? "*" : "")).join(", "));
}
const alvoAntes = Object.values(antes).filter((r) => eAlvo(r.sig));
ok("alvos existem na trilha", alvoAntes.length >= alvo.length, `${alvoAntes.length} assinaturas`);
const abertas = alvoAntes.filter((r) => r.anon).map((r) => r.sig);
ok("estado atual: funções da plataforma e update_order_items abertas ao anon", ["create_platform_company/4", "set_platform_company_status/2", "update_order_items/3"].every((s) => abertas.includes(s)), `${abertas.length} abertas`);
ok("create_order (checkout público) aberta ao anon antes", antes["create_order/16"]?.anon === true);

await db.exec(MIG);
const depois = await snap();
const aindaAbertas = Object.values(depois).filter((r) => eAlvo(r.sig) && r.anon).map((r) => r.sig);
ok("depois: nenhuma função alvo aberta ao anon", aindaAbertas.length === 0, aindaAbertas.join(","));
const perdeuAuth = alvoAntes.filter((r) => r.auth && !depois[r.sig].auth).map((r) => r.sig);
ok("depois: authenticated mantém EXECUTE onde tinha", perdeuAuth.length === 0, perdeuAuth.join(","));
const perdeuSvc = alvoAntes.filter((r) => r.svc && !depois[r.sig].svc).map((r) => r.sig);
ok("depois: service_role mantém EXECUTE onde tinha", perdeuSvc.length === 0, perdeuSvc.join(","));
const ganhouAuth = alvoAntes.filter((r) => !r.auth && depois[r.sig].auth).map((r) => r.sig);
ok("depois: nenhuma função ganhou acesso novo para authenticated", ganhouAuth.length === 0, ganhouAuth.join(","));
const alterouOutras = Object.keys(antes).filter((s) => !eAlvo(s) && antes[s].acl !== depois[s]?.acl);
ok("funções fora do escopo não tiveram ACL alterada", alterouOutras.length === 0, alterouOutras.join(","));
ok("create_order continua aberta ao anon (checkout)", depois["create_order/16"]?.anon === true);

async function como(role, sql) {
  const claims = role === "anon" ? "" : JSON.stringify({ sub: "00000000-0000-0000-0000-0000000000f1", role });
  await db.exec(`select set_config('request.jwt.claims','${claims}',false); set role ${role};`);
  try { await db.query(sql); return { ok: true }; } catch (e) { return { ok: false, code: e.code, msg: e.message }; } finally { await db.exec("reset role;"); }
}
let r = await como("anon", "select public.set_platform_company_status('00000000-0000-0000-0000-000000000001','ACTIVE')");
ok("anon chamando função da plataforma: permission denied", !r.ok && r.code === "42501", r.msg);
r = await como("anon", "select public.update_order_items('00000000-0000-0000-0000-000000000001','[]'::jsonb,'')");
ok("anon chamando update_order_items: permission denied", !r.ok && r.code === "42501", r.msg);
r = await como("authenticated", "select public.set_platform_company_status('00000000-0000-0000-0000-000000000001','ACTIVE')");
ok("authenticated não-admin na plataforma: barrado pela regra interna, não por privilégio", !r.ok && r.code !== "42501", r.msg);
r = await como("authenticated", "select public.update_order_items('00000000-0000-0000-0000-000000000001','[]'::jsonb,'')");
ok("authenticated em update_order_items: chega ao corpo (erro de regra, não de privilégio)", !r.ok && r.code !== "42501", r.msg);

await db.exec(MIG);
const idem = await snap();
ok("aplicar duas vezes não muda nada", Object.keys(depois).every((s) => depois[s].acl === idem[s].acl));
await db.exec(REV);
const rev = await snap();
const difPriv = Object.keys(antes).filter((s) => antes[s].anon !== rev[s].anon || antes[s].auth !== rev[s].auth || antes[s].svc !== rev[s].svc);
ok("reversão restaura anon/authenticated/service_role de todas as funções", difPriv.length === 0, difPriv.join(","));
const difAcl = Object.keys(antes).filter((s) => antes[s].acl !== rev[s].acl);
console.log(`(informativo) ACL textual diferente após reversão: ${difAcl.length} função(ões) ${difAcl.slice(0, 8).join(",")}`);

console.log(falhas ? `\nResultado: ${falhas} FALHA(S)` : "\nResultado: TODOS OS TESTES PASSARAM");
await db.close();
process.exit(falhas ? 1 : 0);
