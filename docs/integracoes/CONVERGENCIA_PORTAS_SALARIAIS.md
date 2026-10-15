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
