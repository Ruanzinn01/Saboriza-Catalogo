# Conformidade com o pacote Clientes V1 (2026-10-16)

Referência: `ORIS360_Clientes_V1_Mestre_Completo` (PRD, RFC, CAMPOS_E_ACOES, REGRAS_CALCULO e os 3 HTMLs lidos no markup/CSS/JS).

Legenda: **RESOLVIDA** = feito no código com teste, sem depender de schema novo; **PREPARADA** = código + migration prontos e testados em PGlite, mas a migration `supabase/pendentes/20261016140000_clientes_v1_mestre.sql` NÃO foi aplicada em banco algum e a tela NÃO foi exercitada contra backend real nem em navegador; **BLOQUEADA POR DECISÃO** = depende de resposta em `docs/homologacao/DECISOES_PENDENTES.md`; **NÃO INICIADA** = depende de integração/regra ausente (tela mostra "indisponível", nunca valor falso).

Evidência: `npm test` 22 arquivos / 180 testes; `npx tsc --noEmit` limpo; `npm run build` ok; `testes_clientes_v1_mestre.mjs` 100 verificações (PGlite, não é homologação). Sem `.env.local` no worktree.

## Lista (PRD §2)
| Requisito | Estado | Onde |
|---|---|---|
| Linha: fantasia em verde/negrito + razão — CPF/CNPJ — número, cidade/UF sem bairro, ícones mapa/fotos com rótulo e estado vazio, Alterar, Ver cliente | PREPARADA | `src/components/admin/CustomerListParts.tsx` |
| Busca sem acento por fantasia, razão, contato e documento (CNPJ alfanumérico mantém letras) | PREPARADA | RPC `oris360_customers_list` (migration §6), `src/lib/customers-api.ts` |
| Filtros cidade, UF, bairro, vendedor, promotor, financeiro, situação cadastral, combinados por AND | PREPARADA | `src/pages/admin/CustomersPage.tsx`, migration §6 |
| Filtro e ordenação por última visita; "visita" na linha | NÃO INICIADA (aparece "Indisponível") | depende do motor de Tarefas/Missões |
| Ordenação nome / compra / dívida; 10-20-30-50 por página (opção 5 removida); página recalculada ao filtrar | PREPARADA | `src/lib/customers-list.ts` (+ teste), RPC |
| Situação financeira na lista sem N chamadas (CL2), com "Restrito ao seu perfil" sem permissão | PREPARADA | RPC agregada, `billing.view_receivables` |
| Voltar da ficha conserva filtros, ordenação, página e rolagem | PREPARADA (URL + sessionStorage; não testado em navegador) | `CustomersPage.tsx` |
| Estados de carregando / erro com "tentar de novo" / vazio com "limpar filtros" distintos | PREPARADA | `CustomersPage.tsx` |
| Carteira: segmentos 30 / 31-90 / >90 / sem primeira compra, clique filtra, denominador antes do próprio segmento, ajuda por clique, prospectos fora | PREPARADA | `CustomerListParts.tsx`, RPC `summary` |
| Faixas configuráveis (aba Configurações) | BLOQUEADA POR DECISÃO (CL10) | faixas fixas 30/90 no servidor |
| Central de atenção: inadimplência e aguardando 1ª compra; ausência de atendimento | PREPARADA / NÃO INICIADA (visita) | `CustomersPage.tsx` |
| Exportar o filtrado (todas as páginas, só colunas autorizadas, neutraliza fórmulas) | PREPARADA | `buildCustomersCsv` em `customers-list.ts` |
| Importar com prévia, validação por linha, duplicidade | NÃO INICIADA (CL11) | — |
| Aba Prospecção | NÃO INICIADA (CL11) | — |

## Ficha (PRD §3)
| Requisito | Estado | Onde |
|---|---|---|
| Dados no topo (fantasia, razão, telefone/WhatsApp, e-mail, endereço, responsável, Alterar, Novo pedido) e "Ver cadastro completo" expandindo no próprio cartão | PREPARADA | `CustomerDetailParts.tsx` (`CustomerHeaderCard`) |
| Novo pedido abre o fluxo existente com o cliente escolhido, sem contornar bloqueios; inativo não recebe pedido | RESOLVIDA | `?cliente=` em `OrderEditorPage.tsx`, `CustomerPicker.tsx` |
| Atividade recente: último pedido e última compra faturada separados; "Sem registro", nunca hoje | PREPARADA | `RecentActivityCard`, RPC `oris360_customer_commercial_summary` |
| Última visita / visitas 30-60-90 / recência vendedor x promotor | NÃO INICIADA | "Indisponível" na tela |
| Visitas 12 meses (4 janelas de 3 meses) | NÃO INICIADA | idem |
| Tarefas e próximos contatos, Criar tarefa/+ Roteiro, programação | NÃO INICIADA | idem; botões ocultos para não gravar nada paralelo |
| Cumprimento dos roteiros | NÃO INICIADA | idem; sem percentual |
| Pedidos e atividades (linha do tempo, mais recente primeiro) | PREPARADA só para pedidos | `CustomerDetailPage.tsx`; visitas/contatos/tarefas indisponíveis |
| Compras: mês / 6 meses / 1 ano, meses sem compra zerados, clique na barra mostra pedidos sem sair da ficha | PREPARADA | `PurchasesCard`, `customer-detail.ts` |
| Ranking por valor líquido com critério explícito (dense_rank, empate = mesma posição), sem 34/186 fixos | PREPARADA (fonte da compra faturada em CL9) | RPC |
| Compras faturadas líquidas de cancelamentos e devoluções | BLOQUEADA POR DECISÃO (CL9): cancelamentos entram, devoluções não | RPC |
| Limite aprovado/comprometido/disponível, excesso em texto, barra limitada a 100%, Gerir limite auditado | RESOLVIDA (já existia: `oris360_credit_*`, `CustomerCreditPanel`) | migration de crédito |
| Histórico de pagamentos: pontualidade por quantidade, em dia/atraso, lista clicável com detalhe, sem 100% fictício, estorno reabre o título | PREPARADA | `PaymentHistoryCard`, RPC `oris360_customer_receivables` (CL3) |
| Títulos em aberto: vencidos/a vencer, mais antigo, parcial não é quitado, meio real (não rotula tudo como boleto) | PREPARADA | `OpenTitlesCard`, RPC |
| A ficha NÃO paga título (§6): nenhum botão de baixa; `billing.settle_receivable` fica no Financeiro | RESOLVIDA (teste confere ausência) | `CustomerDetailParts.test.ts` |
| Produtos mais comprados: todos, paginação "ver mais" com ranking global, valor líquido, unidade original, placeholder identificado | PREPARADA | `ProductsCard`, RPC |
| Fotos na ficha: galeria com ampliação, fachada principal marcada, URLs assinadas curtas | PREPARADA | `PhotosCard`, bucket `customer-media` |
| Excluir substituído por Inativar/Reativar com motivo, revisão e auditoria; exclusão com histórico recusada no servidor (CL4) | PREPARADA | `CustomerDetailPage.tsx`, RPC `oris360_customer_set_status`, gatilho |

## Cadastro e edição (PRD §4)
| Requisito | Estado | Onde |
|---|---|---|
| Formulário único criar/editar, blocos com ícones, prévia lateral, Salvar/Cancelar persistentes, proteção de saída | PREPARADA | `src/pages/admin/CustomerFormPage.tsx` |
| PF/PJ, fantasia x razão/nome completo, CPF/CNPJ (letras e zeros preservados), IE/isento, enquadramento | PREPARADA | `customer-form.ts` (+ teste), RPC `oris360_customer_save` |
| Contatos principal e adicionais; função; WhatsApp | PREPARADA | tabela `customer_contacts` |
| CEP (ViaCEP, confirmação ao substituir endereço, CEP geral sem inventar rua), UF -> município do catálogo IBGE, código de 7 dígitos, nome diferente limpa o código, respostas antigas descartadas | PREPARADA | `CustomerFormPage.tsx`, `src/lib/cep.ts`, `ibge_cities`; servidor valida UF x código |
| Latitude/longitude juntas, faixas, 0 válido, vírgula, origem/precisão, "usar minha posição" com confirmação, mapa externo, confirmação do ponto invalidada ao mudar endereço/ponto (cliente e servidor) | PREPARADA | `customer-form.ts`, gatilho `customers_guard` |
| Fotos: várias, categoria, legenda, fachada principal única, ampliar, remover; tipo/tamanho conferidos também no bucket e na tabela | PREPARADA | `CustomerPhotosField.tsx`, `customer_media` |
| Vendedor/promotor por ID estável da mesma empresa | PREPARADA | colunas `seller_employee_id`/`promoter_employee_id` + gatilho |
| Limite proposto, prazo, forma, situação da análise, observação; não altera o aprovado; só quem tem permissão grava | PREPARADA (permissão em CL8) | gatilho + RPC; teste PGlite prova que salvar não muda `customer_credit` |
| Revisão esperada (conflito, sem last-write-wins) e idempotência por `command_id` (retry = mesmo resultado; mesmo id com corpo diferente = conflito) | PREPARADA | `customer_commands`, teste PGlite |
| Qualidade do cadastro = só preenchimento | PREPARADA | `qualityChecklist` |
| Número de exibição por empresa separado do UUID (CLI-0034) | PREPARADA | coluna `display_number` |
| Cadastrar a partir de prospecção/conversão | NÃO INICIADA (CL11) | — |

## O que não foi provado
- Nada foi aplicado nem executado contra Supabase real (produção e homologação intocadas). PGlite é monoconexão: concorrência entre duas sessões segue sem prova real.
- Telas não foram abertas em navegador nem testadas em aparelho (toque, rolagem restaurada, geolocalização, upload real, ViaCEP).
- Os tipos gerados não foram regenerados: leituras/escritas novas usam `rpcUntyped`/`fromUntyped` com tipos em `src/lib/customers-api.ts`.
- Importação, abas Prospecção e Configurações e tudo que depende de Tarefas/Missões ficam registrados em CL10 e CL11.
