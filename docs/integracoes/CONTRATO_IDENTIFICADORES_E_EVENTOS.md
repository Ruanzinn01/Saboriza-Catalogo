# Integrações Mestre V2 — contrato de identificadores, eventos e estado das interfaces

> Atualizado em 15/10/2026 (etapas 1 a 5). Os documentos `ETAPA_*` e `RECONCILIACAO_*` desta pasta prevalecem sobre este quando divergirem. Este arquivo mantém o mapeamento de identificadores e o histórico do Pacote 0.

Base: pacote ORIS360_Integracoes_Mestre_V2 (10/10/2026) cruzado com o código deste repositório e com o banco `saboriza` (inspeção somente leitura em 15/10/2026). Este documento é o mapeamento físico dos contratos semânticos; não substitui o PRD/RFC do pacote.

## 1. Identificadores (nome do contrato → coluna real)

| Contrato V2 | Físico neste sistema | Observação |
|---|---|---|
| `company_id` / `tenant_id` / `empresa_id` | `company_id` | Mesma identidade; `unit_id` pertence à empresa e não a substitui. |
| `employee_id` / `colaborador_id` | `employees.id` | |
| `employment_id` / `vinculo_id` | `employee_employments.id` | Cada período de contratação é uma linha própria e imutável depois de encerrada (etapa 1). Recontratar abre o período seguinte; o anterior permanece íntegro. `salary_obligations.employment_id` e `time_punches.employment_id` apontam para o período; os eventos levam o `employment_id` real. |
| `competence` | `date` (1º dia do mês) | `salary_obligations.competence`, `time_period_states.competencia`. |
| chave da obrigação salarial | `UNIQUE (employee_id, competence)` | `company_id` é derivado do colaborador (trigger). |
| vencimento | `salary_obligations.due_date` + `due_date_source` | Obrigatório (NOT NULL). Origem: `competence_closing`, `payroll_calendar`, `manual_adjustment`, `legacy_convention`. |
| chave da batida | `time_punches.idempotency_key` (único global) | Retry só devolve a batida se colaborador, dispositivo, empresa e tipo forem os mesmos (409 `IDEMPOTENCY_CONFLICT` caso contrário). |
| ator | `auth.uid()`; ausente = `SYSTEM` | |

## 2. Eventos (outbox transacional)

Caminho único: `private.emit_event(...)` grava em `transactional_outbox` dentro da mesma transação do fato, via gatilhos. Idempotente por `(company_id, idempotency_key)`. O payload nunca leva PIN, salário, valor de vale, chave Pix, caminho de foto nem dados bancários; o consumidor lê o fato pelo id.

| Evento | Escritor (gatilho) | Payload mínimo | Estado |
|---|---|---|---|
| `punch.recorded` | `time_punches` AFTER INSERT | employee_id, employment_id, type, server_time, device_id | **ativo** |
| `salary_obligation.created` | `salary_obligations` AFTER INSERT | employee_id, employment_id, competence, due_date, due_date_source | **ativo** |
| `salary_obligation.due_date_changed` | `salary_obligations` AFTER UPDATE | due_date, previous_due_date, due_date_source | **ativo** |
| `salary_obligation.updated` | `salary_obligations` AFTER UPDATE | employee_id, competence | **ativo** |
| `salary_advance.created` / `.paid` / `.reversed` | `salary_advances` | salary_obligation_id, employee_id, competence | **ativo** |
| `AttendanceRevisionChanged`, `PayrollPrepared`, `PayrollAuthorized` | Apuração / Salarial | — | **aguarda** revisão de Apuração e motor de composição |
| `AdvanceReserved`, `SettlementApplied`, `SettlementReversed` | Financeiro | — | **aguarda** tabela de liquidações e canal de pagamento |
| `ParticipationChanged` | Chão | — | **aguarda** participação por pessoa/papel |
| `FinishedProductionConfirmed`, `InventoryAdjustmentApproved` | Produziu / Estoque | — | já há registro e movimento; evento a ligar na etapa B5 |

O worker existe (etapa 5) mas **não está agendado**: a outbox só acumula (`PENDING`) até a ativação. Consumidores, tentativas, ordenação e monitoramento estão em `ETAPA_5_OUTBOX_EVENTOS_CONSUMIDORES_E_INTERFACES.md`; nenhum módulo de negócio consome a outbox.

## 3. Estado das interfaces (I01–I32)

Legenda: **OK** existente e verificada · **PARCIAL** existe com lacuna · **AUSENTE** · **AGUARDA** depende de outro bloco.

| Grupo | Interfaces | Estado | Evidência / lacuna |
|---|---|---|---|
| Fundação e identidade | I01–I03 | **PARCIAL** | `company_id` consistente e RLS ativa. Sem histórico de vínculo (recontratação sobrescreve). |
| Configurações e vigências | I04 | **PARCIAL** | `salary_history` e `resolve_salary_base` existem (leitura pela data do 1º dia da competência, sem proração). Escala/timezone/regras sem vigência própria. |
| Terminal → Ponto | I06 | **PARCIAL** | Endurecido no código (empresa validada, idempotência por escopo, foto recuperável, colaborador ativo e da unidade). **Função ainda não publicada** — ver §4. |
| Ponto → Apuração | I07, I08 | **PARCIAL** | RPCs `oris360_apurar_*` existem; ajustes imutáveis e auditados. Sem revisão no resultado. |
| Apuração → Meu Ponto/Espelho | I09 | **AUSENTE** | Sem tabela/rotina de Espelho; `time_period_states` existe e está sem uso (0 linhas). |
| Jornada → Chão | I10 | **AUSENTE** | `floor_assume_execution` não consulta jornada. |
| Salarial | I11–I13 | **PARCIAL** | Obrigação única, vencimento explícito, vales sem duplicidade. Sem composição por horas, conferência ou autorização. Duas portas (`generate_salary_obligation` e `create_expense_launch`) com unicidade garantida no banco, mas sem comando único. |
| Contas a Pagar / Financeiro | I14, I19 | **OK** | Folha entra em Despesas, Financeiro Geral, Painel do Proprietário e DRE (migração 20261014164335). |
| Vale (Meu Dinheiro) | I15, I16 | **PARCIAL** | Vale pago/estorno único e aplicado à obrigação. Sem reserva atômica, limite de 30% e mínimo de 50. |
| Gateway / liquidação | I17, I18, I20 | **AUSENTE** | Sem tabela de liquidações. Webhook Asaas só trata cobranças e notas e marca `processed_at` mesmo com falha de atualização. |
| Chão / Missões / Relatório | I21–I23 | **AUSENTE** | `floor_executions` guarda um único responsável; sem intervalos, papel de apoio, ranking ou relatório individual. Missões = `employee_tasks` simples. |
| Planos, Rotas, Produziu, Estoque | I24–I26 | **OK/PARCIAL** | Fluxos existem (ondas anteriores de estoque). Sem evento para consumidores. |
| Pulso, Auditoria, Realtime | I27–I29 | **PARCIAL** | Auditoria server-side existe (`audit_events`) e agora também cobre folha. Realtime não publica nenhuma tabela de ponto. |
| Documentos, Meu 360, deep-links | I30–I32 | **AGUARDA** | Dependem de Espelho e composição salarial. |

## 4. Mudanças aplicadas nesta etapa

- **Banco (aplicado):** emissão de eventos (`20261014164932`). Aditivo, sem tabela nova. Testado com rollback: 1 evento por fato, retry e duplo clique não duplicam, payload sem valor/salário/PIN/foto.
- **Código local, não publicado:** `ponto-oris-terminal` (C03–C07) e `meu360-terminal` (C10). As funções de borda em produção continuam na versão anterior até serem publicadas e testadas com um dispositivo real.
- **Front:** chave de idempotência estável por intenção no terminal de ponto; Meu360 mostra o erro em vez de descartá-lo (C11).

## 5. Ordem recomendada

1. Publicar e testar as funções de borda do ponto e do Meu360 com um dispositivo real.
2. Revisão de Apuração (`time_period_states` com `revision_number`, consulta com revisão) e Espelho.
3. Composição salarial e comando único para as duas portas de folha.
4. Participação humana no Chão (intervalos por pessoa e papel), depois relatório e ranking.
5. Liquidações e gateway, somente após confirmar a capacidade de pagamento do Asaas.
6. Worker da outbox e consumidores (Meu 360, Pulso, documentos).

## 6. Riscos abertos

- Fechamento de ponto ignora recálculo (`on conflict do nothing`): após um ajuste o saldo do banco de horas pode ficar defasado.
- Recontratação sobrescreve campos de vínculo em `employees`.
- Webhook Asaas não serve como base para pagar salário.
- O DDL de ponto, folha e RH está só no banco, não nas migrações versionadas; exportar antes de mudanças maiores.
- `timesheet_enabled` não é exigido na batida (a identificação também não exige). Decisão de produto pendente.
