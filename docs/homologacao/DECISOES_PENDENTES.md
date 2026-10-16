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
