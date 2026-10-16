# Convergência das horas extras pagas: implementação preparada e comparação de KPIs

Estado: PREPARADA em `supabase/pendentes/20261015130000_convergencia_horas_extras_obrigacao.sql` (+ `_reverter.sql`). Não aplicada em produção nem em homologação. Aplicar depende de decisão do cliente (impacto em Despesas/DRE, abaixo). Prova: `docs/integracoes/EVIDENCIA_TESTES_CONVERGENCIA_HORAS_EXTRAS.txt` (44 verificações, banco reconstruído em PGlite).

## O que muda
- `oris360_resolver_banco_horas(..., 'PAGO')` (mesma assinatura) deixa de inserir em `expenses` e grava `salary_obligation_items` (HORA_EXTRA_PAGA) na obrigação do colaborador, na competência de origem das horas (FIFO dos créditos). Se a folha da competência ainda não existe, recusa com `OBRIGACAO_INEXISTENTE` e não grava nada.
- `private.salary_balances` soma os itens ativos ao devido; Financeiro Geral, Painel do Proprietário e DRE não foram alterados. Sem itens, os KPIs ficam idênticos (provado).
- `reverse_overtime_payment`: estorno como evento inverso (item ESTORNADO, horas voltam ao banco, bloqueia se a folha já foi paga além do valor sem as horas).
- Pagamentos antigos (linhas em `expenses`) não são reescritos; estorno deles continua em Despesas.

## Comparação (mesmo fato: 150 min, hora R$ 20,00, adicional 50% = R$ 75,00; folha de setembro R$ 4.400,00)
| KPI | Antes (A) | Depois (B) |
|---|---|---|
| A pagar com a hora extra em aberto | 4.475 | 4.475 |
| Saídas de caixa do mês após pagar tudo | 4.475 | 4.475 |
| DRE, despesas operacionais, total | 4.475 | 4.475 |
| DRE por mês | 2026-09: 4.400; 2026-10: 75 (mês do vencimento da despesa) | 2026-09: 4.475 (mês da competência) |
| Linhas em `expenses` do colaborador | 1 | 0 |

Única diferença: as horas extras trocam de mês no DRE (do vencimento da despesa para a competência de origem) e deixam de aparecer como despesa avulsa. A tela de Despesas só mostra o item quando o front sintetizar `additions`/itens (não feito: `buildSalaryVirtualExpenses` usa só `base_salary`).

## Pendências
- Decisão do cliente: aceitar a mudança de mês no DRE e o desaparecimento da despesa avulsa.
- Front: Despesas/Colaboradores precisam exibir o item (ou `additions`) e chamar o estorno.
- Ordem: aplicar depois de `seguranca_salario_pix_2_restritiva.sql` (aquele arquivo recria a função antiga).
