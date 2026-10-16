# Resultado da homologação: Clientes V1 e Fornecedores V1 (2026-10-16)

Projeto `dfynvpieyvvameftrent` (somente homologação). Script: `scripts/homologacao/http/clientes_fornecedores.mjs` (GoTrue + PostgREST + RPC reais, perfis @homolog.test; URL e chave só em variável de ambiente). Produção não foi tocada.

## Aplicação (uma por vez, via apply_migration)
1. `20261016100000_fornecedores_v1_categorias_possiveis`: aplicada.
2. `20261016141000_fornecedores_v1_mestre_complemento`: aplicada.
3. `20261016140000_clientes_v1_mestre`: aplicada.
4. `20261016142000_clientes_v1_fix_conflito_revisao_errcode` (arquivo novo, ver Falha real): aplicada.
Pré-condição: `oris360_credit_authorize/overview/request_release` já existiam na homologação.
Conferido por SELECT: 15 tabelas novas, todas com RLS; nenhuma função de fornecedores/clientes/candidatos com EXECUTE para `anon`; `anon` sem nenhum GRANT em `suppliers`; `authenticated` só com SELECT em `suppliers`.

## Dados sintéticos (SQL direto na homologação)
Empresa A: 3 fornecedores (ativo, inativo, com categoria), 2 categorias, 2 possíveis fornecedores, 6 clientes (PJ, PF, inativo), 2 faturamentos confirmados, 3 títulos (1 vencido, 1 pago em dia, 1 a vencer), limites de crédito, 2 compras de fornecedor com parcela paga e vencida. Empresa B: 1 fornecedor, 1 categoria, 1 possível fornecedor, 1 cliente.

## Falha real encontrada e correção em arquivo novo
- **CONFLITO_REVISAO travava a API (HTTP 504).** `oris360_customer_save` e `oris360_customer_set_status` levantam o conflito com errcode `40001`. O PostgREST repete a transação em 40001 e a chamada não responde (medido: >200 s). Prova isolada: função de teste com `PT409` respondeu 409 em 0,5 s; com `40001` não respondeu em 25 s. A migration 140000 não foi editada; correção em `supabase/pendentes/20261016142000_clientes_v1_fix_conflito_revisao_errcode.sql` (errcode PT409). Casos C20 e C24b passam depois dela.

## Achados que dependem de decisão (ver DECISOES_PENDENTES.md, DP-HCF-1 a 5)
- Escrita direta em `customers` segue aberta para vendedor e producao (INSERT/PATCH/DELETE por REST), fora do fluxo com revisão/command_id/auditoria.
- DP-FORN-6, perfis que perdem leitura de `suppliers`: vendedor, separador, entregador (0 linhas). Mantêm: OWNER, producao (9 linhas).
- Lista de clientes: separador e entregador negados (403); vendedor e producao leem sem saldos.
- `create_order` não roda na homologação por colisão antiga de número de pedido (fixture da empresa B); regressão usou pedido sintético em CONFIRMED.

## Resultado por caso
Total 137: PASSOU 135, FALHOU 0 (na execução final, após a correção 142000), BLOQUEADO 2.

| Perfil | Caso | Resultado | Detalhe |
|---|---|---|---|
| gestor | login GoTrue | PASSOU | http 200 |
| vendedor | login GoTrue | PASSOU | http 200 |
| separador | login GoTrue | PASSOU | http 200 |
| entregador | login GoTrue | PASSOU | http 200 |
| producao | login GoTrue | PASSOU | http 200 |
| outra | login GoTrue | PASSOU | http 200 |
| gestor | F01 le suppliers so da empresa A | PASSOU | 7 linhas, B=0 |
| gestor | F02 SELECT direto em suppliers_bank_details (OWNER tem banco.read) | PASSOU |  |
| gestor | F03 create_supplier | PASSOU | http 200 |
| gestor | F04 idempotencia command_id (replay devolve o mesmo id) | PASSOU | http 200 |
| gestor | F05 mesmo command_id com corpo diferente = CONFLITO_COMANDO | PASSOU | http 400 CONFLITO_COMANDO: este command_id já foi usado com outro conteúdo |
| gestor | F06 documento duplicado = DUPLICADO | PASSOU | http 400 DUPLICADO:68731710-63ea-4a91-a6af-1885b6a73764 |
| gestor | F07 cadastro novo sem documento e recusado | PASSOU | http 400 Informe o documento |
| gestor | F08 find_supplier_by_document acha o recem-criado | PASSOU | http 200 |
| gestor | F09 update_supplier com revisao correta | PASSOU | http 200 |
| gestor | F10 update com revisao antiga = CONFLITO_REVISAO | PASSOU | http 400 CONFLITO_REVISAO: o fornecedor foi alterado por outra pessoa (revisão  |
| gestor | F11 inativar fornecedor (sem excluir) | PASSOU | http 200 |
| gestor | F12 reativar fornecedor | PASSOU | http 200 |
| gestor | F13 leitura confirma estado gravado | PASSOU | {"active":true,"city":"Ananindeua","revision":4} |
| gestor | F14 create_supplier_category | PASSOU | http 200 |
| gestor | F15 categoria duplicada normalizada devolve a mesma (created=false) | PASSOU | http 200 |
| gestor | F16 vincular categorias ao fornecedor | PASSOU | vinculos=2 |
| gestor | F17 categoria inativa nao aceita nova associacao | PASSOU | http 400 Categoria inativa não aceita novas associações |
| gestor | F18 inativar categoria preserva vinculos existentes | PASSOU | vinculos=2 |
| gestor | F19 exportacao so devolve fornecedores da empresa A | PASSOU | linhas=2 |
| gestor | F20 register_supplier_candidate | PASSOU | http 200 |
| gestor | F21 idempotencia do possivel fornecedor | PASSOU | http 200 |
| gestor | F22 command_id reutilizado com outro corpo = CONFLITO_COMANDO | PASSOU | http 400 CONFLITO_COMANDO: este command_id já foi usado com outro conteúdo |
| gestor | F23 busca de possiveis fornecedores por produto declarado | PASSOU | total=3 |
| gestor | F24 registrar contato (revisao sobe) | PASSOU | http 200 |
| gestor | F25 converter em fornecedor formal | PASSOU | http 200 |
| gestor | F26 conversao repetida e idempotente (mesmo fornecedor) | PASSOU | http 200 |
| gestor | F27 OWNER grava favorecido/banco/Pix | PASSOU | http 200 |
| gestor | F28 OWNER confere os dados (VERIFICADO) | PASSOU | http 200 |
| gestor | F29 leitura padrao vem mascarada | PASSOU | conta=••••7654 |
| gestor | F30 alterar conta invalida a conferencia (PENDENTE) | PASSOU | http 200 |
| vendedor | F31 banco/Pix negado (get/set/verify e SELECT direto) | PASSOU | get 400 set 400 verify 400 select 200/0 |
| separador | F31 banco/Pix negado (get/set/verify e SELECT direto) | PASSOU | get 400 set 400 verify 400 select 200/0 |
| entregador | F31 banco/Pix negado (get/set/verify e SELECT direto) | PASSOU | get 400 set 400 verify 400 select 200/0 |
| producao | F31 banco/Pix negado (get/set/verify e SELECT direto) | PASSOU | get 400 set 400 verify 400 select 200/0 |
| gestor | F32 gestor A nao ve banco do fornecedor da B | PASSOU | n=0 |
| gestor | F33 ficha financeira: comprado=1500, pago=1000, em aberto=500, vencido=500 | PASSOU | comprado=150000 pago=100000 aberto=50000 vencido=50000 pontual=100% |
| gestor | F34 lista financeira traz o fornecedor e so da empresa A | PASSOU | linhas=9 |
| gestor | F35 itens sem fonte saem como indisponiveis (nao zero) | PASSOU | credits_advances,reversals,interest_fees_discounts,returns,cancelled_launches,supplier_item_codes_sku |
| vendedor | F36 posicao financeira de fornecedor negada | PASSOU | 400/400 |
| separador | F36 posicao financeira de fornecedor negada | PASSOU | 400/400 |
| entregador | F36 posicao financeira de fornecedor negada | PASSOU | 400/400 |
| producao | F36 posicao financeira de fornecedor negada | PASSOU | 400/400 |
| vendedor | F37 escrita em fornecedores negada (RPC e direta) | PASSOU | rpc 400 ins 403 upd 403 del 403 cat 400 |
| vendedor | F38 leitura de suppliers (DP-FORN-6) e de possiveis fornecedores | PASSOU | suppliers: 0 linhas / candidates: 0 linhas |
| separador | F37 escrita em fornecedores negada (RPC e direta) | PASSOU | rpc 400 ins 403 upd 403 del 403 cat 400 |
| separador | F38 leitura de suppliers (DP-FORN-6) e de possiveis fornecedores | PASSOU | suppliers: 0 linhas / candidates: 0 linhas |
| entregador | F37 escrita em fornecedores negada (RPC e direta) | PASSOU | rpc 400 ins 403 upd 403 del 403 cat 400 |
| entregador | F38 leitura de suppliers (DP-FORN-6) e de possiveis fornecedores | PASSOU | suppliers: 0 linhas / candidates: 0 linhas |
| producao | F37 escrita em fornecedores negada (RPC e direta) | PASSOU | rpc 400 ins 403 upd 403 del 403 cat 400 |
| producao | F38 leitura de suppliers (DP-FORN-6) e de possiveis fornecedores | PASSOU | suppliers: 9 linhas / candidates: 0 linhas |
| gestor | F39 ate o OWNER so escreve fornecedor por RPC (REST direto negado) | PASSOU | ins 403 upd 403 del 403 |
| outra | F40 empresa B so ve fornecedores da B | PASSOU | 4 linhas |
| outra | F41 B le fornecedor da A por id | PASSOU |  |
| outra | F42 B nao altera fornecedor da A (RPC) | PASSOU | http 400 Fornecedor não encontrado |
| outra | F43 B nao inativa fornecedor da A | PASSOU | http 400 Fornecedor não encontrado |
| outra | F44 B nao ve ficha financeira de fornecedor da A | PASSOU | http 400 Fornecedor não encontrado |
| outra | F45 B nao grava banco de fornecedor da A | PASSOU | http 400 Fornecedor não encontrado |
| outra | F46 B nao mexe em categorias do fornecedor da A | PASSOU | http 400 Fornecedor não encontrado |
| outra | F47 B PATCH direto em fornecedor da A | PASSOU | http 403 permission denied for table suppliers |
| outra | F48 B cria fornecedor (so na propria empresa) | PASSOU | http 200 |
| outra | F49 fornecedor criado pela B pertence a B | PASSOU |  |
| outra | F50 lista financeira da B nao contem fornecedor da A | PASSOU | linhas=5 |
| anon | F51 RPCs de fornecedores negadas sem login | PASSOU | 401/401/401/401/401 |
| anon | F52 SELECT direto negado/vazio sem login | PASSOU | 401/null 401/null |
| gestor | C01 lista de clientes: financeiro disponivel, so empresa A | PASSOU | total=7 kpis={"total":7,"active":1,"prospect":5,"with_debt":1} |
| gestor | C02 situacao financeira: Restaurante com saldo vencido 716 e 1 titulo | PASSOU | aberto=716 vencido=716 cat=active |
| gestor | C03 filtro inadimplentes devolve so quem tem vencido | PASSOU | n=1 |
| gestor | C04 filtro em dia exclui o inadimplente | PASSOU | n=6 |
| gestor | C05 filtro inativos | PASSOU | n=1 |
| gestor | C06 busca por nome | PASSOU | n=1 |
| gestor | C07 busca por documento | PASSOU | n=1 |
| gestor | C08 categoria por ultima compra faturada (ativo<=30d, recente<=90d) | PASSOU | ativos=1 recentes=1 |
| gestor | C09 filtros cidade/UF e ordenacao por nome | PASSOU | n=0 |
| gestor | C10 paginacao devolve pagina valida | PASSOU | page=1/1 |
| gestor | C11 titulos: 1 em aberto a vencer, 1 pago em dia | PASSOU | abertos=1 pagos=1 |
| gestor | C12 resumo comercial: total faturado 716 e ultima compra | PASSOU | total=716 rank=2/6 |
| gestor | C13 capacidades do OWNER | PASSOU | {"member":true,"can_view_credit":true,"can_manage_limit":true,"can_propose_credit":true,"can_view_receivables":true} |
| gestor | C14 cria cliente (RPC) | PASSOU | http 200 |
| gestor | C15 idempotencia por command_id (mesmo cliente, replayed) | PASSOU | http 200 |
| gestor | C16 command_id com outros parametros = COMANDO_REUSADO | PASSOU | http 400 COMANDO_REUSADO: command_id ja usado com outros parametros |
| gestor | C17 documento duplicado = DOCUMENTO_DUPLICADO | PASSOU | http 409 DOCUMENTO_DUPLICADO: ja existe cliente com este documento |
| gestor | C18 CNPJ invalido e recusado | PASSOU | http 400 CNPJ invalido: 14 posicoes, as duas ultimas numericas |
| gestor | C19 edita cliente com revisao correta (sobe revisao) | PASSOU | http 200 |
| gestor | C20 revisao antiga = CONFLITO_REVISAO (HTTP 409, sem travar) | PASSOU | http 409 CONFLITO_REVISAO: o cadastro foi alterado por outra pessoa; recarregue |
| gestor | C21 contato adicional gravado | PASSOU | n=1 |
| gestor | C22 OWNER propoe limite de credito | PASSOU | http 200 |
| gestor | C23 inativar exige motivo | PASSOU | http 400 motivo obrigatorio |
| gestor | C24 inativar cliente com motivo | PASSOU | http 200 |
| gestor | C25 reativar cliente | PASSOU | http 200 |
| gestor | C24b inativar com revisao antiga = CONFLITO_REVISAO (HTTP 409, sem travar) | PASSOU | http 409 CONFLITO_REVISAO: o cadastro foi alterado por outra pessoa; recarregue |
| gestor | C26 excluir cliente com historico e bloqueado (CLIENTE_COM_HISTORICO) | PASSOU | http 409 CLIENTE_COM_HISTORICO: inative o cliente em vez de excluir |
| gestor | C27 eventos de auditoria do cliente (criado/atualizado/inativado/reativado) | PASSOU | eventos=5 |
| vendedor | C28 lista de clientes (observado) | PASSOU | permitida, financeiro=false, saldos=ocultos |
| vendedor | C29 sem permissao financeira os saldos ficam ocultos | PASSOU | finance=false |
| vendedor | C30 titulos do cliente negados (sem billing.view_receivables) | PASSOU | http 200 corpo=null |
| vendedor | C31 propor limite/condicao de credito negado | PASSOU | http 403 sem permissao para propor condicoes comerciais |
| vendedor | C32 INSERT/DELETE direto em customers (observado) | PASSOU | insert 400 delete 409  |
| separador | C28 lista de clientes (observado) | PASSOU | negada http 403 sem acesso a empresa |
| separador | C30 titulos do cliente negados (sem billing.view_receivables) | PASSOU | http 200 corpo=null |
| separador | C31 propor limite/condicao de credito negado | PASSOU | http 403 sem acesso a empresa |
| separador | C32 INSERT/DELETE direto em customers (observado) | PASSOU | insert 403 delete 200  |
| entregador | C28 lista de clientes (observado) | PASSOU | negada http 403 sem acesso a empresa |
| entregador | C30 titulos do cliente negados (sem billing.view_receivables) | PASSOU | http 200 corpo=null |
| entregador | C31 propor limite/condicao de credito negado | PASSOU | http 403 sem acesso a empresa |
| entregador | C32 INSERT/DELETE direto em customers (observado) | PASSOU | insert 403 delete 200  |
| producao | C28 lista de clientes (observado) | PASSOU | permitida, financeiro=false, saldos=ocultos |
| producao | C29 sem permissao financeira os saldos ficam ocultos | PASSOU | finance=false |
| producao | C30 titulos do cliente negados (sem billing.view_receivables) | PASSOU | http 200 corpo=null |
| producao | C31 propor limite/condicao de credito negado | PASSOU | http 403 sem permissao para propor condicoes comerciais |
| producao | C32 INSERT/DELETE direto em customers (observado) | PASSOU | insert 400 delete 409  |
| outra | C33 B nao lista clientes da A | PASSOU | http 403 sem acesso a empresa |
| outra | C34 B lista so os proprios clientes | PASSOU | total=1 |
| outra | C35 B le cliente da A por id | PASSOU | n=0 |
| outra | C36 B nao altera cliente da A (RPC) | PASSOU | http 403 sem acesso a empresa |
| outra | C37 B nao cria cliente na empresa A | PASSOU | http 403 sem acesso a empresa |
| outra | C38 B nao inativa cliente da A | PASSOU | http 403 sem acesso a empresa |
| outra | C39 B nao ve titulos nem resumo comercial de cliente da A | PASSOU | null/null |
| outra | C40 B PATCH direto em cliente da A | PASSOU | http 200 |
| outra | C41 tabela customer_commands nao e legivel pelo cliente da API | PASSOU | http 403 permission denied for table customer_commands |
| anon | C42 RPCs de clientes negadas sem login | PASSOU | 401/401/401/401/401 |
| anon | C43 SELECT direto em customers/customer_contacts negado ou vazio | PASSOU | 200/0 401/null |
| vendedor | R01 create_order segue funcionando | BLOQUEADO | colisao pre-existente de orders_order_number_key com fixture (pedido da B com numero vazio); nao ligada a clientes/fornecedores |
| vendedor | R02 leitura de pedidos e itens preservada | PASSOU | pedidos=3 itens=6 |
| separador | R02 leitura de pedidos e itens preservada | PASSOU | pedidos=3 itens=6 |
| entregador | R02 leitura de pedidos e itens preservada | PASSOU | pedidos=3 itens=6 |
| producao | R02 leitura de pedidos e itens preservada | PASSOU | pedidos=3 itens=6 |
| separador | R03 separation_accept_order segue funcionando | PASSOU | http 200 |
| separador | R04 separation_set_item muda o estado real | PASSOU | http 200 separado_em=sim |
| entregador | R05 reserve_delivery_er (entrega) executa sem erro de permissao em fornecedores | BLOQUEADO | http 403 Sem acesso a este app (perfil sem o app de entrega no schema reconstruido; nao prova nada sobre fornecedores) |
| producao | R06 create_production (producao) executa | PASSOU | http 200 |
| producao | R07 PRODUCAO mantem leitura de fornecedores (operations.factory.read) | PASSOU | 9 linhas |

Observação: na primeira execução o caso C20 falhou (504) antes da correção 142000; os demais passaram.
