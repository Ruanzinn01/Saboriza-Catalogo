# Levantamento de lacunas por etapa (pacote mestre x código)

Data: 2026-10-16 · Base: `90b2cb1` (trabalho/ondas-chief-of-staff) · Somente leitura: nada foi implementado, nada aplicado em banco, nada enviado ao remoto.
Fontes: `ORIS360_PACOTE_MESTRE_PROGRAMADOR_23_PACOTES.zip` (patches `*_PATCH_FINAL.md`, checklists), PDFs `Especificacao_*` em Downloads (texto extraído onde possível), código em `src/` e `supabase/migrations`. Consulta SELECT em produção (`cron.job`, contagem de `inventory_*`/`audit_events`), sem escrita.
Limites de leitura: os PDFs de Receitas, Financeiro Geral, DRE, Fechamento e Auditoria foram lidos pelos `PATCH_FINAL.md` do pacote (resumo oficial), não página a página. Onde a conclusão depende de PDF não lido, está marcado "a confirmar".
Numeração: não localizei no pacote uma lista oficial de "etapas 5/7/8/9/10"; adotei os nomes do pedido (5 Venda até entrega, 7 Tarefas/missões/roteiros, 8 Colaboradores/ponto/espelho, 9 Gestão salarial e outbox, 10 Chão de fábrica). Não confundir com as "Etapas 1-5" de `docs/integracoes/ETAPA_*.md`.
A auditoria da memória de 2026-10-01 estava defasada em vários pontos (Financeiro Geral, Fechamento e DRE já existem; ver abaixo).

---
## BLOCO FINANCEIRO (prioridade 1)

### Visão geral do que existe
Telas em `src/pages/admin/`: `DespesasPage`, `NovaDespesaPage`, `despesas/*` (Pessoal, Colaborador, Comissões, Vencimentos, Origem), `ReceitasPage`, `AportesPage`, `PatrimonioPage`, `FinanceiroGeralPage`, `DREPage`, `FechamentoPage`, `PainelProprietarioPage`, `IntegracoesFinanceirasPage`, `ErrosSistemaPage`. RPCs: `create_expense_launch`, `pay_salary_advance`, `reverse_salary_advance`, `generate_salary_obligation`, `change_salary_due_date`, `create_expense_adjustment`, `block_expense`, `create_asset_investment`, `get_financeiro_geral_summary`, `get_dre_monthly`, `get_owner_panel_summary`, `set_monthly_close_automation`.

### F1. Despesas V3 (spec: `10_MODULO_DESPESAS_V3/.../DESPESAS_V3_PATCH_FINAL.md`, checklist A-H)
Especificado: fato único; Visão Geral, Lançamentos Mensais, Nova Despesa, Salários & Vales; competência x vencimento x agendada x efetiva separadas; salário só da Gestão Salarial (colaborador+vínculo+competência); vale não cria despesa; estorno preserva original; caso Micael (3.000 / 300 / 2.700); anexos, beneficiário, setor/centro, rateio, parcelas, forma de pagamento; idempotência; auditoria completa; sem Asaas direto.
Existente: salário/vale por `salary_obligations`/`salary_advances` (RPCs; estorno único por índice parcial em `reversed_advance_id`, `20261014150319`); parcelas e forma de pagamento (`20261009184049`); catálogo/categorias (`expense_catalog_items`, `expense_categories`); lançamento unificado (`expense_launches/_items/_installments`); fechamento imutável de campos econômicos (`private.expenses_guard_closed_period`, `20261002132241`); ajuste pós-fechamento como novo fato (`create_expense_adjustment`); bloqueio com 3 modos (`block_expense`); folha nos totais (`20261014164335`).
Lacunas (valor/risco):
1. Pagamento parcial/baixa de despesa grava direto na tabela pelo cliente (`src/store/despesas-store.ts:394`, `update` em `expenses`), sem RPC atômica, sem auditoria e sem histórico de pagamentos (não existe tabela de pagamentos de despesa). Risco: baixa dupla/concorrente, saldo sem trilha. Spec exige idempotência (§15) e auditoria (§16).
2. Sem auditoria nos pagamentos manuais (só as RPCs listadas gravam `audit_events`).
3. Anexos/comprovantes: inexistentes (sem tabela/bucket para despesa). Depende de decisão.
4. Setor/centro de custo e rateio: inexistentes (`expenses` sem coluna). Depende de decisão.
5. Beneficiário mestre (fornecedor) em `expenses`: só `employee_id` (ver `docs/fornecedores/LEVANTAMENTO_LACUNAS.md` D3/D10).
6. Recorrência: `expense_recurrences` existe e é lida (`expense-launch-store.ts:213`), mas nenhum job materializa fatos futuros (`cron.job` de produção: só `monthly-close-rollover`, `oris360-monthly-close-sweep`, `estoque-inventory-sync`).
7. Estado `CANCELADO` ausente no check de `expenses.status` (ABERTO/AGENDADO/PAGO/ATRASADO); a confirmar se migrations posteriores alteraram.
8. Bloqueio de "salário manual" (§8): `NovaDespesaPage.tsx:312` oferece item "Salário" por colaborador; regra de bloqueio ponta a ponta não verificada (a confirmar).
Candidatas seguras: (a) RPC atômica e idempotente de pagar/estornar despesa, com auditoria e testes PGlite, preservando a semântica atual (parcial, estorno); (b) auditoria nos fluxos manuais. Dependem de decisão: 3, 4, 5, 6.

### F2. Receitas (spec: `11_RECEITAS/.../RECEITAS_PATCH_FINAL.md`)
Especificado: receita = outras entradas (não venda, não aporte); competência/vencimento/data efetiva; parcelas; recebimento parcial sem quitar tudo; recorrência com fatos futuros; pagador rastreável sem texto livre; sem Asaas direto; sem recebimento duplicado.
Existente: `revenues`, `revenue_receivables`, `revenue_receipts` (estorno por `reversed_receipt_id`); parcelamento; recebimento parcial e estorno (`src/store/receitas-store.ts:162-240`).
Lacunas:
1. Recebimento e estorno são ler-modificar-gravar no cliente: inserem `revenue_receipts` e depois fazem `update` do saldo em `revenue_receivables` (linhas ~177-196 e ~216-232). Sem transação nem trava; dois cliques/abas podem gerar recebimento duplo; não há índice único em `reversed_receipt_id` (só existe para vales), então o mesmo recibo pode ser estornado duas vezes. Risco alto de integridade.
2. Nenhuma auditoria em Receitas (nenhuma migration de receitas chama `record_audit_event`).
3. Recorrência indefinida não materializada; pagador como texto livre (a confirmar no formulário).
4. Conciliação com Asaas/extrato depende da Integração Mestre (funções de borda não publicadas).
Candidatas seguras: RPCs atômicas de receber/estornar com índice único de estorno, auditoria e teste de concorrência. Dependem de decisão: recorrência, pagador mestre.

### F3. Contas a pagar / a receber
Especificado: Contas a Pagar = saldo por parcela vinculada à origem econômica; Contas a Receber = cobranças + recebíveis; aging a vencer/1-7/8-15/16-30/+30 (Fechamento V2 §10); equação saldo inicial + novos - baixas = final.
Existente: `DespesasVencimentosPage`; `receivables` (vendas) e `revenue_receivables`; totais A Receber/A Pagar no Financeiro Geral.
Lacunas: (1) não há consulta/tela única de Contas a Pagar nem de Contas a Receber consolidando vendas + outras receitas; (2) aging por faixa inexistente; (3) equação de saldo inicial/final por período inexistente (depende de fotografia do mês anterior; a confirmar fonte).
Candidata segura: RPC de aging de A Pagar/A Receber somente leitura (faixas são especificadas).

### F4. Financeiro Geral (spec: `12_FINANCEIRO_GERAL`)
Existente: `get_financeiro_geral_summary` (entradas/saídas, aportes dentro de entradas, investimentos dentro de saídas, composição, A Receber/A Pagar, central de atenção, folha incluída desde `20261014164335`).
Lacunas: Saldo Disponível e Projeção D+10/20/30 retornam `disponivel:false` ("sem motor de caixa"). O pacote cita Contas Financeiras/ledger consolidado, mas não localizei o modelo de contas bancárias nos arquivos lidos. Depende de decisão (DP-FIN-6).

### F5. DRE Gerencial (spec: `16_DRE_GERENCIAL`)
Especificado: Receita Bruta - deduções = Líquida; - CMV/CPV = Lucro Bruto; - despesas operacionais; - juros/multas/taxas = Resultado; fontes por módulo; snapshots históricos por item; rateios com versão; produto sem custo sinalizado; navegação resumo, composição, fato, origem; PDF/planilha pelo mesmo motor.
Existente: `get_dre_monthly` (`20261014164335`) e `DREPage` (101 linhas, uma linha por mês, sem filtros).
Lacunas:
1. CMV/CPV e encargos financeiros fixos em `0::numeric` na RPC; lucro bruto = receita líquida, resultado superestimado. Depende de decisão (DP-FIN-3).
2. Despesas operacionais por `due_date` e só status `PAGO` (não por competência; Despesas V3 §11 diz competência = valor econômico integral). DP-FIN-1.
3. Possível dupla subtração: líquida = bruta + outras - deduções, com bruta somando `orders.total_amount`; se `total_amount` já é líquido de desconto, o desconto sai duas vezes. A confirmar (DP-FIN-1b).
4. Sem drill-down, filtros, exportação, snapshots por item nem sinalização de produto sem custo.
Candidatas seguras: composição por categoria e lista dos fatos do mês (leitura, sem mudar a fórmula); exportação CSV/impressão com o mesmo resultado da RPC. Dependem de decisão: 1, 2, 3.

### F6. Fechamento Mensal (spec: `15_FECHAMENTO_MENSAL_V2`)
Especificado: sem botão fechar/reabrir; encerra na virada pelo fuso da empresa; 10 etapas com Pronto/Atenção/Crítico; pendências durante o mês com origem, severidade e link; snapshot imutável; equações de A Receber e A Pagar; último dia com contagem regressiva e prévia exportável.
Existente: `monthly_closes` (snapshot, pendencies, checksum), `company_closing_settings`, `FechamentoPage` (101 linhas: lista de meses + toggle de automação), snapshot com Resultado/Recebíveis/Obrigações/Sócios/Patrimônio (`20260930124350`).
Lacunas:
1. Dois jobs de fechamento ativos em produção: `oris360-monthly-close-sweep` (a cada 30 min) e `monthly-close-rollover` (diário 03:00); ambos gravam em `monthly_closes`, com snapshots possivelmente distintos. DP-FIN-2.
2. Pendências: a coluna existe, mas não há cálculo das pendências especificadas (despesa incompleta, pagamento sem vínculo, aporte sem sócio/origem, produto vendido sem custo, divergência Asaas). A tela só lista.
3. Sem as 10 etapas/estados, prévia, contagem regressiva ou exportação; Caixa/Estoque/Comercial `disponivel:false`.
4. Fuso: confirmar que ambos os jobs usam o fuso da empresa (a confirmar nas funções).
Candidata segura: calcular pendências com dados existentes (despesa sem categoria/competência/vencimento, aporte sem sócio, parcela vencida) com origem e link, sem inventar limiares. Dependem de decisão: unificação dos jobs; limiares Pronto/Atenção/Crítico.

### F7. Central Geral de Auditoria (spec: `17_CENTRAL_GERAL_AUDITORIA_V2`)
Especificado: 9 abas (Visão Geral, Logs, Detalhe, Exceções/Alertas, Usuários, Casos, Relatórios, Políticas, Integridade); cards e gráficos com dados reais; before/after; filtros; detalhe imutável; exportação com o filtro ativo; casos de auditoria; hash.
Existente: `audit_events` (append-only por trigger, RLS de leitura, permissões `audit.read`/`audit.read_sensitive`), `private.record_audit_event`, 15 linhas em produção, `get_outbox_health`. Nenhuma tela: não há rota nem página de auditoria (`ErrosSistemaPage` trata só erros do cliente).
Lacunas: (1) tela inexistente; (2) `audit_events` sem colunas módulo/nível/before/after/motivo/hash (tudo iria em `payload`); (3) nenhuma emissão em Receitas, Aportes, Faturar (`oris360_billing_confirm`), Patrimônio manual e pagamentos de despesa; (4) exceções, alertas, casos, políticas e integridade inexistentes.
Candidatas seguras: tela de leitura (Visão Geral + Logs + Detalhe imutável) com RPC paginada por empresa e permissão `audit.read`, exportação com o filtro ativo; emissão de eventos nos fluxos sem trilha (aditivo). Dependem de decisão: modelo before/after/nível/módulo (DP-FIN-4), exceções/casos/hash.

### F8. Aportes, Patrimônio, Painel do Proprietário
Aportes: `partner_contributions` gravado pelo cliente (`aportes-store.ts:116-170`), sem índice único de estorno e sem auditoria. Patrimônio: escritas diretas em `asset_units`/`asset_movements` (`patrimonio-store.ts:181-212`), exceto apropriação e investimento (RPC). Painel: saldo e projeção indisponíveis (mesmo bloqueio de caixa). Candidata segura: mesmas RPCs atômicas + índice único + auditoria.

### Ordem sugerida do bloco (nenhuma cria regra nova)
1. RPCs atômicas e auditadas para pagar/receber/estornar (Despesas, Receitas, Aportes) + índices únicos de estorno.
2. Central de Auditoria somente leitura (Visão Geral, Logs, Detalhe).
3. Aging de A Pagar/A Receber (leitura).
4. Pendências reais no Fechamento (sem limiares).
5. DRE drill-down e exportação (sem mudar fórmula).
Bloqueados por decisão: CMV/CPV, DRE por competência, caixa/contas bancárias, setor/rateio, anexos, recorrência, unificar jobs de fechamento.

---
## ETAPA 5 — Venda até entrega
Especificado: Faturar V5 com análise de crédito; Separa Confere (aceite exclusivo, separação, conferência por produto, ajuste, offline, histórico, inventário); Carrega; Entrega e Registra (tela única, ER único, PDF salvo antes de FINALIZADO, parcial por pacote, NF-e/boletos para download).
Existente: `FaturarOrderPage` (717 linhas), `faturar-store` (`oris360_billing_quote/confirm`, crédito), Separa Confere admin e operador, `CarregaEntregaPage`, `EntregaConfirmacaoPage` (505) com `reserve_delivery_er` + upload de assinatura/PDF + `finalize_delivery` (servidor), CPF validado, parcial por pacote, `delivery-receipt-pdf.ts`.
Lacunas (valor/risco):
1. Entrega: download de NF-e e boletos inexistente (a tela só mostra a contagem de parcelas, `EntregaConfirmacaoPage.tsx:95`). Spec §7 condiciona a PDFs efetivamente armazenados (DP-E5-1).
2. Buckets `delivery-receipts`/`delivery-signatures` sem escopo por empresa; correção pronta em `supabase/pendentes/seguranca_storage_multiempresa.sql`, não aplicada (DECISOES_PENDENTES 1/5).
3. Entregador lê todos os pedidos da empresa (DECISOES_PENDENTES 10).
4. Separa Confere: comparar com spec seções 4 (envelhecimento visual), 3.3 (alerta sonoro/push), 12 (offline), 16.1 (gráfico semanal; `SeparationWeeklyDonut` existe). Alerta sonoro/push não localizados nas páginas do operador (`audio-beep.ts` existe; uso a confirmar). Offline: só `localStorage` no shell do operador.
5. Lote/FEFO na separação: não existe (ver estados abaixo).
6. Força de Vendas V3 (módulo 02): `ForcaDeVendasPage` com 209 linhas, comissões; app do vendedor (orçamento local, catálogo, missões) ausente. Decisão de escopo.
Candidatas seguras: itens do Separa Confere já especificados (alerta, envelhecimento, gráfico), após comparação página a página do PDF. Dependem de decisão: 1, 3, 6; aplicar o storage multiempresa depende de ordem do responsável.

## ETAPA 7 — Tarefas, missões, roteiros
Especificado (patch `19_*`): módulo Tarefas com Visão Geral, Tarefas, Mapa Semanal, Roteiros; tarefa simples com data obrigatória, hora e cliente opcionais; Biblioteca de Missões versionada (atividades, evidências, criticidade por atraso 0-2/3-5/6-9/10+, conclusão com assinatura); Roteiros recorrentes sem materializar o futuro; redistribuição em 5 alcances; Meu 360 consumindo.
Existente: `employee_tasks` (título, descrição, `due_date` opcional, status PENDENTE/EM_ANDAMENTO/CONCLUIDA/CANCELADA), `TarefasPage` (319), `tasks-store`. Não existem tabelas de missão, atividade, evidência, roteiro ou recorrência de tarefa.
Lacunas: 1. Missão/Roteiro/Mapa Semanal inexistentes; 2. tarefa simples sem hora/cliente e com data opcional; 3. sem criticidade por atraso; 4. sem auditoria de cancelamento.
Candidatas seguras: completar a tarefa simples (hora, cliente opcional, data obrigatória para novas, criticidade por atraso com as faixas especificadas, cancelamento com motivo e auditoria). Dependem de decisão: Missões/Roteiros/Mapa (DP-TAR-1).

## ETAPA 8 — Colaboradores, ponto, espelho
Especificado: Central de Colaboradores V4.1 (vínculos múltiplos/readmissão, vencimento salarial); Ponto Óris com Central administrativa (Apuração, Ocorrências, Espelho, Preparação da Folha), sequência por estado de jornada, ajuste preservando o original, recálculo em cascata, PDF como saída documental.
Existente: `EmployeesPage`, `EmployeeProfilePage` (1.307 linhas), `employee_employments` (`20261014173037`), revisão/conferência/consolidação/ajuste/espelho (`oris360_*_ponto`, `20261014173502`), guarda do banco de horas, `EmployeeTimesheetPage` (368) e `PontoRevisaoPanel` (351), `espelho-pdf.ts`, terminal `PontoOrisTerminalPage` + edge `ponto-oris-terminal` (não publicada).
Lacunas: 1. Central administrativa multi-colaborador (Apuração/Ocorrências de todos) inexistente: só espelho por colaborador (`/colaboradores/:id/espelho`); 2. "Preparação da Folha" como tela inexistente; 3. `employees` legível/editável por qualquer membro ativo (salário e Pix); correção em `supabase/pendentes/seguranca_salario_pix_*.sql`, não aplicada (DP-SAL-1); 4. edge functions não publicadas e sem teste em aparelho (DECISOES_PENDENTES 13).
Candidatas seguras: visão de Ocorrências do período (leitura sobre `time_occurrences`); lista de Apuração por período consumindo as RPCs existentes. Dependem de decisão: política de pausa/jornada, publicação das funções, permissões separadas de remuneração.

## ETAPA 9 — Gestão salarial e consumidores da outbox
Especificado: salário vem da Central; vale por `advance_id`; Meu 360 V2 com vale mínimo R$ 50 e 30% da formação elegível, sem aprovação humana, via Integração Mestre/cartão Asaas; consumidores: financeiro, Meu 360, Pulso, auditoria.
Existente: prévia salarial/obrigação/vencimento (`docs/integracoes/ETAPA_3_*`), `pay_salary_advance` e estorno, convergência de horas extras (`supabase/pendentes/20261015130000_*`, não aplicada), outbox + worker (`private.process_outbox_batch`, sem agendamento), consumidores `event_ledger` e `entity_state`, `get_outbox_health`.
Lacunas: 1. nenhum consumidor de negócio da outbox (`floor_journey_sync`, `payroll_preview`, `despesas_obrigacao`, `meu360_projecao`, `financeiro_geral`, `pulso`, `auditoria` estão previstos e não existem); 2. worker não agendado, sem retenção nem fila morta com responsável; 3. o Meu 360 atual é o terminal do chão (`Meu360Page`, edge `meu360-terminal`: identify/session/do assumir-avançar-concluir); o Meu 360 V2 (ponto, missões, vale, Meu Dinheiro) não existe; 4. webhook Asaas corrigido em `supabase/pendentes/20261015140000_*`, não aplicado nem publicado.
Candidata segura: consumidor `auditoria` (copia eventos para a trilha central; só append). Dependem de decisão: toda a parte de vale/autoatendimento (política, canal, Asaas); agendar o worker e retenção (DECISOES_PENDENTES 7).

## ETAPA 10 — Chão de fábrica e reflexos gerenciais
Especificado: Chão de Fábrica V10; Central de Gestão da Produção (períodos Hoje a 12 Meses, Planejado x Realizado, Produzido, Produtos, Equipe, Desempenho individual, Urgentes, qualidade dos dados); Produziu Registra V4 R3 (sem rateio por pessoa).
Existente: `ChaoDeFabricaPage` (216), `floor-store`, `CentralProducaoPage` (297: filtros de período, Planejado x Realizado, atenções, só leitura), Planos, Rotas versionadas, `urgent_demands` + `production-v3-store`, `PulsoPage` (79).
Lacunas: 1. participação individual e desempenho por pessoa: `floor_participations` não existe (proposta em `ETAPA_4_*`); 2. o patch da Central diz que a participação vem do Produziu Registra, mas a V4 R3 do cliente proíbe rateio ali (DP-PROD-1); 3. abas Equipe/Desempenho/Urgentes/Qualidade dos dados da Central não localizadas na página (a confirmar); 4. conversão de unidades por SKU inexistente; 5. Pulso 360 mínimo.
Candidatas seguras: bloco Urgentes (acompanhar, não cadastrar) e Qualidade dos dados na Central, só leitura. A regra crítica do rateio (nunca somar participação como produção) já é respeitada por não haver rateio. Dependem de decisão: participação por pessoa, unidade/conversões, política de jornada.

---
## Estados pedidos (apenas estado)
- Contagem de inventário do operador restrito (Separa Confere Inventário V2): EXISTE. Banco: `inventory_sessions`, `inventory_session_items`, `inventory_snapshots`, `inventory_counts` e funções `inventory_create_session/list_sessions/session_items/begin_count/register_count/release_item/request_recount/close_session/session_results` (`20261013185605`, endurecida em `20261014150418_separa_confere_v3.sql`). Front: rotas `/operacao/separa-confere/inventario` e `/inventario/:itemId` (`src/App.tsx:135-136`; `OperatorInventoryPage`, `SeparaConfereInventoryItemPage`), admin `InventoryTab`/`InventoryStartSheet`/`InventoryResults`, `inventory-store.ts`, `inventory.test.ts`. Produção (SELECT): 4 tabelas e 13 funções `inventory_*` presentes; 0 sessões e 0 contagens (nunca usado). DP-GRANTS-2 e a decisão 6 (separador conta inventário?) seguem abertas.
- Uso duplo de item: NÃO feito (nenhum vestígio em `src`, `supabase` ou `docs`).
- Correção de compras com rateio: PARCIAL. `correct_launch_item` (`20261014033522`) só corrige linha recebida de compra SEM rateio (sem frete, outras despesas ou desconto); com rateio não há correção. Histórico em `purchase_corrections`.
- Lote na separação (FEFO): NÃO feito. Lotes e validade existem só no Estoque (`20261014021021`, `EstoqueLotes.tsx`); `separation-store.ts` não referencia lote e não há ocorrência de FEFO no código.
- Central de PDFs: SÓ REGISTRO. Existe `generated_report` (módulo, tipo, período, filtros, `storage_ref`, `checksum`; `20261002140551`) e `relatorios-store`; só Despesas chama `registerReport` (`ReportModal.tsx:61`). Não há armazenamento do arquivo, listagem global nem integração do Estoque (a tela de Conexões declara "integração ainda não existe").

## Itens enviados a DECISOES_PENDENTES.md
DP-FIN-1, 1b, 2, 3, 4, 5, 6, 7, DP-E5-1, DP-TAR-1, DP-PROD-1 (seção "Levantamento de etapas e Financeiro (2026-10-16)").
