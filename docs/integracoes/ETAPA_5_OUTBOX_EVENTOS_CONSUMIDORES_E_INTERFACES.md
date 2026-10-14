# Etapa 5 — Outbox, worker, consumidores e correspondência com as interfaces I01–I32

Estado em 15/10/2026. **Até esta etapa ser validada, os eventos são apenas registrados: nenhum módulo de negócio consome a outbox.** Hoje só dois consumidores internos de projeção existem (§3), e o worker **não está agendado**.

## 1. Worker e garantias

| Item | Implementação | Estado |
|---|---|---|
| Worker | `private.process_outbox_batch(limite)`: distribui eventos `PENDING` às entregas dos consumidores e processa as entregas devidas | no banco (aplicado), **sem agendamento** |
| Ativação futura | `select cron.schedule('outbox-worker', '* * * * *', 'select private.process_outbox_batch(50)');` (o `pg_cron` já existe no projeto) | **não executado** |
| Ordem | coluna `seq` (identidade) em `transactional_outbox`; processa por `seq` | aplicado |
| Idempotência do consumidor | `UNIQUE (event_id, consumer)` em `outbox_deliveries` + handler idempotente (`on conflict`) | testado |
| Tentativas | `max_attempts` por consumidor (padrão 5); espera `2^tentativa` minutos; cada entrega em subtransação própria (uma falha não derruba as outras) | testado |
| Falha definitiva | status `FAILED` com `last_error`; aparece no monitoramento | testado |
| Reprocessamento | `outbox_reprocess_delivery(id)` (permissão `saas.company.manage`, auditado): `FAILED`/`SKIPPED_STALE` → `RETRYABLE` | testado |
| Evento fora de ordem | consumidor `LATEST_WINS` guarda cursor `(consumer, entidade)`; evento com `seq` menor que o já aplicado vira `SKIPPED_STALE`; consumidor `ALL` (ledger) aplica todos | testado |
| Monitoramento | `get_outbox_health(empresa)` (permissão `audit.read`): pendentes, idade do mais antigo, entregas por status, lag por consumidor e alertas `ACUMULO_NA_OUTBOX` (> 5 min), `ENTREGAS_EM_RETENTATIVA`, `ENTREGAS_COM_FALHA_DEFINITIVA` | testado |
| Recuperação de lacunas | `get_integration_events_since(empresa, seq, limite)` sobre o ledger: o consumidor guarda o último `seq` e pede o que veio depois | testado |

Testes executados no banco de produção em transação com rollback forçado (nada persistiu): distribuição, repetição técnica (worker 2× sem efeito), falha simulada (3 tentativas → `FAILED`, outros consumidores aplicaram o mesmo evento), reprocessamento, evento antigo depois do novo (`SKIPPED_STALE` e estado mantido), acúmulo (alerta), cursor e negação sem permissão.

## 2. Chave de idempotência: repetição técnica × alteração legítima

Duas camadas diferentes: a **chave de emissão** impede o mesmo fato de gerar dois eventos; o **dedup do consumidor** `(event_id, consumer)` impede o mesmo evento de ser aplicado duas vezes.

| Evento | Chave de emissão | Repetição técnica | Nova alteração legítima do mesmo registro |
|---|---|---|---|
| `punch.recorded` | id da batida | o mesmo fato não emite de novo | outra batida = outro id |
| `employment.opened` / `.closed` | id do período | idem | nova contratação = novo período = novo id |
| `salary_obligation.created` | id da obrigação | idem | — (uma por colaborador/competência) |
| `salary_obligation.due_date_changed` | `id : vencimento_antigo>novo : txid` | mesma transição na mesma transação não duplica | A→B→A→B em transações diferentes gera um evento por mudança |
| `salary_obligation.updated` | `id : txid` | idem | duas mudanças em transações distintas geram dois eventos; duas na mesma transação viram um |
| `salary_advance.created` / `.paid` / `.reversed` | id do vale (+ tipo) | pagar ou estornar de novo não emite (a RPC é idempotente) | um vale só é pago e estornado uma vez (índice único) |
| `attendance.revision_generated` / `.reviewed` / `.consolidated` | id da revisão | gerar de novo com os mesmos dados devolve a mesma revisão, sem evento | dado novo = revisão nova = id novo |
| `attendance.mirror_issued` | id do Espelho | reemitir sem mudança devolve o mesmo | retificação = versão nova = id novo |
| `time_adjustment.created` | id do ajuste | idem | cada ajuste é um registro novo |

Limite conhecido: duas alterações do **mesmo campo na mesma transação** colapsam em um evento (`salary_obligation.updated`).

## 3. Consumidores

### Existentes (internos, ativos assim que o worker for agendado)
| Consumidor | Eventos | Ordenação | O que mantém |
|---|---|---|---|
| `event_ledger` | todos | `ALL` | livro durável `integration_event_ledger` (base do cursor de lacunas) |
| `entity_state` | todos | `LATEST_WINS` | último estado conhecido por entidade (`integration_entity_state`) |

### Previstos (não existem; cada um depende do módulo indicado)
| Consumidor previsto | Eventos | Depende de |
|---|---|---|
| `floor_journey_sync` (Chão) | `punch.recorded` | tabela de participação (etapa 4) e política de jornada |
| `payroll_preview` (Gestão Salarial) | `attendance.revision_consolidated`, `time_adjustment.created` | motor de composição e política remuneratória (etapa 3) |
| `despesas_obrigacao` (Despesas/Contas a Pagar) | `salary_obligation.*` | comando único de autorização; hoje Despesas lê direto a tabela |
| `meu360_projecao` (Meu Ponto/Meu Dinheiro) | `attendance.mirror_issued`, `salary_advance.*` | telas OWN do Meu 360 |
| `financeiro_geral` | `salary_obligation.*`, `salary_advance.paid/reversed` | hoje lê por RPC (`private.salary_balances`); evento só para invalidar cache |
| `pulso` | eventos de ponto configurados | configuração de privacidade do Pulso |
| `auditoria` | todos | hoje as RPCs gravam `audit_events` direto |

## 4. Dados sensíveis

O payload leva só **identificadores, competência, datas e contagens**. `private.emit_event` ainda remove as chaves `pin`, `pix_key`, `photo_path`, `salary`, `amount` e `bank`. Valor de vale, salário, foto e dados bancários **não** entram; o consumidor lê pela fonte com acesso autorizado (RLS ou RPC com permissão). Verificado por teste: nenhum payload gravado contém valor, salário ou PIN.

## 5. Correspondência eventos × interfaces (I01–I32)

Legenda: **E** evento ativo · **P** previsto, não emitido · **—** sem evento. "Consome hoje" = quem lê o evento: só `event_ledger` e `entity_state`.

| Interface | Evento | Consome hoje |
|---|---|---|
| I01 Fundação → todos | — (todo evento leva `company_id`) | — |
| I02 Identidade → Colaboradores/Ponto/Meu 360 | — | — |
| I03 Colaboradores → consumidores | E `employment.opened/closed` | ledger, state |
| I04 Configurações → Apuração/Salarial/Produção | P `EmployeeConfigurationChanged` | — |
| I05 Fundação → patch IAM | — | — |
| I06 Terminal → Ponto | E `punch.recorded` | ledger, state |
| I07 Ponto → Apuração | E `punch.recorded` (a Apuração deriva por consulta e digest; não lê o evento) | ledger, state |
| I08 Ajuste → Apuração | E `time_adjustment.created` | ledger, state |
| I09 Apuração → Meu Ponto/Espelho | E `attendance.revision_*`, `attendance.mirror_issued` | ledger, state |
| I10 Jornada → Chão | E `punch.recorded` | **nenhum** (`floor_journey_sync` previsto) |
| I11 Colaboradores/Apuração → Salarial | E `attendance.revision_consolidated` | **nenhum** |
| I12 Salarial → Gestão Salarial/Meu Dinheiro | P `PayrollPrepared` | — |
| I13 Conferência/autorização → obrigação | E `salary_obligation.created`; P `PayrollAuthorized` | ledger, state |
| I14 Programação salarial → Contas a Pagar | E `salary_obligation.created/due_date_changed` | ledger, state (Despesas lê direto) |
| I15 Meu Dinheiro → Adiantamentos | E `salary_advance.created`; P `AdvanceReserved` | ledger, state |
| I16 Vale confirmado → obrigação/Financeiro | E `salary_advance.paid/reversed` | ledger, state |
| I17 Contas a Pagar → gateway | — (bloqueada) | — |
| I18 Gateway → pagamentos | — (bloqueada) | — |
| I19 Obrigações/caixa → Financeiro Geral | — (lê por RPC) | — |
| I20 Retificação → fechamentos | E `attendance.revision_generated` (RETIFICADO); P para folha | ledger, state |
| I21 Chão → Central/Meu 360 | P `ParticipationChanged` | — |
| I22 Missões → Meu 360 | — | — |
| I23 Jornada + atividades → relatório | — | — |
| I24 Planos/Rotas → execução | — | — |
| I25 Chão/Produziu → Estoque | P `FinishedProductionConfirmed` | — |
| I26 SeparaConfere/Compras → Estoque | — | — |
| I27 Domínios → Pulso | — | — |
| I28 Domínios → Auditoria | RPCs gravam `audit_events` direto, em paralelo | — |
| I29 Eventos → projeções/realtime | ledger, state e cursor de lacunas (realtime não ligado) | ledger, state |
| I30 Revisões → documentos | E `attendance.mirror_issued` | ledger, state |
| I31 Meu 360 → áreas complementares | — | — |
| I32 Telas → origem autorizada | — | — |

## 6. Lacunas
1. Worker sem agendamento e sem validação em operação contínua.
2. Nenhum consumidor de negócio.
3. Sem fila morta com responsável definido (hoje `FAILED` + alerta; reprocessamento manual).
4. Realtime não publica tabelas de ponto nem as projeções.
5. A outbox acumula sem limpeza; política de retenção a definir.
