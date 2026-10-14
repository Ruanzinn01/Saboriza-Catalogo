# Etapa 4 — Chão de Fábrica: atribuição da produção, papel e relação com o ponto

Especificação. **Nada desta etapa foi implementado**; o Chão, o Meu 360 e o Produziu Registra seguem exatamente como estão. Conferido em 15/10/2026 no banco `saboriza`.

## 1. Como a produção é atribuída hoje

| Fato | Onde | Limite |
|---|---|---|
| Quem assumiu | `floor_executions.assumed_by_employee_id` | um único responsável por execução; não há troca registrada |
| Avanço de quantidade | `floor_execution_events` (`AVANCOU`, `quantity_delta`, `employee_id`) | atribuído a quem assumiu **no momento**; sem papel; sem intervalo |
| Rateio na confirmação | `production_participants` (`production_record_id`, `employee_id`, `allocated_units`) | só unidades; sem papel (responsável/apoio) e sem tempo |
| Entrada no estoque | `confirm_production_release` (Produziu) | movimento único; chave `idempotency_key`; a execução só fecha em um registro |
| Quantidade | `floor_executions.target_quantity` / `operational_quantity` inteiros | **sem unidade de medida** na execução |

Conclusões já verificadas: concluir a execução **não** movimenta estoque (só o Produziu confirma); o servidor passou a exigir (no código local do Meu 360) que só quem assumiu avance ou conclua.

## 2. Modelo proposto: participação por pessoa, papel e intervalo

Tabela nova `floor_participations` (não existe):

| Campo | Significado |
|---|---|
| `floor_execution_id`, `employee_id`, `employment_id` | quem, em qual execução e em qual período de contratação |
| `role` | `PRINCIPAL` ou `SUPPORT` |
| `started_at`, `ended_at` | intervalo real da pessoa (horário oficial do servidor) |
| `end_reason` | `SWITCH`, `JOURNEY_BREAK`, `JOURNEY_END`, `COMPLETED`, `MANUAL` |
| `source`, `revision`, `created_by` | origem (terminal, Meu 360, Central), versão e ator real |

Regras de domínio (no banco, não em `setInterval`):
- **um** `PRINCIPAL` ativo por execução; vários `SUPPORT` permitidos;
- uma pessoa não mantém duas participações produtivas ativas incompatíveis;
- trocar responsável ou apoio **encerra** o intervalo anterior com motivo e abre outro; o histórico não é sobrescrito;
- participação não define salário.

## 3. Como o ponto se relaciona com o período de trabalho

- **Duas medidas, duas funções:** ponto mede a **jornada oficial** (união das sessões da revisão aprovada, `J`); o Chão mede **dedicação** (união das participações ativas, `P`). Ciclo de máquina ou atividade aberta **não prova** dedicação contínua.
- **Cobertura** = `medida(P ∩ J) / medida(J)`. **Fora da jornada** = `medida(P − J)`, mostrado como divergência separada; não é cortado nem vira desconto. Tempo sem atividade classificada é *residual*, não prova de ociosidade.
- **Efeito das batidas** (aplicado no servidor, pelo consumidor do evento `punch.recorded`, no instante oficial da batida):
  - `INTERVALO` ou `SAIDA` encerra ou pausa **a participação da pessoa**; a execução e a máquina continuam; outro participante não é afetado.
  - `RETORNO` reabre a jornada, **não retoma** a participação sozinho.
  - Batida atrasada ou corrigida gera reconciliação versionada; **não apaga** fato produtivo.
- **Trava de jornada ativa** (política da empresa, ainda não definida): se ligada, bloquear novo início sem jornada válida. Não foi inventada.
- **Pré-requisitos já prontos:** período de contratação (`employment_id`), batidas efetivas com ajustes, revisão aprovada de ponto e o evento `punch.recorded` na outbox. **Faltam:** a tabela de participação, a política de trava e o consumidor `floor_journey_sync`.

## 4. Quantidades e comparação

- **Regra:** nunca somar nem comparar unidades diferentes (kg, unidades, packs) ou SKUs distintos sem conversão autorizada e versionada. Hoje **não existe** conversão e a execução **não tem unidade**, então nenhum total misto é permitido.
- **Quantidade atribuída** a uma pessoa vem de uma conclusão identificada (`completion_id`, etapa, SKU, unidade, papel). Apoio recebe **tempo**, não quantidade duplicada.
- Grupos de agregação: `(unit_id, sku_id, unidade, versão da atividade)`. Gráficos Semana/15 dias/Mês, cards e detalhe usam o **mesmo** escopo, fuso, corte e snapshot; futuro é nulo, zero só quando completo.
- **Ranking RANK-1** só calcula dentro de um grupo comparável: mesma unidade/SKU/atividade/unidade de medida/versão de referência/contexto de recurso; mínimo de 5 participações principais concluídas válidas, cobertura de referência ≥ 80% e ≥ 2 pares elegíveis; score = `100 × Σ minutos esperados do volume entregue ÷ Σ minutos produtivos reais`; exclui apoio, abertas, referência ausente e volume compartilhado sem atribuição; empate usa colocação compartilhada; sem amostra, `rank = null` com motivo. Ranking **não** gera desconto salarial nem aparece no Pulso/portal.

## 5. Interface com o resto

| Interface | Regra |
|---|---|
| Planos e Rotas → Chão | fornecem intenção e versão; planejar ou liberar **não cria acabado** |
| Chão → Produziu → Estoque | só o Produziu confirma acabado elegível e cria **um** movimento; retry não duplica |
| Chão → Folha | nenhuma; a produção não define salário |
| Chão → Central/Meu 360 | mesma execução e mesmo cronômetro, sem iframe nem timer paralelo |

## 6. Gaps e decisões do cliente
1. Unidade de medida e conversões por SKU (hoje só `sale_unit`, `unit_weight_grams`, `pack_quantity` em produtos).
2. Política de trava de jornada e de pausa por intervalo/saída.
3. Referência de produtividade por SKU/atividade (para RANK-1).
4. Se o apoio deve registrar tempo no Meu 360 ou apenas pela Central.
