# Matriz de isolamento ampliada (homologação)

Data: 2026-10-16. Ambiente `dfynvpieyvvameftrent`. Script: `scripts/homologacao/05_matriz_isolamento_ampliada.sql` (resultado completo na tabela `zz_homolog.matriz`, 135 tabelas x 9 perfis = 1.215 linhas).

## Escopo

Pedido: 43 tabelas fora da matriz (de 104). Na homologação existem 135 tabelas `public` (115 com `company_id`, 20 sem). A matriz anterior cobre 42; ficam 73 com `company_id` fora dela, mais 20 sem `company_id`. Testei as 135, então o escopo pedido está contido. A contagem 104/43 não bate com o banco (provável fotografia mais antiga).

Método: dados sintéticos em todas as tabelas nas empresas A e B (+ segunda unidade `Filial homolog` na A, com linhas em 22 das 27 tabelas com `unit_id`). Por perfil, com `set local role` e claims reais: contagem sob RLS (total, da A, da B, da unidade 2) e DELETE total dentro de subtransação desfeita (efeito: linhas afetadas). Perfis: separa, producao, entrega, multi (restritos, empresa A), gestor, admin, unidade (gestor com escopo UNIT_LIST só na Matriz), outraB (empresa B), anon.

## Resultado

| Perfil | Situação |
|---|---|
| gestor, admin | 135 OK: nenhuma linha da empresa B |
| separa, producao, entrega, multi | 135 OK cada: lê só o permitido (mapa do app + catálogos), zero linha da B, nenhuma escrita além do mapa |
| outraB | 135 OK: não lê nem apaga linha da A |
| anon | 129 OK (0 linhas ou erro); 6 `PUBLICO_CATALOGO`: `categories`, `products`, `settings`, `coupons`, `companies`, `ibge_cities` |
| unidade | 114 OK; **21 GAP_UNIDADE** |

Zero vazamento entre empresas (A para B e B para A) em todas as tabelas.

## Achados (precisam de decisão, nenhum corrigido)

1. **Escopo por unidade não é aplicado pelo banco (GAP_UNIDADE).** Um usuário com `scope_mode = UNIT_LIST` só na Matriz lê as linhas da Filial em 21 tabelas: audit_events, employee_employments, employees, floor_executions, generated_report, inventory_sessions, loading_jobs, membership_unit_scopes, production_plans, production_records, production_releases, raw_material_entries, raw_material_movements, separation_jobs, stock_loss_records, stock_movements, stock_opening_balances, stock_policies, stock_returns, time_devices, urgent_demands. Só 1 política em todo o banco usa `can_access_unit` (a de `units`); o resto fica em RPCs (inventário). Hoje há uma unidade por empresa, então o efeito é nulo; vira vazamento quando houver filiais. Recomendação: política restritiva por unidade nessas tabelas antes da primeira empresa multiunidade.
2. **Entregador vê todos os pedidos da empresa, sem atribuição.** `entrega` e `multi` leem 3 de 3 `orders` e 6 de 6 `order_items` da empresa A, sem filtro de carga, rota ou responsável (as colunas de responsável são texto livre: `loading_responsible`, `delivered_by`). Está dentro do mapa atual (Entrega lê pedidos), mas não há "meus pedidos" no banco. Recomendação: se o app Entrega deve mostrar só a carga do entregador, criar vínculo entregador-carga e política; senão registrar como aceito.
3. **Anônimo lê catálogo de todas as empresas.** `products` (20 = 19 A + 1 B), `categories`, `settings`, `coupons` (ativos) e `companies` (status ACTIVE, política `companies_public_select`, papel PUBLIC) são legíveis sem login e sem filtro de empresa. É a vitrine pública, porém `companies` expõe razão social e documento (`legal_name`, `document`) de todas as empresas ativas. Recomendação: limitar colunas por view pública ou política; decisão do responsável.
4. Operadores restritos leem catálogos globais (`permissions`, `plans`, `plan_versions`, `group_permissions`, `units`): sem dado de empresa, aceitável.
5. `company_integration_credentials`: nenhum autenticado tem SELECT (correto).

## Limites

- Escritas testadas só como DELETE; INSERT e UPDATE por perfil não foram exercidos de forma genérica. DELETE que falhou por gatilho/regra aparece como `null` (não contado como bloqueio provado).
- Escopo de unidade: 5 das 27 tabelas com `unit_id` não ganharam linha na Filial (conflitos de unicidade/regra: employee_employments, inventory_counts, production_diaries, stock_period_closings; `stock_ledger` é view), então a evidência de GAP vem das demais.
- Perfis `rot-*` testados por JWT simulado, não por login real.
- Não substitui teste por API/navegador (critério 8).
