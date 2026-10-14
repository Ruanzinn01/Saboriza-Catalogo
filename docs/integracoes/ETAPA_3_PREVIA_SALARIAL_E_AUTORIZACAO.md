# Etapa 3 — Gestão Salarial e Despesas: da hora aprovada à obrigação

Especificação. **Nada desta etapa foi implementado em código ou banco**, por decisão do cliente (documentar primeiro). O que já existe está marcado como tal. Conferido em 15/10/2026 contra o banco `saboriza` e o código local.

## 1. Cadeia ponta a ponta

```
Ponto (batidas) → Apuração → Revisão conferida/consolidada ─┐
                                                            ├→ Prévia salarial → Conferência → Autorização → Obrigação (Despesas) → Vale/Pagamento
Salário vigente (salary_history) + política remuneratória ──┘
```

| Passo | Dono do fato | Situação hoje |
|---|---|---|
| Horas aprovadas | Apuração (`oris360_horas_aprovadas`) | **Existe** (etapa 2): só devolve horas de revisão conferida/consolidada e atual; senão `approved:false` com motivo. |
| Salário vigente | `salary_history` + `resolve_salary_base` | **Existe.** Lê pelo 1º dia da competência, sem proração de mudança no meio do mês. |
| Política remuneratória | configuração por regime (a definir) | **Não existe.** `employees` tem `monthly_divisor` e `timesheet_overtime_percent`, mas não há política por regime nem para extras, atraso ou falta. |
| Prévia salarial | Gestão Salarial | **Não existe.** Hoje a obrigação nasce direto com `base_salary`, sem componentes de horas. |
| Conferência / Autorização | Gestão Salarial | **Não existe.** |
| Obrigação | `salary_obligations` | **Existe** (um por colaborador/competência, vencimento explícito). |
| Vale, estorno, saldo | `salary_advances` | **Existe.** |

## 2. Como as horas aprovadas formam a prévia

1. **Entrada:** `oris360_horas_aprovadas(employee, competência)` → `{revision_id, revision_number, totals{normal, extra, late, worked}}`. Sem aprovação, a prévia fica **provisória** e identificada como tal; não há autorização possível.
2. **Componentes** (cada um com tipo, quantidade, taxa, origem, vigência, versão da regra):
   - `BASE` — salário vigente da competência (mensalista: regra própria de proporcionalidade; horista/comissionado exigem regra própria, ainda não configurada).
   - `HORAS_EXTRAS` — minutos extras aprovados × valor-hora × (1 + percentual da política).
   - `ADICIONAIS` / `DESCONTOS_AUTORIZADOS` — somente os autorizados e com origem; ajuste manual é exceção identificada (autor, motivo), nunca substitui o calculado.
3. **Precisão:** minutos inteiros; valor-hora = `salário ÷ divisor` (divisor ≤ 0 bloqueia o componente, nunca vira salário zero); intermediários com ≥ 8 casas; arredondamento HALF_UP2 por componente agregado; não multiplicar hora já arredondada.
4. **O que NÃO entra:** atraso ou falta **não** geram desconto automático; produtividade e quantidade produzida nunca definem salário; a regra de 50% para dias normais é do contexto de Colaboradores V4 e não vira percentual universal.
5. **Duas medidas distintas:** *formação acumulada até o corte* e *projeção do mês inteiro* têm base e corte próprios e nunca se somam.

## 3. Estados, conferência e autorização

`PREPARADO → EM_FORMACAO → CONFERIDO → AUTORIZADO`, mais `IMPACTO_PENDENTE` depois de autorizado.

- **Conferência** referencia a revisão do ponto, a versão salarial e a política usadas (digest das entradas). Qualquer mudança que afete valor ou elegibilidade **invalida** a conferência afetada antes de autorizar (mesmo princípio já implementado no ponto: `oris360_status_ponto` deriva `CONFERENCIA_INVALIDADA` pelo digest).
- **Autorização** é humana, com `expected_revision`, e guarda o **snapshot** de fontes, regras e componentes. Autorizar **não** agenda nem paga.
- **Concorrência:** comandos de conferência e autorização comparam revisão esperada sob transação (`REVISION_CONFLICT`).

## 4. Como a obrigação chega às Despesas sem duplicar

- **Chave única:** `(company_id, employee_id, employment_id, competence)` — hoje garantida por `UNIQUE (employee_id, competence)`; `employment_id` já existe na obrigação (etapa 1). Limitação: duas contratações no mesmo mês compartilham uma obrigação até existir proporção entre períodos.
- **Comando único de autorização** (a criar): `authorize_payroll` substitui as duas portas de hoje e a terceira:
  1. `generate_salary_obligation` — folha em lote (Despesas › Pessoal);
  2. `create_expense_launch` com `kind='salary'` — "Nova despesa"; **insere obrigação direto**, com o valor digitado no navegador;
  3. `oris360_resolver_banco_horas('PAGO')` — **cria despesa direta** de "Salários" (extras), fora da obrigação.
  As três devem convergir no mesmo comando; a 3ª passa a ser um **componente `HORAS_EXTRAS` da obrigação**, não uma despesa avulsa.
- **Sem segundo fato financeiro:** Despesas já lê a folha por `getAllExpenses()`, que sintetiza uma linha por obrigação (nunca persistida). Financeiro Geral, Painel e DRE leem `private.salary_balances`. Como o fato nasce só em `salary_obligations`/`salary_advances`, autorizar de novo não cria linha nova em `expenses`.
- **Retry/recálculo/fechamento:** repetir a autorização devolve a mesma obrigação. Recorrência prepara rascunho da competência seguinte; não autoriza.

## 5. Quatro datas, quatro significados

| Conceito | Campo | Regra |
|---|---|---|
| Competência | `salary_obligations.competence` | período econômico; nunca copiado para vencimento |
| Vencimento | `due_date` + `due_date_source` | obrigatório; origem registrada; alteração só por `change_salary_due_date` (motivo + auditoria) |
| Agendamento | **não existe** (hoje "Não agendado") | exigirá `scheduled_payment_date` próprio e capacidade confirmada do canal; previsão não é caixa |
| Pagamento | `salary_advances.paid_at` (vale) | só vale após confirmação; caixa realizado = vale pago e não estornado |

## 6. Correção depois da autorização ou do pagamento

- Depois de autorizada: registrar `IMPACTO_PENDENTE`; gerar **ajuste conferido e autorizado**, com identidade própria e referência à obrigação raiz (não disputa a chave da obrigação).
- Depois de pago: complementar ou reverter **somente a diferença**. Exemplo: líquido devido 3000 → 3100 com 3000 pagos = ajuste de +100, nunca pagar 3100 de novo.
- Vale: aplicado à competência de destino; estorno vinculado exclui a realização revertida uma única vez; vale pago antes da obrigação mantém registro e vincula depois (já ocorre: obrigação zerada reconciliada por `generate_salary_obligation`).
- Exemplo validado: obrigação 3000, vale pago 300 → saldo 2700 e custo 3000 (nunca 3300 nem 2700).

## 7. Pagamento

Fora desta etapa. O pagamento depende da **autorização** definida pelo sistema e de um canal confirmado. O webhook do Asaas teve o caso "marca processado apesar de falha" corrigido **no código local** (módulo `outcome.ts`, 5 testes unitários da decisão), **não publicado e não testado contra o Asaas**; portanto **nenhuma liquidação salarial está conectada**.

## 8. Pré-requisitos e decisões do cliente

1. Política remuneratória por regime (mensalista, horista, comissionado), percentuais de extra e tratamento de atraso/falta.
2. Composição elegível para vale pelo Meu Dinheiro (30%, mínimo 50) — sem ela o autoatendimento fica indisponível.
3. Calendário/dia previsto de pagamento por empresa e política de dias não úteis.
4. Capacidade do canal de pagamento contratado.
5. Proporção entre dois períodos de contratação na mesma competência.

## 9. Risco aberto conhecido
`employees` permite leitura e edição a qualquer membro ativo da empresa (RLS `is_active_company_member`), inclusive `salary_base` e `pix_key`. Permissões separadas de remuneração, vale e pagamento exigem papéis novos e aprovação.
