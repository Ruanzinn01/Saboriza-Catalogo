# Relatório de Diagnóstico — Saboriza

Diagnóstico somente leitura. Nenhum arquivo do projeto foi alterado, nenhuma migration rodada, nenhum commit feito. Todas as afirmações citam arquivo/tabela/função de origem; onde não achei evidência, digo "não encontrado".

Projeto Supabase inspecionado: `opeietrhbqlhrhljcdtx` (nome "saboriza", ACTIVE_HEALTHY, região sa-east-1, Postgres 17.6.1.166). Outros projetos Supabase da organização (`wppbxgnpcfwudrocdjxl` RE-Digital/Screaper, `rxjlturtdmhbipgmuekc` Saboriza-painel, `nmjbunaoucrrxtqhttii` Fluxo) estão INACTIVE e não foram usados.

---

## 1. VISÃO GERAL

**ACHADO CRÍTICO DE DIVERGÊNCIA**: `SABORIZA_MODULOS (guia de fases).md` (linha ~211) descreve a stack como "Next.js 14 com App Router" + "Tailwind e shadcn/ui". Isso **não** corresponde ao código real.

Stack real, conforme `package.json`:
- **Vite 6** (`vite: ^6.0.5`, `@vitejs/plugin-react: ^4.3.4`) + **React 18** (`^18.3.1`) — SPA, não Next.js.
- Roteamento client-side: **react-router-dom ^6.30.6** (não App Router).
- **TypeScript ^5.6.3** — `tsconfig.json`: `moduleResolution: bundler`, `strict: true`, alias `@/* -> ./src/*`.
- **Tailwind CSS 4.0** via plugin Vite (`@tailwindcss/vite`), não PostCSS clássico, não shadcn/ui, não Radix UI (`components.json` não encontrado; zero ocorrência de `radix` no `package.json`).
- **@supabase/supabase-js ^2.116.0** — único cliente, sem SSR.
- **zustand ^4.5.5** (estado global), **sonner ^1.7.4** (toasts), **clsx**/**tailwind-merge** (helper `cn`), **lucide-react** (ícones), **html5-qrcode** (scanner, usado em `src/components/admin/BarcodeScannerModal.tsx`), **jspdf** (geração de PDF).
- `vercel.json`: rewrite catch-all `/(.*)` → `/index.html`, confirma SPA.
- `.env.example`: só `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (prefixo `VITE_`, não `NEXT_PUBLIC_`).

Estrutura de `src/`:
```
src/
  App.tsx, main.tsx, index.css
  components/
    admin/ (69 arquivos)
    cart/, catalog/, checkout/, layout/, ui/ (Badge, Button, Combobox, Input, Sheet, StatusBadge — próprios, não shadcn)
  config/contact.ts
  data/ (mocks)
  lib/ (helpers: currency, cep, cnpj, cnae, cpf, coupon, ibge, pricing, order-*, production-*, raw-material-*, separation, stock-*, supabase.ts, whatsapp.ts, fiscal-constants.ts)
    mappers/ (category, coupon, customer, order, product, production, raw-material-entry, raw-material, settings, stock, supplier — Row Supabase → domínio)
  pages/ (CatalogPage, CheckoutPage, OrderConfirmedPage, NotFoundPage)
    admin/ (31 páginas)
  store/ (22 stores Zustand, um por domínio)
  types/ (cart, category, coupon, customer, delivery, fulfillment, order, product, production, raw-material, separation, settings, stock, supabase.ts, supplier)
```
Não há pasta `services/`; a camada de acesso a dados fica em `src/lib/*-api.ts` (ex. `src/lib/orders-api.ts`) e nas próprias actions dos stores Zustand.

---

## 2. MAPA DE ROTAS E TELAS

Definidas em `src/App.tsx` via `react-router-dom`.

**Públicas:**
| Rota | Página | Uso principal |
|---|---|---|
| `/` | `src/pages/CatalogPage.tsx` | Catálogo público. Usa `TopBar`, `CategoryNav`, `CategorySection`, `Hero`, `Footer`, `ProductCard`, `SearchOverlay`, `FloatingOrderBar`, `CartDrawer`; `useCatalogStore`, `useCartStore` |
| `/checkout` | `src/pages/CheckoutPage.tsx` | Finalização de pedido. `OrderSummary`, `CouponField`, `CustomerForm`; `useCartStore`, `useOrdersStore`, `submitOrder` (`src/lib/orders-api.ts`), gera link WhatsApp |
| `/pedido-confirmado/:orderId` | `OrderConfirmedPage.tsx` | Confirmação |
| `*` | `NotFoundPage.tsx` | 404 |

**Admin** (todas dentro de `<Route element={<ProtectedRoute />}>` em `App.tsx`, exceto login):
| Rota | Página | Função |
|---|---|---|
| `/admin/login` | `AdminLoginPage.tsx` | Login (fora do `ProtectedRoute`) |
| `/admin` | `IndicatorsPage.tsx` | Dashboard: KPIs, `RevenueByDayChart`, `ProductionSummaryCard` |
| `/admin/produtos`, `/produtos/:id` | `ProductsPage`, `ProductFormPage` | CRUD produtos |
| `/admin/categorias` | `CategoriesPage.tsx` | CRUD categorias |
| `/admin/clientes(...)` | `CustomersPage`, `CustomerFormPage`, `CustomerDetailPage` | CRUD clientes |
| `/admin/materias-primas(...)` | `RawMaterialsPage`, `RawMaterialFormPage`, `RawMaterialCategoriesPage`, `RawMaterialEntryPage`, `RawMaterialDetailPage` | Fase 1 |
| `/admin/produzir` | `ProduzirRegistraPage.tsx` | "Produziu Registra" mobile — Fase 2 |
| `/admin/producao` | `ProductionPanelPage.tsx` | Painel de produção |
| `/admin/estoque(...)` | `StockPage`, `StockInsightsPage`, `ProductStockDetailPage` | Fase 3/4 |
| `/admin/fornecedores(...)` | `SuppliersPage`, `SupplierFormPage`, `SupplierDetailPage` | CRUD fornecedores |
| `/admin/pedidos(...)` | `OrdersPage`, `OrderEditorPage` | Gestão de pedidos |
| `/admin/separa-confere(...)` | `SeparaConferePage`, `SeparaConfereOrderPage` | Fluxo de separação |
| `/admin/carrega-entrega(...)` | `CarregaEntregaPage`, `CarregamentoOrderPage`, `EntregaConfirmacaoPage` | Fluxo de carregamento/entrega |
| `/admin/configuracoes` | `SettingsPage.tsx` | Fase 0 — dados fiscais/fábrica, CEP/IBGE, CNAE, regime tributário |

Todas as 31 páginas em `src/pages/admin/` estão referenciadas em `App.tsx`; nenhuma página órfã encontrada.

---

## 3. BANCO DE DADOS

Não existe pasta `supabase/migrations` no repositório local — migrations vivem só no projeto remoto (rastreadas via `list_migrations` do MCP Supabase, 62 migrations de `001_initial_schema` a `delivery_receipts_registro_entrega`, datadas de 09/09 a 23/09/2026). Também existem 5 scripts SQL soltos em `scripts/` (aplicados manualmente, fora da cadeia de migrations formal):
- `scripts/2026-09-21_products_max_stock.sql` — `ALTER TABLE products ADD COLUMN max_stock`
- `scripts/2026-09-21_products_profitability_and_fiscal_fields.sql` — `target_margin_pct`, `gtin`, `brand`, `ncm` em `products`
- `scripts/2026-09-21_raw_material_categories.sql` — cria tabela `raw_material_categories` + RLS + seed
- `scripts/2026-09-21_raw_materials_replenishment_fields.sql` — campos de reposição em `raw_materials`
- `scripts/2026-09-21_rename_raw_material_category_fn.sql` — função `rename_raw_material_category`

Estas mesmas mudanças aparecem também como migrations remotas (`raw_materials_replenishment_fields`, `products_profitability_and_fiscal_fields`, `raw_material_categories`, `products_max_stock`, `rename_raw_material_category_fn`), então o schema local e remoto estão alinhados nesse ponto — os scripts em `scripts/` parecem ser cópia/histórico do que foi aplicado via migration, não uma fonte paralela divergente.

### Tabelas (via `list_tables`/`execute_sql` no projeto remoto + `src/types/supabase.ts`)

| Tabela | RLS | Principais colunas | FKs |
|---|---|---|---|
| `categories` | ✅ | id, name, slug, tagline, sort_order, is_active | — |
| `coupons` | ✅ | id, code, discount_type, discount_value, is_active | — |
| `customers` | ✅ | id, name, company_name, trade_name, cnpj, ie, email, phone, endereço completo | — |
| `suppliers` | ✅ | mesma forma de `customers` | — |
| `ibge_cities` | ✅ | city_code, city_name, state_code, state_name | — |
| `products` | ✅ | id, name, description, brand, category_id, supplier_id, code, gtin, ncm, presentation, packaging_type, unit_price, target_margin_pct, current_stock, min_stock, max_stock, is_active | category_id→categories, supplier_id→suppliers |
| `product_recipe` | ✅ | product_id, raw_material_id, quantity_per_unit (ficha técnica) | product_id→products, raw_material_id→raw_materials |
| `raw_material_categories` | ✅ | id, name (índice único case-insensitive) | — |
| `raw_materials` | ✅ | id, name, code, **category (texto livre)**, control_unit, cost_basis, avg_cost, manual_cost, current_stock, min_stock, max_stock, default_reorder_qty, min_purchase_qty, purchase_multiple, lead_time_days, primary_supplier_id | primary_supplier_id→suppliers |
| `raw_material_entries` | ✅ | raw_material_id, supplier_id, batch, expiry_date, packages_quantity, unit_price, total_value, previous_balance, new_balance, status, reversed_at/by/reason | raw_material_id→raw_materials, supplier_id→suppliers |
| `production_records` | ✅ | product_id, packs_quantity, units_quantity, status, responsible_id, confirmed_at | product_id→products |
| `production_consumptions` | ✅ | production_record_id, raw_material_id, needed_quantity, consumed_quantity, previous_balance, new_balance | production_record_id→production_records, raw_material_id→raw_materials |
| `stock_movements` | ✅ | product_id, variation, origin (string livre), reference_id, previous_balance, new_balance, responsible_id | product_id→products |
| `orders` | ✅ | id, order_number, status (enum `order_status`), customer_id, colunas `customer_*` denormalizadas, subtotal/total/discount_amount, coupon_*, campos de separação/carregamento/entrega (ver seção 7/8) | customer_id→customers |
| `order_items` | ✅ | order_id, product_id, product_name, presentation, packs_quantity, total_units, unit_price, total_price, separated_at, loaded_at | order_id→orders, product_id→products |
| `order_adjustment_requests` | ✅ | order_id, order_item_id, message, status, created_by, resolved_by | order_id→orders, order_item_id→order_items |
| `order_deliveries` | ✅ | (Fase Carrega/Entrega — não detalhado em `types/supabase.ts` lido; confirmado via `list_tables`/policies) | — |
| `order_delivery_items` | ✅ | idem | — |
| `delivery_er_reservations` | ✅ | reserva de código ER de entrega (usado por `reserve_delivery_er`) | — |
| `settings` | ✅ | factory_name, cnpj, ie, whatsapp_number, business_hours, cep/endereço, ibge_code, cnae_code, tax_regime, rbt12, effective_rate, schedule_annex | — (linha única) |

**Views**: nenhuma encontrada (`Views: { [_ in never]: never }` em `src/types/supabase.ts`).

**Functions (RPCs)**, todas `SECURITY DEFINER` (confirmado via advisor de segurança):
- `create_production(p_product_id, p_packs_quantity)` → `production_records`
- `create_order(p_customer_name, ..., p_items jsonb, ..., p_coupon_code, p_customer_id)` → Json
- `update_order_items(p_order_id, p_items jsonb, p_coupon_code)` → Json
- `adjust_stock(p_product_id, p_counted_stock, p_reason)` → `stock_movements`
- `create_stock_entry(p_product_id, p_quantity, p_observation)` → `stock_movements`
- `confirm_raw_material_entry(p_entry_id)` → `raw_material_entries`
- `reverse_raw_material_entry(p_entry_id, p_reason)` → `raw_material_entries`
- `rename_raw_material_category(p_id, p_name)` → void (`scripts/2026-09-21_rename_raw_material_category_fn.sql`, `SECURITY INVOKER`)
- `finalize_delivery(p_order_id, p_doc, p_doc_type, p_er_code, p_items, p_notes, p_pdf_path, p_receiver_name, p_result, p_role, p_signature_path)` → text
- `reserve_delivery_er(p_order_id)` → `{er_code, reserved_at}[]`

**Triggers**: migrations `006_fix_search_path`, `fix_stock_rpc_anon_access`, `fix_set_product_code_search_path`, `phase3_order_completed_stock_deduction`, `fix_order_completed_stock_clamp`, `lock_down_order_completed_trigger_fn`, `fix_separation_trigger_search_path` indicam ao menos: trigger de geração de código de produto/matéria-prima, trigger de baixa de estoque ao status `COMPLETED` do pedido (com fix de clamp para não deixar `current_stock` negativo), trigger da separação (Separa Confere). Não li o corpo SQL de cada trigger — nomes e propósito inferidos pelos nomes das migrations e pelo texto do `SABORIZA_MODULOS.md`; sinalizado aqui como inferência, não confirmado linha a linha.

**Enum `order_status`**: `"NEW" | "IN_REVIEW" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "FINALIZADO"` (migration `add_finalizado_order_status`). A coexistência de `COMPLETED` e `FINALIZADO` no mesmo enum sugere transição de nomenclatura incompleta — merece checagem se algum fluxo ainda depende do valor `FINALIZADO` isoladamente.

### RLS — Policies reais (via `pg_policies` no projeto remoto)

Todas as 19 tabelas de `public` têm `rowsecurity = true`. Padrão dominante: **policies `true`/`true` para role `authenticated`** (sem filtro por `auth.uid()`, sem coluna de "dono") — ou seja, qualquer usuário autenticado tem acesso total (SELECT/INSERT/UPDATE/DELETE conforme a policy exista) às tabelas administrativas. Não há sistema de multi-tenant ou de permissão por usuário no nível de RLS.

Exceções com acesso público (`anon`):
- `categories_public_select_active` — `anon` só vê `is_active = true`
- `coupons_public_select_active` — idem
- `products_public_select_active` — idem
- `ibge_cities_public_select` — `anon` vê tudo (`true`)
- `settings_public_select` — `anon` vê tudo (`true`) — necessário para o catálogo público exibir WhatsApp/horário da fábrica

Tabelas sem policy de INSERT/DELETE para `authenticated` (mutação só via RPC `SECURITY DEFINER`): `order_items` (só SELECT/UPDATE — inserção de itens passa por `create_order`/`update_order_items`), `orders` (sem INSERT direta — só `create_order`), `order_adjustment_requests` (sem DELETE), `production_records`/`production_consumptions` (sem UPDATE/DELETE — imutáveis após criados), `delivery_er_reservations`/`order_deliveries`/`order_delivery_items` (só SELECT — mutação via `finalize_delivery`/`reserve_delivery_er`).

Divergência migrations vs. código consumido: não encontrada — `src/types/supabase.ts` é gerado a partir do banco remoto, e os mappers em `src/lib/mappers/*.ts` usam exatamente os mesmos nomes de coluna (confirmado em `order-mapper.ts`).

---

## 4. AUTENTICAÇÃO E PERMISSÕES

- Login usa **Supabase Auth nativo** (email/senha), não sistema de credenciais próprio.
  - `src/store/admin-auth-store.ts`: `login()` chama `supabase.auth.signInWithPassword`; `init()` chama `supabase.auth.getSession()` + `onAuthStateChange`; `logout()` chama `supabase.auth.signOut()`.
  - `src/pages/admin/AdminLoginPage.tsx` consome essa store.
- **Não existe `middleware.ts`** — esperado, pois é SPA Vite, não Next.js.
- Proteção de rota é **100% client-side**: `src/components/admin/ProtectedRoute.tsx` verifica `isAuthenticated`/`isLoading` do Zustand e redireciona para `/admin/login` se não autenticado. Todas as rotas admin em `App.tsx` estão dentro desse guard, exceto `/admin/login` (correto).
- **Não há sistema de papéis/roles** implementado no frontend — é binário (autenticado ou não). `SABORIZA_MODULOS.md` (Tarefa 5.8) prevê perfis "Visualizador / Operador ou gerente / Administrador" para a Fase 5, mas isso ainda não existe em código nem em RLS.
- RLS não usa `auth.uid()` em nenhuma policy (confirmado na consulta a `pg_policies`) — qualquer usuário autenticado tem acesso irrestrito às tabelas administrativas; a segurança real depende inteiramente de quem tem uma conta cadastrada no Supabase Auth do projeto, não de RLS granular.
- Público sem cadastro: catálogo (`/`), checkout (`/checkout`), confirmação de pedido — mutações de pedido passam pela RPC `create_order` (`SECURITY DEFINER`, executável por `anon`, ver seção 8).

---

## 5 e 6. STATUS POR FASE (comparado com `SABORIZA_MODULOS (guia de fases).md`)

O arquivo existe na raiz do projeto com o nome exato `SABORIZA_MODULOS (guia de fases).md` (não `SABORIZA_MODULOS.md`). É um documento normativo (princípios + protocolo de trabalho do agente), não uma spec técnica fechada — mistura itens `[x]` e `[ ]` mesmo dentro de fases marcadas "concluídas".

| Fase | Status no MD | Status real no código | Evidência |
|---|---|---|---|
| **0 — Fiscal/Configurações** | Concluída (2026-09-16) | **Implementado** | Tabela `settings` (migrations `008_create_settings`, `028_fase0_fundacao_fiscal_schema`, seeds IBGE `029_*`); página `SettingsPage.tsx`; libs `fiscal-constants.ts`, `cnae.ts`, `ibge.ts`, `cep.ts` |
| **1 — Matérias-primas** | Concluída (2026-09-17) | **Implementado** | Tabelas `raw_materials`, `raw_material_entries`, `raw_material_categories` (migration `030_fase1_base_insumos_schema`, `031_restrict_raw_material_rpc_to_authenticated`); RPCs `confirm_raw_material_entry`, `reverse_raw_material_entry`; páginas `RawMaterialsPage`, `RawMaterialFormPage`, `RawMaterialDetailPage`, `RawMaterialEntryPage`, `RawMaterialCategoriesPage` |
| **2 — Produção (Produziu Registra)** | Concluída (2026-09-18), com subitens pendentes marcados no MD | **Implementado** | Tabelas `production_records`, `production_consumptions`, `product_recipe` (migration `032_fase2_producao_schema`); RPC `create_production`; página `ProduzirRegistraPage.tsx` (mobile) e `ProductionPanelPage.tsx` (painel) |
| **3 — Estoque** | Concluída (2026-09-19) | **Implementado** | Tabela `stock_movements` (migrations `phase3_stock_movements_foundation`, `phase3_order_completed_stock_deduction`, `fix_order_completed_stock_clamp`); RPCs `adjust_stock`, `create_stock_entry`; páginas `StockPage`, `StockInsightsPage`, `ProductStockDetailPage` |
| **4 — Indicadores** | "Em validação" no MD | **Parcial** | `IndicatorsPage.tsx` (dashboard geral), `StockInsightsPage.tsx` + stores `stock-insights-store.ts`, libs `stock-insights.ts`, `stock-report.ts`, `weekly-production.ts`, `daily-revenue.ts` — existe e funciona, mas o próprio MD não marca como fechado |
| **5 — Financeiro** (Despesas, Receitas, Aportes, Patrimônio, Visão Geral, DRE, Fechamento Mensal, Painel do Proprietário, Auditoria) | Não iniciada | **Não iniciado — confirmado por busca exaustiva** | grep por `despesa`, `aporte`, `patrimonio`, `dre`, `fechamento`, `auditoria`/`audit`: **zero resultados** em `src/` e `scripts/`. `receita` só aparece em `src/lib/fiscal-constants.ts` (texto de enum fiscal "receita bruta", não feature). Nenhuma tabela `expenses`/`expense_installments`/`expense_audit_log` (citadas no MD) existe no banco remoto — não estão em `list_tables` |
| **6 — Emissão Fiscal via Asaas** | Não iniciada | **Não iniciado — confirmado por busca exaustiva** | grep por `asaas`: **zero resultados** em código, `.env.example` ou migrations |

Nenhum stub, rota, tabela ou código experimental de Fase 5 ou 6 foi encontrado em nenhum lugar do repositório ou do banco remoto.

---

## 6. INTEGRAÇÕES

| Integração | Status | Onde |
|---|---|---|
| **Asaas** | Não encontrado (nenhuma linha de código, nenhuma env var) | — |
| **WhatsApp** | Ativo, mas via link direto `wa.me` (não é API oficial WhatsApp Business) | `src/lib/whatsapp.ts`, `src/lib/order-message.ts`, `src/config/contact.ts`, `src/components/layout/WhatsAppFloatingButton.tsx`; consumido em `CheckoutPage.tsx`, `OrderEditorPage.tsx`, `OrderConfirmedPage.tsx`, `SettingsPage.tsx`, `Footer.tsx`, `CustomerForm.tsx` |
| **Supabase Storage** | Ativo, 3 buckets | `product-images` (`src/components/admin/ImageUploader.tsx`), `delivery-signatures` e `delivery-receipts` (`src/store/fulfillment-store.ts`) |

Variáveis de ambiente (só nomes): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (`.env.example`, consumidas em `src/lib/supabase.ts` via `import.meta.env`). Nenhuma outra env var encontrada no código-fonte de `src/`.

---

## 7. PADRÕES E CONVENÇÕES DO CÓDIGO

- **Acesso ao banco**: exclusivamente client-side via `@supabase/supabase-js` (cliente único em `src/lib/supabase.ts`). Sem API routes, sem server actions (não é Next.js). Toda lógica de mutação/consulta fica nos stores Zustand (`store/*.ts`, chamando `supabase.from(...)`/`supabase.rpc(...)` direto) e em `lib/*-api.ts`.
- **Tratamento de erro**: `try/catch` + `toast` (biblioteca `sonner`) — 33 arquivos usam `toast.`. Sem error boundary genérico identificado.
- **Validação**: **não usa zod** nem outra lib de schema (ausente em `package.json`). Validação manual via utilitários dedicados: `src/lib/cnpj.ts` (`isValidCnpj`), `src/lib/cpf.ts`, `src/lib/cep.ts`.
- **Formatação de moeda/data**: `Intl.NumberFormat`/`Intl.DateTimeFormat` nativos, sem `date-fns`. Ex.: `src/lib/currency.ts` (`currencyFormatter` com `Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"})`).
- **Nomenclatura**: tabelas `snake_case` no banco; tipos de domínio `camelCase` no TS via mappers dedicados (`src/lib/mappers/*.ts`); componentes `PascalCase`; páginas com sufixo `Page.tsx`; stores com sufixo `-store.ts`.
- **Snapshot do cliente no pedido**: **não existe campo `customer_snapshot jsonb`**. A tabela `orders` denormaliza os dados do cliente em colunas escalares próprias (`customer_name`, `customer_cnpj`, `customer_ie`, `customer_email`, `customer_address`, `customer_neighborhood`, `customer_cep`, `customer_city`, `customer_state`, `customer_trade_name`, `company_name`, `phone`), reconstruídas em objeto aninhado por `src/lib/mappers/order-mapper.ts`. Funcionalmente é um snapshot, mas implementado como colunas flat, não JSON. **Este é o padrão a seguir** se a Fase 5/6 precisar registrar snapshots de dados (ex.: dados fiscais no momento da emissão de nota).

Estes padrões (sem zod, sem ORM, RPC `SECURITY DEFINER` para mutações críticas, mappers manuais, Zustand por domínio) devem ser seguidos nas Fases 5 e 6.

---

## 8. PONTOS DE ATENÇÃO

1. **Documento normativo desatualizado**: `SABORIZA_MODULOS (guia de fases).md` declara stack Next.js 14 + shadcn/ui; o código real é Vite 6 + React Router + UI própria. Isso pode levar a decisões erradas de arquitetura nas próximas fases se não for corrigido no MD.
2. **RLS sem granularidade de usuário**: todas as policies para `authenticated` são `USING (true)` — qualquer conta autenticada tem acesso total de leitura/escrita às tabelas administrativas, sem distinção de papel. A Fase 5 prevê perfis (Visualizador/Operador/Administrador) que **não têm nenhuma base de RLS pronta** — terá que ser construído do zero.
3. **RPCs `SECURITY DEFINER` sinalizadas pelo linter de segurança do Supabase** (`get_advisors`, categoria SECURITY, nível WARN): `create_order` e `update_order_items` são executáveis por `anon`; `adjust_stock`, `confirm_raw_material_entry`, `create_production`, `create_stock_entry`, `finalize_delivery`, `reserve_delivery_er`, `reverse_raw_material_entry` são executáveis por `authenticated`. Isso é provavelmente intencional (client público precisa criar pedido; admin autenticado precisa das RPCs internas), mas deve ser revisado antes de adicionar RPCs financeiras/fiscais na Fase 5/6 — uma RPC financeira `SECURITY DEFINER` mal restrita seria grave.
4. **Leaked Password Protection desabilitado** no Supabase Auth (advisor `auth_leaked_password_protection`, WARN) — fácil de corrigir no painel do Supabase.
5. **`raw_materials.category` (texto livre) coexiste com a tabela `raw_material_categories`** sem FK entre elas nos tipos gerados (`src/types/supabase.ts`) — duas fontes paralelas para a mesma informação, contrariando o princípio 2 do próprio MD ("uma única fonte de verdade"). A migration `raw_material_categories` faz um `INSERT ... SELECT DISTINCT` para popular a tabela nova a partir da coluna texto, mas não substituiu a coluna por FK.
6. **Enum `order_status` com `COMPLETED` e `FINALIZADO` coexistindo** (migration `add_finalizado_order_status`) — possível transição de nomenclatura incompleta; verificar se algum trigger/fluxo ainda depende exclusivamente de um dos dois valores.
7. **Scripts SQL soltos em `scripts/`** fora de uma cadeia de migrations formal do Supabase CLI local — mesmo que espelhem migrations já aplicadas remotamente, esse padrão facilita divergência futura entre ambientes se algum script for esquecido.
8. **TODOs/FIXMEs**: nenhum encontrado (`grep -rn "TODO\|FIXME\|XXX\|HACK" src scripts` retornou vazio) — não é um ponto negativo, mas também significa que dívidas técnicas não estão documentadas inline.
9. **Nenhuma tabela ou coluna aparentemente sem uso** foi identificada nesta varredura (não fiz análise de uso coluna a coluna no código, só de tabelas inteiras via grep — sinalizo como limitação, não como "confirmado sem uso").
10. Rotas admin: todas protegidas no roteador client-side; nenhuma rota admin desprotegida encontrada em `App.tsx`. A proteção é só de UX — a segurança de dados real depende 100% de RLS (ponto 2 acima).

---

## 9. PONTOS DE EXTENSÃO

- **Menu lateral**: `src/components/admin/AdminNav.tsx` é o ponto único de navegação admin — novo grupo "Financeiro" (Fase 5) e "Fiscal" (Fase 6) se encaixam como novos `NavGroup` ali, seguindo o padrão de ícone + label já usado pelos grupos existentes (Visão geral, Cadastros, Fábrica, Estoque).
- **Agrupamento "Financeiro"**: pode reaproveitar o padrão de stores por domínio (`store/*.ts`) e mappers (`lib/mappers/*.ts`) já estabelecido — criar `expenses-store.ts`, `expense-mapper.ts`, etc., seguindo exatamente a mesma forma dos stores de `raw-materials`/`suppliers`.
- **Integração com Produção**: a cadeia financeira paralela descrita no MD (Despesa → Classificação → Produção concluída → Custo indireto → Custo do produto) se conecta em `production_records` (já existe, com `product_id` e `confirmed_at`) — o rateio de custo indireto por produção pode consumir esses registros sem alterar o schema de produção existente.
- **Integração com Estoque**: `stock_movements` já tem `origin` como string livre — se a Fase 5/6 precisar de baixas por motivo financeiro (ex. perda, doação), pode reaproveitar essa tabela adicionando um novo valor de `origin` em vez de criar tabela nova (segue o princípio "nenhum estoque paralelo" do próprio MD).
- **Integração com Pedidos**: `orders`/`order_items` já têm campos de status e responsável por etapa (separação, carregamento, entrega) — se Fase 6 precisar vincular emissão fiscal a pedidos, o padrão de colunas `*_responsible`, `*_started_at`, `*_finished_at` já usado em `orders` é o modelo a seguir, em vez de criar uma tabela de auditoria genérica do zero.
- **RLS por perfil**: como não existe hoje, é o maior trabalho de fundação antes da Fase 5 — precisa de tabela de perfis/roles (não encontrada) e reescrita das policies `true`/`true` atuais para checar `auth.uid()` contra esse novo mapeamento, sem quebrar o acesso `anon` do catálogo público.

---

## O QUE MAIS PRECISEI INFERIR POR FALTA DE EVIDÊNCIA DIRETA

1. O propósito exato de cada trigger (nomes das migrations e descrição do MD foram usados, não li o corpo SQL de cada trigger no banco).
2. As colunas completas de `order_deliveries` e `order_delivery_items` (confirmei que existem e têm RLS via `list_tables`/`pg_policies`, mas não abri o DDL detalhado dessas duas tabelas).
3. Se alguma coluna ou tabela está de fato "sem uso" no código (fiz grep de nomes de tabela, não rastreei cada coluna individualmente até um call site).
4. Se o valor `FINALIZADO` do enum `order_status` é usado ativamente em algum trigger/fluxo ou é resíduo de uma migração incompleta.
5. Detalhes de UX/negócio das telas de Carrega-Entrega e Separa-Confere além do que os nomes de rota/tabela indicam (não abri o conteúdo de cada componente).
