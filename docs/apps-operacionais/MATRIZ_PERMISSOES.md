# Matriz de permissões por app, tabela e operação

Derivada da **leitura estática do código** (stores e páginas de cada app) e do **catálogo de produção lido em modo somente leitura**. Não foi confirmada por execução no schema real: depende da homologação (ver `README.md`).

Legenda: **L** leitura, **E** escrita direta pela API, **RPC** só por função, **—** sem acesso.
Escopo atual das políticas: **empresa** (`is_active_company_member(company_id)`). **Unidade** e **atribuição do colaborador não são aplicadas** nessas tabelas hoje (ver "Lacunas").

## Tabelas

| Tabela | Separa Confere | Produziu Registra | Entrega Registra | Observação |
|---|---|---|---|---|
| orders | L/E (como hoje) | — | L/E | Entrega atualiza carregamento e entrega |
| order_items | L/E (como hoje) | — | L/E | `loaded_at` |
| order_adjustment_requests | L/E (como hoje) | — | L/E | Ajuste de pedido. **Não representa entrega parcial** |
| products | L (como hoje) | L | L | |
| categories | L (como hoje) | L | — | |
| settings | L (como hoje) | L | L | Dados da empresa para o PDF e o cabeçalho |
| stock_movements | L (como hoje) | L | — | Realtime do Produziu |
| separation_jobs, inventory_sessions, inventory_session_items | L (como hoje) | — | — | |
| employee_employments, group_companies | L (como hoje) | — | — | Separa mantém o acesso atual; apps novos ficam sem |
| production_records | — | L | — | Gravação só por RPC |
| production_releases | — | L | — | Gravação só por RPC |
| floor_executions | — | L | — | Gravação só por RPC |
| production_plans, production_routes | — | L | — | `publish_production_route` é admin |
| raw_materials | — | L | — | Contém custo: confirmar se o Produziu precisa mesmo |
| production_diaries | — | L/E | — | |
| diary_evaluations, diary_occurrences, diary_other_activities | — | L/E | — | |
| urgent_demands | — | L/E | — | |
| employees | — | RPC | — | `operator_list_production_employees()` devolve só identificação |
| billings | — | — | RPC | `operator_confirmed_billing_order_ids()` devolve só ids confirmados |
| loading_jobs, order_deliveries, order_delivery_items, delivery_er_reservations | — | — | RPC | Hoje bloqueadas ao restrito; nenhuma leitura direta no código do app |
| customers, suppliers, employee_documents, salary_*, stock_policies, roles, role_permissions, membership_roles | — | — | — | Bloqueadas ao restrito (V3), inalteradas |
| Financeiro e RH (expenses, receivables, revenues, time_*, etc.) | — | — | — | Política exige permissão específica; confinado não a tem |

## RPCs

| RPC | Separa | Produziu | Entrega | Gestor/admin |
|---|---|---|---|---|
| create_production_release, confirm_production_release, create_production (3 sobrecargas), reverse_production, floor_* (3) | negado | permitido | negado | permitido |
| finalize_delivery, reserve_delivery_er | negado | negado | permitido | permitido |
| publish_production_route | negado | negado | negado | permitido |
| operator_list_production_employees | negado | permitido | negado | permitido |
| operator_confirmed_billing_order_ids | negado | negado | permitido | permitido |
| my_app_access | permitido | permitido | permitido | permitido |
| my_access_profile (legado) | inalterada | inalterada | inalterada | inalterada |

"Negado" = `42501` vindo de `private.assert_app_access`. Anônimo perde `EXECUTE` em todas.

## Storage (fora da migration, não corrigido)

| Bucket | Política atual | Risco |
|---|---|---|
| delivery-receipts, delivery-signatures | `bucket_id = '...'` apenas, para leitura e inserção | Qualquer usuário autenticado, de qualquer empresa, lê comprovantes e assinaturas |
| employee-documents | idem | Qualquer autenticado lê documentos de colaboradores de qualquer empresa |

A correção depende do padrão de caminho dos arquivos (não confirmado) e de decisão sua. Ver "Achados" no `README.md`.

## Perfis

| Perfil | Como é composto | `my_app_access` |
|---|---|---|
| Restrito de um app | só `<app>.operar` | `apps=[app]`, `admin_access=false` |
| Vários apps | vários `<app>.operar` | `apps=[...]`, `admin_access=false` |
| Híbrido | `<app>.operar` + `admin.acessar` | não restrito: 3 apps, `admin_access=true` |
| Gestor/administrador | nenhum `.operar` | 3 apps, `admin_access=true` |

Gestor sem `.operar` abre os 3 apps porque já alcança as mesmas telas e funções em `/admin` hoje: a nova porta não amplia privilégio.
