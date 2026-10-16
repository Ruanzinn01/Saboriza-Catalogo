# Levantamento de Clientes (etapa 4) — 2026-10-16

Fontes: pacote `ORIS360_Clientes_V1_Mestre_Completo` (PRD, campos e ações, mapa de substituição), migration pendente `supabase/pendentes/20261015120000_credito_cliente_fonte_unica.sql` (não aplicada), código em `src/`. Nenhum banco foi consultado ou alterado.

## Especificado x existente x lacunas

| Item do PRD | Existe hoje | Lacuna |
|---|---|---|
| Lista: busca, cartões mobile, link para ficha | `CustomersPage` (busca por nome/empresa/CNPJ/telefone, tabela desktop, cartões mobile, gráfico de atividade) | Sem filtros (cidade/UF/bairro/vendedor/situação), ordenação, paginação 10/20/30/50, busca sem acento, situação financeira, ícones mapa/foto, importar/exportar |
| Ficha: dados, resumo de pedidos, histórico | `CustomerDetailPage` | Sem atividade/visitas, tarefas, roteiros, compras mensais/ranking, produtos mais comprados, "Novo pedido", cadastro expansível |
| Crédito na ficha (limite, comprometido, disponível, excesso, vencido, gerir limite) | `CustomerCreditPanel` lê `oris360_credit_overview` e grava `oris360_set_credit_limit` | Nesta etapa: wrapper tipado e barra de proporção usada (barra limitada a 100%, excesso em texto). Falta histórico de pagamentos/pontualidade, parcelas e títulos abertos |
| Pagamentos e títulos (leitura) | RPCs `oris360_receivable_pay/reverse` existem na migration pendente; permissão `billing.settle_receivable` criada nela; sem tela | Fora do escopo da ficha pelo PRD (§6: não pagar títulos na ficha). Falta RPC de leitura (CL3) |
| Cadastro/edição compartilhado | `CustomerFormPage` + `CustomerFormFields` (contato, empresa, endereço) | Faltam PF/PJ, IE/isento, IBGE, lat/lon, fotos, vendedor/promotor, segmento/origem, limite proposto, bloqueio de saída com alteração, CNPJ alfanumérico (hoje só formato, ver D6 de Fornecedores) |
| Limite aprovado não muda ao salvar cadastro | Garantido no banco: escrita direta em `customer_credit` revogada, só RPC com permissão e motivo (migration pendente + teste PGlite) | Limite **proposto** não tem coluna (CL1) |
| Excluir x inativar | Excluir bloqueado se houver pedidos | PRD pede inativação (CL4) |
| Prospecção, conversão, tarefas/roteiros, mídia | Nada | Dependem de Tarefas/Missões e mídia oficial (CL6) |
| Integrações pedido x crédito | Banner no pedido, Faturar, reserva em CONFIRMED, bloqueio no servidor, liberação por operação | Já na migration pendente; não aplicada em nenhum banco |

## Implementado nesta etapa

- `src/lib/customer-credit.ts`: wrapper tipado (`supabase.rpc` com os tipos já presentes em `src/types/supabase.ts`) para `oris360_credit_overview` e `oris360_set_credit_limit`; cálculo de uso do limite; parser do limite (aceita "1000.5" e "1.500,25").
- `CustomerCreditPanel.tsx`: usa o wrapper e exibe barra de proporção utilizada com excesso em texto. Sem consulta ou sem permissão continua "indisponível", nunca "aprovado".
- Testes: `src/lib/customer-credit.test.ts`; `supabase/pendentes/testes_credito_concorrencia_pglite.mjs`.
- `scripts/homologacao/credito_concorrencia.sql`: roteiro de duas sessões com ROLLBACK, para rodar depois na homologação. Não foi executado.

## Concorrência de crédito

PGlite é monoconexão: consultas simultâneas são enfileiradas e `pg_advisory_xact_lock` nunca disputa. O teste PGlite prova só: dívida aberta nunca passa do limite em sequência de disputas, chave de idempotência repetida gera um único faturamento e todas as RPCs/gatilho de escrita tomam o lock por cliente. A prova real (segunda sessão esperando a primeira) depende do script em homologação.

## Decisões pendentes

CL1 a CL6 em `docs/homologacao/DECISOES_PENDENTES.md` (colunas novas, situação na lista, leitura de títulos, inativar x excluir, escopo por carteira, prospecção/tarefas/mídia).

## Não feito de propósito

Sem filtros/paginação/ordenação na lista (dependem de CL1/CL2 para filtros de vendedor/situação; os demais são só front e podem entrar na próxima etapa, sem regra nova). Sem migration aplicada, sem push, sem Edge Function.
