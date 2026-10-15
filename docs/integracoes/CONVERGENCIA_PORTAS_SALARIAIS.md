# Convergência das três portas salariais em um único comando (ESPECIFICAÇÃO, não implementada)

Nada aqui foi aplicado em produção. Liquidação salarial não está conectada ao Asaas.

## Situação atual: três caminhos formam dinheiro de salário
1. `public.generate_salary_obligation(employee, competência)`: forma a obrigação mensal em `salary_obligations`.
2. `public.create_expense_launch(...)` com natureza salário: o caminho do lançamento manual.
3. `public.oris360_resolver_banco_horas(employee, minutos, 'PAGO')`: hoje insere em `expenses` (natureza SALARIO), contrariando a fonte única `obligations/advances`.

Cada porta valida vínculo, competência e duplicidade de um jeito próprio. A competência ambígua só é recusada nas portas 1 e 2 (patch `correcoes_pre_homologacao.sql`).

## Contrato proposto: `public.register_salary_item(p_employee_id, p_competence, p_kind, p_amount, p_source, p_idempotency_key)`
- `p_kind`: `BASE`, `HORA_EXTRA_PAGA`, `VALE` (extensível).
- Passos, numa transação, SECURITY DEFINER, `search_path` vazio:
  1. Permissão: `despesas.manage` (ou permissão específica de folha) na empresa do colaborador.
  2. Vínculo único no período (`employee_employments`); mais de um vínculo no mês levanta `COMPETENCIA_AMBIGUA`.
  3. Idempotência: chave `p_idempotency_key` única por empresa; repetição devolve o mesmo id sem criar nada.
  4. Grava SOMENTE em `salary_obligations` / `salary_advances`. Nunca em `expenses`.
  5. Emite evento de outbox com nonce por alteração (sem perda).
- As três portas viram invólucros finos: chamam este comando e preservam a assinatura pública atual (compatibilidade com o app antigo).

## Mudança de comportamento a decidir com o cliente
O pagamento de banco de horas deixa de criar linha em `expenses` e passa a compor a obrigação do mês. Impacta os KPIs de Despesas (hoje `getAllExpenses()` mescla as duas fontes). Precisa de decisão e de teste em homologação antes de implementar.

## Plano de teste (a executar em PGlite e depois em homologação)
- As três portas, para o mesmo colaborador e competência, produzem o mesmo estado e não duplicam.
- Repetição com a mesma chave não cria segunda linha.
- Dois vínculos no mês recusam nas três.
- Reversão do patch devolve os corpos originais (hash).

## Exemplo antes/depois: pagamento de 2h30 de banco de horas (PROPOSTA, sem mudança de comportamento autorizada)

Premissas: colaborador com hora normal de R$ 20,00 e adicional de 50%. 150 min pagos = R$ 75,00 (2,5 h x 20 x 1,5).

| Momento | Hoje (código atual) | Proposta (um único fato financeiro) |
|---|---|---|
| Onde nasce | `oris360_resolver_banco_horas(..., 'PAGO')` insere uma linha em `expenses` (natureza SALARIO, status ABERTO, competência = mês corrente) e uma saída `PAGO` no banco de horas ligada por `expense_id` | O mesmo comando cria um item de obrigação salarial `HORA_EXTRA_PAGA` em `salary_obligations`, ligado à saída `PAGO` do banco de horas e ao vínculo do período. Não cria linha em `expenses` |
| Competência | mês corrente na hora do clique (não do trabalho) | mês das horas aprovadas no Espelho (fato de origem); o mês do clique deixa de decidir |
| Vencimento | não existe: a despesa não tem vencimento próprio | `due_date` explícito do item (regra da folha); pode diferir da competência |
| Despesas | aparece como despesa avulsa ABERTA, e a folha pode contar o mesmo salário de outro jeito | aparece dentro da obrigação do colaborador na competência, via `getAllExpenses()`, sem segunda linha. KPI só muda de lugar se o cliente autorizar |
| Caixa | só quando alguém marca a despesa como paga | só no pagamento (`paid_at`), nunca na criação, no vencimento ou no agendamento |
| Autorização | `timesheet.apuracao.manage` para resolver; pagamento depois, em Despesas | resolver o banco exige `timesheet.apuracao.manage`; pagar exige `despesas.manage`. Passos separados, ambos auditados |
| Estorno | não há estorno automático; cancelar a despesa deixa a saída `PAGO` no banco | estorno cria evento inverso: item vira ESTORNADO, o saldo de horas volta por lançamento compensatório (histórico imutável), caixa só recua se já tinha sido pago |
| Duplicidade | nada impede pagar as mesmas horas por outra porta | chave de idempotência por (colaborador, competência, origem) |

Estados: competência (a que mês pertence) → vencimento (quando deve ser pago) → agendamento (data programada, opcional) → pagamento (quando o dinheiro saiu). Cada um é um campo e um evento próprio.

Esta seção é proposta para decisão do cliente. Nada foi implementado nem aplicado; Despesas e KPIs seguem como estão.
