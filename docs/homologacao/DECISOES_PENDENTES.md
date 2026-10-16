# Decisões pendentes (só o responsável pode tomar)

Cada item: pergunta, recomendação, estado.

1. Aplicar em produção `180000, 181000, 221500, 224500, 223000 fase A`, depois salário/Pix 1 e 2, storage multiempresa, crédito, apps isolados. Recomendação: só após homologação completa e front publicado. NÃO executado.
2. Branch de homologação do Preview da Vercel + push; confirmar integração GitHub↔Supabase e Ignored Build Step no painel. NÃO executado.
3. Publicar frontend (merge na main) e separar commits de outras sessões. NÃO executado.
4. Fase B (bloqueio direto no banco ao operador só-Separa) após front no ar.
5. Restringir comprovantes de entrega ao app Entrega.
6. Roles que recebem `producao.operar`, `entrega.operar`, `admin.acessar`; separador conta inventário?
7. Manter ou desligar cron jobs da homologação; recursos pagos.
8. Testes em aparelho real (roteiro será preparado).
13. Teste de navegador (H01–H19, seção 7): BLOQUEADO nesta sessão (sem Claude in Chrome nem navegador embutido; o embutido não abre localhost do shell). Recomendação: abrir uma sessão com Claude in Chrome habilitado e rodar `npm run dev` com `.env.local` da homologação. Substituto parcial em andamento: teste por API real.
9. Escopo por unidade não aplicado pelo RLS (21 tabelas, ver `docs/apps-operacionais/MATRIZ_ISOLAMENTO_AMPLIADA.md`). Pergunta: exigir política restritiva por unidade antes da primeira empresa com filial? Recomendação: sim, antes de qualquer multiunidade em produção. NÃO executado.
10. Entregador lê todos os pedidos da empresa (sem vínculo carga/entregador). Pergunta: o app Entrega deve restringir a "minhas cargas"? Recomendação: criar vínculo e política se for requisito; senão registrar como aceito.
11. Anônimo lê `companies` (razão social e documento), `products`, `settings`, `coupons` de todas as empresas. Pergunta: publicar só colunas de vitrine por view? Recomendação: sim para `companies`; manter catálogo.
12. Login real dos usuários `rot-producao@`, `rot-entrega@`, `rot-multi@`, `rot-unidade@` (criados sem senha). Pergunta: o responsável define senhas em `C:\Users\rruan\homolog-credenciais.txt` para o teste por navegador/API? Recomendação: sim, antes da homologação com navegador real.

## DP-GRANTS-1 — RPCs SECURITY DEFINER sem checagem de empresa/permissão (levantadas em 2026-10-15, produção só leitura)
Pergunta: autoriza criar migration que adicione, no corpo, checagem de membro/permissão da empresa em adjust_stock, confirm_raw_material_entry, create_stock_entry, floor_advance_quantity, floor_assume_execution, floor_complete_execution, create_production, reverse_production e update_order_items? Hoje qualquer usuário autenticado de QUALQUER empresa pode executá-las (DEFINER ignora RLS).
Recomendação: sim, uma onda própria com teste PGlite multiempresa; para create_production e reverse_production (sem uso no front), a alternativa mais simples é revogar EXECUTE também de authenticated. Antes, confirmar com o dono que nenhum app operacional externo as chama.

## DP-GRANTS-2 — RPCs que exigem apenas "membro ativo"
Pergunta: inventory_begin_count, inventory_register_count, inventory_session_items, purchase_catalog, stock_integration_status, stock_lots, stock_position devem exigir permissão específica (ex.: estoque.*)? Podem ser intencionais para operador restrito.
Recomendação: manter por ora; revisar com o mapa de permissões do operador antes de endurecer.

## DP-SAL-1 — Fase 2 de salário/Pix muda a regra de update_employee_salary
Pergunta: confirma que, na fase 2, quem tem só despesas.manage (papel criado depois da fase 1) perde o direito de alterar salário?
Recomendação: sim (é o objetivo), e aplicar só depois do front publicado (ver docs/seguranca/SALARIO_PIX_FASE2_CONDICAO.md).

Cada item: pergunta objetiva e recomendação. Nenhum foi decidido pelo agente.

## Fornecedores V1 (2026-10-16)

- **D1 · Permissões.** Criar chaves próprias (`fornecedores.read`, `fornecedores.manage`, `fornecedores.categorias.manage`, `fornecedores.banco.read`...) ou manter `despesas.read/manage`? Recomendação: criar chaves próprias numa migration de permissões separada e trocar nas RPCs; até lá a migration usa `despesas.*`.
- **D2 · Campos obrigatórios e duplicidade.** Manter nome do contato, razão e telefone obrigatórios (NOT NULL hoje) ou relaxar para fantasia OU razão? Telefone igual deve bloquear, avisar ou ignorar? Recomendação: obrigar só fantasia ou razão; telefone apenas aviso; documento normalizado bloqueia com opção de vincular.
- **D3 · Mapa categoria financeira → categoria de fornecedor.** Categorias de despesa hoje são texto denormalizado pela RPC `create_expense_launch`, sem ID. Criar catálogo de categorias financeiras com ID antes do mapa? Recomendação: sim, em onda própria de Despesas; só depois a tabela de mapa por empresa.
- **D5 · Excluir fornecedor.** Manter exclusão (com bloqueio) ou trocar por inativar? Recomendação: inativar, e excluir só sem nenhuma referência (compras, produtos, códigos, créditos).
- **D6 · CNPJ alfanumérico.** Implementar o cálculo oficial de dígitos alfanuméricos? Hoje só se confere o formato. Recomendação: confirmar a regra oficial vigente e então estender `src/lib/cnpj.ts` com testes.
- **D8 · Arquivos, catálogos e cotações da avaliação.** Qual bucket, política de acesso, limite de tamanho e retenção? Recomendação: bucket privado por empresa com URL assinada de curta duração; só depois a tela de cotações.
- **D9 · Banco/Pix do favorecido.** Criptografia em repouso, permissão própria e fluxo de verificação. Recomendação: tabela separada, sem retorno em listagens, leitura só por RPC com permissão dedicada e auditoria antes/depois.
- **D10 · Fatos financeiros na ficha/lista.** Qual tabela/RPC é a fonte oficial de "compra confirmada", parcelas e baixas (expense_launches, obligations)? Data-base de compra: confirmação ou emissão? Recomendação: uma RPC de leitura agregada por fornecedor, no servidor, após decidir a data-base.
- **D11 · Colunas novas em `suppliers`.** Autorizar `active`, `revision`, PF/PJ, comprador, condições, operação, lat/lon e contatos adicionais (migration aditiva sobre tabela existente)? Recomendação: sim, em migration própria depois de homologar esta.
- **D12 · Rastreio da tabela `suppliers`.** A migration `add_suppliers_table_and_product_link` não está neste branch e a RLS de `suppliers` não foi lida. Recomendação: conferir contra a trilha reconstruída (commit 63aafb0) antes de aplicar qualquer coisa nova.
- **D13 · Categorias iniciais.** Carregar as 8 por botão em Configurações (como está) ou semear automaticamente ao criar a empresa? Recomendação: manter o botão.

## Clientes etapa 4 (2026-10-16)

- **CL1 · Colunas novas em `customers`** (PF/PJ, ativo/inativo, revisão, IBGE, lat/lon, vendedor/promotor, segmento, origem, limite proposto, prazo/forma preferenciais). Autorizar migration aditiva própria? Recomendação: sim, depois de aplicar a migration de crédito em homologação.
- **CL2 · Situação financeira na lista.** Não há RPC em lote (a ficha chama `oris360_credit_overview` por cliente). Criar RPC agregada por empresa (inadimplência/limite) ou aceitar uma coluna só na ficha? Recomendação: RPC agregada paginada no servidor; sem N chamadas do navegador.
- **CL3 · Histórico de pagamentos/títulos na ficha.** O PRD pede pontualidade, parcelas e títulos abertos, mas não há RPC de leitura de `receivable_payments` por cliente. Recomendação: RPC de leitura própria (permissão `billing.view_receivables`); baixa/estorno (`billing.settle_receivable`) fica fora da ficha, como diz o PRD (§6).
- **CL4 · Excluir cliente.** O PRD manda propor inativação quando há fatos vinculados. Trocar Excluir por Inativar? Recomendação: sim, após CL1 (campo de situação).
- **CL5 · Quem enxerga crédito.** `billing.view_credit_analysis` hoje. Vendedor/promotor no escopo atribuído precisam de escopo por carteira? Recomendação: manter a permissão atual até existir vínculo vendedor/promotor (CL1).
- **CL6 · Prospecção, tarefas/roteiros, visitas, mídia, importar/exportar.** Dependem de Tarefas/Missões e mídia oficial; não implementados. Recomendação: ondas próprias depois de CL1.
- **D12 · Verificação na trilha reconstruída (PGlite, 2026-10-16).** A migration add_suppliers_table_and_product_link existe na trilha; suppliers tem company_id NOT NULL (default private.default_company_id()). RLS efetiva: SELECT/INSERT/UPDATE/DELETE para qualquer membro ATIVO da empresa (private.is_active_company_member) mais a política restritiva suppliers_no_restricted_operator. NÃO exige despesas.read/despesas.manage: membro sem permissão de despesas lê e grava fornecedores direto pela API, enquanto categorias e possíveis fornecedores (migration nova) exigem despesas.*. anon tem GRANT de tabela, mas sem política (RLS nega). Pergunta: alinhar suppliers às permissões de despesas? Recomendação: sim, em migration própria após a V1; não alterado agora. Falta confirmar o mesmo em produção (somente leitura).

## Concorrência real do crédito (2026-10-16)
NÃO PROVADA: o MCP do p4 executa chamadas em sequência (provado com advisory lock), e o PGlite é monoconexão. Pergunta: você fornece a URL de conexão direta da homologação numa variável `HOMOLOG_DB_URL` fora do repositório, para um script Node com duas conexões `pg` rodar `scripts/homologacao/credito_concorrencia.sql`? Alternativa: autorizar instalar `dblink` só na homologação (ainda exigiria credencial). Recomendação: primeira opção. Até lá, o lock por cliente (`pg_advisory_xact_lock`) está só provado por leitura de código e PGlite.
## Levantamento de etapas e Financeiro (2026-10-16)
Detalhe em `docs/levantamento/ETAPAS_LACUNAS.md`. Nenhum item foi decidido pelo agente.

- **DP-FIN-1 · DRE por competência.** O pacote (Despesas V3 §11, DRE §3) trata a despesa por competência com valor econômico integral; `get_dre_monthly` usa `due_date` e só status `PAGO` (folha só quando quitada). Pergunta: o DRE passa a usar `expenses.competence` e valor integral (folha por competência mesmo em aberto)? Recomendação: sim, em migration própria com teste comparando antes/depois nos dados sintéticos da homologação.
- **DP-FIN-1b · Dedução de desconto.** A receita bruta soma `orders.total_amount` e subtrai `discount_amount`. Pergunta: `total_amount` já é líquido do desconto? Recomendação: conferir o schema de pedidos; se for líquido, corrigir a dupla subtração.
- **DP-FIN-2 · Dois jobs de fechamento ativos em produção** (`oris360-monthly-close-sweep` a cada 30 min e `monthly-close-rollover` às 03:00). Pergunta: qual vale? Recomendação: manter um só, após comparar o formato do snapshot e o fuso de cada um; não desagendar sem ordem.
- **DP-FIN-3 · CMV/CPV e encargos financeiros no DRE (hoje 0).** Pergunta: qual método de custo (médio, última compra, ficha técnica) e qual fonte de tarifas? Recomendação: custo médio da ficha técnica com snapshot por venda, produto sem custo sinalizado (como a spec exige).
- **DP-FIN-4 · Modelo da trilha de auditoria.** `audit_events` não tem módulo, nível, before/after, motivo nem hash (só `payload`). Pergunta: ampliar colunas ou padronizar `payload{before,after,motivo}` com visão derivada? Recomendação: padronizar o `payload` e criar view/RPC de leitura; hash e casos em onda posterior.
- **DP-FIN-5 · Setor/centro de custo, rateio, anexos e beneficiário mestre em Despesas.** Faltam catálogo de setores, regra de rateio, bucket/retenção de anexos e vínculo com fornecedor. Recomendação: decidir junto com Fornecedores D3/D8/D10; até lá não implementar.
- **DP-FIN-6 · Motor de caixa (Saldo Disponível, Projeção D+10/20/30).** Pergunta: haverá contas financeiras/ledger próprio agora ou só depois da Integração Asaas? Recomendação: contas financeiras manuais com ledger imutável, sem conciliação automática, em onda própria.
- **DP-FIN-7 · Recorrência de despesas e receitas.** `expense_recurrences` existe mas nada materializa fatos futuros. Pergunta: janela de materialização, quem encerra e como previsto x realizado aparece. Recomendação: materializar só o mês corrente + próximo por job idempotente.
- **DP-E5-1 · Download de NF-e e boletos na tela de Entrega.** Pergunta: onde ficam os PDFs de NF-e e boleto (Asaas, storage) e quem pode baixá-los? Recomendação: só exibir quando houver arquivo armazenado, após definir o bucket por empresa.
- **DP-TAR-1 · Missões, Roteiros e Mapa Semanal.** Modelo grande, exige bucket de fotos, cadastro de qualificações e catálogo central de cargos. Recomendação: fatiar em ondas (tarefa simples completa; biblioteca de missões; roteiros/recorrência; mapa semanal).
- **DP-PROD-1 · Participação por pessoa na produção.** O patch da Central de Gestão diz que vem do Produziu Registra; a V4 R3 do cliente proíbe rateio ali e o `ETAPA_4` propõe `floor_participations` no Chão. Pergunta: a fonte oficial é o Chão de Fábrica? Recomendação: sim (V4 R3 é posterior), com unidade e conversão definidas antes de qualquer comparação.

## Central de Auditoria, leitura (2026-10-16)
- **DP-AUD-1 · O que a tela de Auditoria mostra como "indisponível".** Implementados só Visão Geral, Logs e Detalhe sobre `audit_events` (migration pendente `20261016121000_central_auditoria_leitura.sql`, não aplicada). Indisponíveis por falta de coluna: módulo, nível/severidade, antes/depois estruturados, motivo, hash, eventos críticos, exceções/alertas, módulos monitorados, nome do ator (só o ID curto). Pergunta: seguir DP-FIN-4 (padronizar `payload{before,after,motivo}`) e adicionar catálogo de módulos/severidade por tipo de evento? Recomendação: sim, em migration própria; a tela passa a preencher sem mudar a rota.
- **DP-AUD-2 · Permissão do menu.** O item "Auditoria" aparece para todo usuário do painel; sem `audit.read` a página mostra o erro de acesso (o servidor nega). Pergunta: esconder o item por permissão? Recomendação: sim, quando o painel tiver um hook de permissões no cliente (hoje não existe).
- **DP-AUD-3 · Exportar e abas Usuários/Casos/Políticas.** Exportar deve gerar evento de auditoria (escrita), então não foi feito nesta etapa somente leitura. Recomendação: RPC de exportação própria que grava o evento e herda o filtro.
## Financeiro RPCs atômicas (2026-10-16)
Migration preparada em `supabase/pendentes/20261016120000_financeiro_rpcs_atomicas.sql` (não aplicada; front não trocado).

- **DP-FIN-8 · Tabela nova `financial_commands`.** Idempotência por command_id exigiu tabela própria (audit_events não tem índice único em `idempotency_key` e não pode ser alterada). Recomendação: aprovar.
- **DP-FIN-9 · Regras de integridade acrescentadas.** Pagamento acima do saldo, pagamento em despesa não ABERTO/AGENDADO/ATRASADO e recebimento acima do saldo passam a ser recusados (o cliente hoje aceita). Recomendação: manter.
- **DP-FIN-10 · Representação do estorno de recebimento.** `revenue_receipts.received_amount` tem check > 0, então o insert negativo do cliente (`receitas-store.ts` reverseReceipt) falha hoje. A RPC grava a linha de estorno com valor positivo + `reversed_receipt_id`. Pergunta: confirmar a convenção (igual a aportes) antes de qualquer relatório somar recibos. Recomendação: sim.
- **DP-FIN-11 · `expenses.status` sem BLOQUEADO/CANCELADO.** Em produção o check só tem ABERTO/AGENDADO/PAGO/ATRASADO, mas `block_expense(hold)` grava 'BLOQUEADO' (falharia). Fora do escopo; recomendação: migration própria ampliando o check.
- **DP-FIN-12 · Estorno de despesa paga** não existe hoje e não foi criado (sem regra especificada de devolução de saldo).

## Clientes V1 (2026-10-16)
CL1 a CL5 foram RESOLVIDAS pelo dono a favor do pacote e implementadas na migration pendente `supabase/pendentes/20261016140000_clientes_v1_mestre.sql` (nao aplicada). CL6 ficou parcial (ver `docs/clientes/CONFORMIDADE_PACOTE.md`). Novas perguntas, nenhuma decidida pelo agente:

- **CL7 · Permissao para inativar/reativar cliente e editar cadastro.** Hoje qualquer membro ativo (nao operador restrito) edita cliente; o comando de inativacao exige so isso mais motivo (min. 5 caracteres) e auditoria. Pergunta: criar permissao propria (`customers.manage`)? Recomendacao: sim, em migration propria depois da homologacao.
- **CL8 · Quem propoe condicoes comerciais.** Reusei `customer_credit.change_permanent_limit` (mesma de Gerir limite) para gravar limite proposto, prazo, forma e observacao de credito; o servidor recusa quem nao tem. Pergunta: criar `customer_credit.propose_limit` separada (vendedor propoe, gestor aprova)? Recomendacao: sim.
- **CL9 · Fonte e momento da compra faturada.** Assumi: pedido nao cancelado com `billings.status='CONFIRMADO'`, reconhecido em `billings.confirmed_at`, valor `orders.total_amount`. Devolucoes nao entram (nao ha fonte definida). Ranking = dense_rank por valor no periodo entre clientes ATIVOS da empresa. Pergunta: confirmar com Pedidos/Financeiro e dizer onde ficam as devolucoes. Recomendacao: confirmar antes de homologar os numeros.
- **CL10 · Faixas da carteira (30/90 dias).** Fixas no servidor (constantes). A aba Configuracoes do pacote nao foi feita: alterar politica global exige autoria, revisao, escopo e autorizacao nao definidos. Recomendacao: tabela de politica versionada por empresa, em onda propria.
- **CL11 · Prospeccao, tarefas/roteiros/visitas, importacao.** Nao iniciadas. Prospeccao precisa do agregado proprio + conversao atomica (PRD §5/RFC §5) e depende de decisao sobre origem (missao do vendedor/Meu 360); visitas e roteiros dependem do motor de Tarefas/Missoes, inexistente no repositorio; importacao precisa de formato real e prévia por linha. Recomendacao: ondas proprias, comecando por Prospeccao.
- **CL12 · Cliente legado sem documento/numero/IBGE.** O formulario exige documento, numero e municipio do catalogo ao salvar (o servidor so exige na criacao). Legado fica salvavel apos completar; municipio com nome exato e unico na UF e resolvido sozinho. Pergunta: aceitar salvar legado parcialmente (rascunho)? Recomendacao: manter a exigencia na tela.
- **CL13 · Fotos de interior.** Todas as fotos seguem a mesma permissao de membro nao restrito; a separacao por perfil (interior so para autorizados, Entrega so fachada) nao foi feita. Pergunta: qual permissao libera fotos internas? Recomendacao: permissao propria quando Entrega consumir a fachada.
