# Pacote de produção: Clientes V1 + Fornecedores V1

Status: PROPOSTA. Nada foi aplicado e não houve push. Produção (`opeietrhbqlhrhljcdtx`) só foi lida por SELECT em 2026-10-16.
Provas em PGlite (`supabase/pendentes/prova_pacote_clientes_fornecedores.mjs` e as suítes citadas) NÃO substituem homologação real; a homologação (194 migrations, 136/137 casos de API) cobre o conjunto, mas não a combinação "somente estas 5" sobre a trilha de 186 (isso só o PGlite provou).

## 1. Conjunto mínimo e ordem exata (5 arquivos, todos em `supabase/pendentes/`)

1. `20261015120000_credito_cliente_fonte_unica.sql`  (OBRIGATÓRIA para Clientes: cria `receivable_payments`, `private.company_today`, `oris360_credit_*`; a 140000 usa os três)
2. `20261016100000_fornecedores_v1_categorias_possiveis.sql`
3. `20261016140000_clientes_v1_mestre.sql`
4. `20261016141000_fornecedores_v1_mestre_complemento.sql`  (pré-requisito: 2)
5. `20261016142000_clientes_v1_fix_conflito_revisao_errcode.sql`  (correção de 40001 para PT409; aplicar junto da 3, nunca sem ela)

Fornecedores (2 e 4) são independentes do crédito; Clientes (3) depende dele. Fora do conjunto, e NÃO necessárias: `apps_operacionais_isolados`, `correcoes_pre_homologacao`, `seguranca_*`, `convergencia_horas_extras`, `asaas_webhook`, `financeiro_rpcs_atomicas`.

Evidência de dependência:
- Todos os objetos referenciados por 2-5 e 1 existem em produção ou são criados pelo próprio conjunto: SELECT em `information_schema.tables`/`pg_proc` mostrou como únicos ausentes `customer_commands`, `customer_contacts`, `customer_media`, `receivable_payments` e `private.company_today` (todos criados pelas 1 e 3).
- PGlite: trilha de 186 + só estas 5 aplicam sem erro; 140000 sem a 1 "aplica" (plpgsql é late-bound) mas deixa `receivable_payments`/`company_today` inexistentes, ou seja, quebra em execução. Por isso a 1 é obrigatória.
- Suítes sobre esse banco: `testes_clientes_v1_mestre.mjs` 100 OK/0 falha; `testes_fornecedores_v1.mjs` 102/0; `testes_fornecedores_v1_complemento.mjs` 193/0; `testes_credito_cliente_replay.mjs` 55/0; `testes_central_auditoria_leitura.mjs` 36/0 (opcional, ver 3).

## 2. O que muda no comportamento atual (leia antes de decidir)

Crédito (item 1) altera fluxos vivos, mesmo que o dono só queira "Clientes":
- `oris360_billing_confirm` (Faturar) é substituída: passa a bloquear no servidor por `OVERDUE` e `OVER_LIMIT`. Em produção `customer_credit` tem 0 linhas (nenhum cliente com limite): faturar a prazo (parte financiada > 0) fica bloqueado para TODOS até alguém definir limite (`oris360_set_credit_limit`, permissão `customer_credit.change_permanent_limit`) ou autorizar por pedido. Faturar à vista não é afetado. Há 5 faturamentos, 18 títulos e 14 pedidos abertos hoje.
- Novo trigger `orders_sync_credit_commitment` em `orders`; `customer_credit`, `credit_commitments` e `receivables` (update/delete) perdem escrita direta de `authenticated`. Busca no `src/` não achou escrita direta do front nessas tabelas; só Edge Functions (service_role) tocam `receivables`.
- Nova permissão `billing.settle_receivable` (backfill para quem tem `billing.invoice_order`).
- Sem arquivo de reversão do crédito (ver 5).

Clientes (3): colunas aditivas com default; numera legado por empresa; trigger `customers_guard` (BEFORE INSERT/UPDATE; propor limite exige permissão) e `customers_no_delete_with_history`. Escrita direta em `customers` CONTINUA aberta (DP-HCF-1).

Fornecedores (4): RLS de `suppliers` muda: leitura por permissão (`fornecedores.read`, `despesas.read`, `operations.factory.*`, `estoque.movimentar`); INSERT/UPDATE/DELETE direto REVOGADOS (só RPC). Nome/telefone deixam de ser obrigatórios.

Antes x depois no PGlite (trilha 186 + 2 clientes + 2 fornecedores sintéticos; script citado):
- IGUAL: `create_order` pela vitrine (anon) com cliente novo e com cliente existente; cadastro rápido, update e delete (sem histórico) direto em `customers`; leitura de `suppliers` por membro com `despesas.read`.
- MUDA: membro sem permissão de fornecedores lê 0 (antes lia 2); INSERT/UPDATE direto em `suppliers` dá `permission denied` (antes ok).
- Dados preservados: 2 clientes/2 fornecedores antes e depois da aplicação, da reaplicação e das reversões.
- Front que grava direto: `src/store/customers-store.ts` (insert/update/delete em `customers`, usado em `CustomerInfoPanel`); `suppliers` NÃO tem escrita direta no front (só leitura em `suppliers-store.ts`, escrita por `callRpc`). Edge Functions escrevem `customers` (asaas/base) com service_role: não afetadas. Despesas guardam `supplier_id` (FK mantida); a gravação de despesa não passa pela RLS de escrita de `suppliers`.
- Produção: 5 clientes, 18 fornecedores, 2 empresas, 0 clientes sem empresa.

## 3. Front: quais commits e é seguro com só o conjunto mínimo?

O front da branch (HEAD `561f056`) chama RPCs fora do conjunto. Levantamento estático das chamadas `rpc*/callRpc` no `src/` contra trilha 186 + conjunto:
- Ausentes (7): `my_app_access`, `list_employee_compensation`, `list_commission_rates`, `set_employee_compensation`, `set_employee_commission_rate`, `operator_confirmed_billing_order_ids`, `operator_list_production_employees`, mais `audit_central_*` (chamada dinâmica, fora do levantamento automático).
- Tratamento: `my_app_access` cai em `my_access_profile`; compensação cai em leitura/escrita direta nas colunas (modo `legacy`); comissão tem fallback em PGRST202. Falham de forma isolada (toast/estado de erro) só as rotas `/operacao/*` (apps operacionais, inexistentes em produção) e `/admin/auditoria` (mostra estado de erro; o item de menu aparece).
- `src/lib/financeiro-rpcs.ts` não é importado por nenhuma tela (nenhum efeito).
- Conclusão: a branch inteira NÃO quebra nada com só o conjunto mínimo; degrada de forma isolada em Auditoria e operação. Os painéis de crédito ficam cobertos pela 1.
- Recomendado opcional: acrescentar `20261016121000_central_auditoria_leitura.sql` (somente leitura, aditiva, reversão `_REVERSAO.sql`, 36/36 no PGlite) depois da 5, para a Auditoria funcionar. Decisão do dono (DP-PKG-3).
- Alternativa mais conservadora: publicar o front em commit limitado. Commits de Clientes/Fornecedores: `e082cd8`, `3070010`, `62cfe39`, `40722db`, `252dfa0`, `cc32a0f` (Clientes); `69b5d0a`, `aca7cac`, `c117ee2`, `325733e`, `572ce78`, `35fbb05`, `561f056` (Fornecedores/homologação); crédito: `2b8b9fb`, `fd570aa`, `b537f6e`. Os demais (Auditoria `4efbad7`, RPCs financeiras `bbd0e3e`, seguranças, apps operacionais) podem ir ou ficar: não são necessários e, por serem tolerantes (acima), não são perigosos. Recortar por commit exige cherry-pick e não foi testado; a rota recomendada é a branch inteira.

## 4. Ordem front x banco

1. Pré-checagens (abaixo). 2. Backup/ponto de restauração decidido pelo dono (produção sem branch). 3. Aplicar as 5 (e opcionalmente 121000) uma a uma, cada uma como migration transacional, conferindo a pós-checagem. 4. Só então publicar o front (o front novo exige as RPCs, permissões e buckets `customer-media`/`supplier-files`; front antes do banco quebra Clientes e escrita de Fornecedores). 5. Roteiro de fumaça.
Edge Functions, variáveis Vercel e integrações: nada a fazer neste pacote.

## 5. Pré-checagens em produção (SELECT, todas esperadas como indicado)

```sql
select count(*), max(version) from supabase_migrations.schema_migrations;            -- 186, 20261014230013
select count(*) from public.customers; select count(*) from public.suppliers;          -- 5, 18 (anotar)
select to_regclass('public.receivable_payments'), to_regclass('public.customer_contacts'),
       to_regclass('public.supplier_categories'), to_regprocedure('private.company_today(uuid)'); -- todos NULL
select count(*) from public.customer_credit;                                           -- 0 (decide a decisão DP-PKG-1)
select count(*) from public.suppliers where company_id is null;                        -- 0
select count(*) from public.orders where status not in ('CANCELLED','COMPLETED');      -- anotar (14)
```

## 6. Pós-checagens

- Contagens de `customers` e `suppliers` idênticas às anotadas; `select count(*) from customers where display_number is null` = 0; `select count(distinct (company_id, display_number)) = count(*)`.
- `select count(*) from pg_policies where tablename='suppliers'` mostra `suppliers_select_by_permission` e sem `suppliers_admin_insert/update/delete`.
- Funções presentes: `oris360_customer_save`, `oris360_customers_list`, `oris360_credit_overview`, `oris360_billing_confirm` (nova), `oris360_supplier*` (conferir o prefixo em `pg_proc`).
- `select count(*) from public.permissions where key like 'fornecedores.%'` = 9; `billing.settle_receivable` existe.
- Conferir o errcode: um conflito de revisão deve responder HTTP 409 em ~1 s (não 504).
- `get_advisors` (somente leitura) sem novo alerta crítico de RLS.

## 7. Reversão por migration (ordem inversa: 5, 4, 3, 2, 1)

| Migration | Reversão | Observação |
|---|---|---|
| 142000 | reaplicar as duas funções de 140000 (errcode 40001) | não há arquivo próprio; evitar (volta ao travamento) |
| 141000 | `20261016141000_fornecedores_v1_mestre_complemento_REVERSAO.sql` | destrutiva: apaga colunas/tabelas novas e dados digitados; restaura RLS antiga |
| 140000 | `20261016140000_clientes_v1_mestre_REVERSAO.sql` | destrutiva: apaga colunas novas de `customers`; arquivos do bucket ficam |
| 100000 | `20261016100000_fornecedores_v1_categorias_possiveis_REVERSAO.sql` | só depois da 141000 |
| 20261015120000 crédito | NÃO EXISTE arquivo de reversão | mitigação: ponto de restauração/backup antes; ver DP-PKG-2 |

Provado em PGlite (trilha 186 + conjunto + dados sintéticos): as 3 reversões em ordem inversa rodam sem erro e mantêm 2 clientes/2 fornecedores. Não provado: reversão com dados novos gravados depois da aplicação (perdem-se por desenho).

Reaplicar: as migrations NÃO são idempotentes (1, 2, 3, 4 falham com "already exists" e não alteram dados; só a 5 é create or replace). Não rodar duas vezes; a checagem 5 evita isso e, aplicadas por migration transacional, a falha não deixa estado parcial.

## 8. Roteiro de fumaça para o dono (10 passos)

1. Entrar como gestor; abrir Clientes: lista carrega com os 5 clientes numerados 1-5.
2. Abrir uma ficha: cadastro, compras, títulos e crédito aparecem sem erro.
3. Cadastrar cliente novo (PF ou PJ) e editar; reabrir e conferir.
4. Editar o mesmo cliente em duas abas: a segunda recebe aviso de conflito (não trava).
5. Tentar excluir cliente com pedido: é recusado; inativar com motivo funciona e reativar também.
6. Fazer um pedido pela vitrine (pública) com cliente novo: o pedido chega e o cliente aparece.
7. Abrir Fornecedores: 18 fornecedores listados com KPIs; abrir uma ficha financeira.
8. Cadastrar fornecedor e editar; conferir que banco/Pix só aparece para o dono.
9. Lançar uma despesa escolhendo fornecedor existente.
10. Faturar um pedido à vista (deve passar); faturar a prazo (esperado: bloqueio por limite até definir limite do cliente; defina o limite e repita).

## 9. Riscos e o que NÃO entra

Riscos: (a) crédito bloqueia faturar a prazo até haver limite (DP-PKG-1); (b) sem reversão do crédito (DP-PKG-2); (c) perfis `vendedor`/`separador`/`entregador` perdem leitura de fornecedores (DP-HCF-2); (d) escrita direta em `customers` segue aberta (DP-HCF-1); (e) PGlite não prova PostgREST, Auth, Storage, concorrência nem RLS via API na combinação exata; (f) 1 caso de API real da homologação não passou (137 testes, 136 OK).
Não entram: apps operacionais, correções pré-homologação, segurança CPF/RG/telefone, segurança salário/Pix, storage multiempresa, higiene de grants, horas extras, webhook Asaas, RPCs financeiras, Edge Functions, variáveis Vercel, integrações reais.
