# Fornecedores V1 — conformidade com o pacote mestre (2026-10-16)

Pacote: `Downloads\ORIS360_Fornecedores_V1_Mestre_Completo\ORIS360_Fornecedores_V1_Mestre` (PRD, RFC, regras de cálculo, campos, matriz F01-F10, contrato JSON, checklist **H01-H40**, HTMLs). Desta vez os HTMLs foram abertos e lidos (lista, ficha, formulário embutido, JS de lista/ficha/avaliações/configurações/seletor de despesa).
Branch `trabalho/fornecedores-v1-mestre`. **Nada foi aplicado em banco algum, nada foi enviado ao remoto.** Estados: RESOLVIDA (código + prova automática), PREPARADA (código/migration prontos, falta aplicar/homologar), BLOQUEADA POR DECISÃO, NÃO INICIADA.

## Arquivos
- Migrations pendentes: `supabase/pendentes/20261016141000_fornecedores_v1_mestre_complemento.sql` e `..._REVERSAO.sql` (complementam, sem editar, a `20261016100000`).
- Teste SQL (PGlite, reconstruído): `supabase/pendentes/testes_fornecedores_v1_complemento.mjs` (aplica 100000 e depois 141000; isolamento A/B; GRANT só `authenticated`; reversão).
- Telas: `src/pages/admin/SuppliersPage.tsx`, `SupplierDetailPage.tsx`, `SupplierFormPage.tsx`, `src/components/admin/fornecedores/**`.
- Dados: `src/lib/supplier-{api,form,finance,csv,search,municipios}.ts`, `src/store/suppliers-store.ts`, `supplier-permissions-store.ts`.
- Testes `npm test` (cliente Supabase mockado; rodam sem `.env.local`): `src/lib/supplier-*.test.ts`, `src/store/suppliers-store.test.ts`.

## Requisito do pacote × estado
| # | Requisito do pacote | Estado | Onde / evidência |
|---|---|---|---|
| 1 | Lista: cabeçalho, KPIs (fornecedores, comprado, pago, aberto) com base explícita, abas Fornecedores / Possíveis / Configurações sem nova barra lateral | PREPARADA | `SuppliersPage.tsx`; valores vêm de `list_suppliers_financial` (precisa da migration) |
| 2 | Linha: fantasia em destaque, razão/documento ao lado, cidade/UF + "Ver mapa", categorias, contato, comprado/recência/saldo, chip Vencidos/A vencer/Sem saldo | PREPARADA | `SupplierRowItem` em `SuppliersPage.tsx`; chip em `supplier-finance.ts` (`financeChip`, testado) |
| 3 | Busca (fantasia, razão, documento, contato, categoria); filtros categoria/cidade/comprador/cadastro/financeiro; ordenação nome/compras/saldo; paginação 10/20/30/50; filtros e página na URL (voltar mantém) | RESOLVIDA | `supplier-search.ts` + `supplier-search*.test.ts`; estado em `useSearchParams` |
| 4 | Estados distintos: sem resultado, carregando, fonte indisponível, acesso restrito | RESOLVIDA | KPIs/linhas distinguem `restricted`/`loading`/`unavailable`; nunca zero falso (`supplier-finance.test.ts`) |
| 5 | Comprado/pago por período e datas próprias; aberto/vencido = posição atual; carteira não inclui possibilidades; formal sem compra continua formal ("Sem compra") | PREPARADA | RPC `list_suppliers_financial`; teste SQL seção 9 (comprado R$1.800 / pago R$700 / aberto R$1.100 / vencido R$500 / hoje R$300 / rascunho fora) |
| 6 | Concentração com denominador = total filtrado | RESOLVIDA | `concentration()` + teste |
| 7 | Exportação CSV do conjunto filtrado, autorizada, com escopo/data e proteção contra fórmula | PREPARADA | `supplier-csv.ts` (BOM, `;`, apóstrofo em `= + - @ TAB CR`); RPC `list_suppliers_export` (permissão `fornecedores.exportar`, só ids da empresa); testes TS e SQL. Importação CSV: o PRD só especifica exportação, **não implementada** |
| 8 | Categorias opcionais, múltiplas, por ID, 8 iniciais, "+ Criar categoria" no formulário sem perder rascunho, gerenciar em Configurações, inativar preserva vínculos | PREPARADA | migration 100000 (já testada) + chave própria `fornecedores.categorias` na 141000; `SupplierCategoryPicker`, `SupplierCategoriesSettings` |
| 9 | Mapa categoria financeira → categoria de fornecedor (F03) | BLOQUEADA POR DECISÃO | O pacote dá só a demonstração do mock e diz que exige IDs reais/configuração por empresa. DP-FORN-3. O seletor de Compras só lista fornecedores **ativos** (`NovaDespesaPage`); "Nova compra/despesa" na ficha envia `?fornecedor=<id>` |
| 10 | Ficha: identidade, "Ver cadastro completo" expansível, última compra/último pagamento/prazo real, gráfico mensal comprado × pago, abas Compras/Itens/Documentos/Histórico, ranking de itens com histórico de preço, classificação, filtros mês/3/6/12/completo (padrão 6) | PREPARADA | `SupplierDetailPage.tsx`; RPC `supplier_financial_summary`; teste SQL seção 9 |
| 11 | Barra lateral da ficha: resumo de compras (posição no ranking com dense_rank), pagamentos e pontualidade (só quitados; sem quitados = traço), títulos em aberto (agendado ≠ pago), condições, adiantamentos/créditos | PREPARADA | idem; pontualidade 1 em dia de 2 quitados = 50% no teste |
| 12 | Adiantamentos/créditos, estornos, juros/multa/desconto, devoluções, cancelamento de lançamento, baixa parcial separada, SKU/código do fornecedor por item | BLOQUEADA POR DECISÃO | Não há fonte física no schema. A ficha mostra "Indisponível" (nunca zero) e a RPC devolve a lista `unavailable`. DP-FORN-2 |
| 13 | Formulário completo: PF/PJ, ativo/inativo, fantasia, razão, CNPJ numérico/alfanumérico, IE/isento, enquadramento, contatos principal e adicionais, endereço com CEP/UF/município/IBGE7/número/bairro/complemento/referência, lat/lon, comprador, centro, tipo, origem, notas, condições, operação | PREPARADA | `SupplierFormPage.tsx`; colunas novas em `suppliers` (migration 141000); `create_supplier`/`update_supplier`; teste SQL seções 2-4 |
| 14 | Campos obrigatórios conforme o pacote (fantasia, razão, documento, UF, município, logradouro, número) e **não** exigir contato, telefone nem categoria | RESOLVIDA | `validateSupplierForm` + `private.supplier_validate`; legado vazio edita sem bloqueio (testado) |
| 15 | Duplicidade por documento normalizado (letras e zeros preservados), vínculo ao existente na promoção | PREPARADA | `document_key` + índice único por empresa (produção lida 2026-10-16: 0 duplicados em 18) + advisory lock; teste SQL |
| 16 | Revisão concorrente: duas abas não sobrescrevem em silêncio | PREPARADA | `expected_revision` em `update_supplier`/`set_supplier_active`; conflito mostra diálogo; teste SQL |
| 17 | Idempotência por intenção (command_id): mesmo id + mesmo corpo devolve; corpo diferente = conflito | PREPARADA | `create_supplier(p_command_id, ...)`; formulário reaproveita o id no retry do MESMO corpo; teste SQL |
| 18 | CEP via ViaCEP (só preenche o retornado), UF/município do catálogo oficial com IBGE7, mudar UF limpa município, respostas atrasadas não sobrescrevem, retry | RESOLVIDA (no código) | Município vem da tabela oficial do projeto `ibge_cities` (a mesma de Configurações), sem depender de serviço externo; ViaCEP com guarda de sequência. Sem homologação de rede real |
| 19 | Coordenadas: par, faixas, vírgula, zero válido, confirmação explícita invalidada ao mudar endereço/ponto, GPS só por ação do usuário | PREPARADA | `coordinateState`, CHECKs no banco, `update_supplier` limpa a confirmação; testes TS e SQL. GPS real exige aparelho (H30) |
| 20 | Fotos/referências (fachada principal, legenda), documentos cadastrais, arquivos de avaliação | PREPARADA | bucket privado `supplier-files` + `supplier_files`; `register_supplier_file` valida tipo/tamanho REAIS do objeto, retry idempotente, retirar não apaga; URL assinada de 60 s; testes SQL seção 7. Upload real em homologação pendente (H32) |
| 21 | Favorecido/banco/Pix: opcional, protegido por RLS e permissão, mascarado, alterar invalida a conferência, nunca em evento/lista/export | PREPARADA | tabela `supplier_bank_details` separada; `fornecedores.banco.read/manage/verify` (só OWNER recebe de partida, nunca herdado de despesas); teste SQL seção 5 |
| 22 | Possíveis fornecedores: separados, produtos pesquisáveis, primeira data fixa, situações, histórico | PREPARADA | migration 100000 (testada) + chaves próprias |
| 23 | Cotações e arquivos da avaliação | PREPARADA | `supplier_candidate_quotes`, `add_candidate_quote`, `SupplierCandidateReferences.tsx`; cotação não cria compra/título (assert SQL) |
| 24 | Promoção/vínculo idempotente, sem compra/saldo/limite, preservando origem, histórico, produtos, categorias, cotações e arquivos | PREPARADA | `convert_candidate_to_supplier` (reescrita com campos completos); teste SQL seção 8 |
| 25 | Permissões distintas: cadastro, categorias, leitura comercial, banco, anexos, financeiro, export | PREPARADA | 9 chaves `fornecedores.*` com backfill a partir de `despesas.*`; guarda `private.supplier_company_for`; teste SQL seção 0 |
| 26 | RLS de `suppliers` alinhada às permissões (antes: qualquer membro ativo lia/gravava/excluía) | PREPARADA | leitura por `fornecedores.read`/`despesas.read`/`operations.factory.*`/`estoque.movimentar`; escrita só por RPC; DELETE revogado; sem anon; teste SQL seção 1 |
| 27 | Ativo/inativo no lugar de excluir; inativo sai do seletor de Compras, histórico preservado | RESOLVIDA (código) / PREPARADA (banco) | `set_supplier_active`; ficha e lista; `NovaDespesaPage` filtra `active` |
| 28 | Eventos mínimos (`supplier.*`, `supplier_category.*`, `supplier_candidate.*`, `media.changed`) só com ids e nomes de campo | PREPARADA | `supplier_events` + gatilhos; teste SQL seção 6 (payload sem telefone/documento/banco/endereço). **Sem consumidor real**: estado "registrado, integração pendente". Sem outbox/worker (fora do escopo do pacote) |
| 29 | Rascunho persistente online e proteção contra navegação acidental | PREPARADA | `supplier_drafts` (por pessoa, com versão, banco/Pix descartado no servidor) + autosave no formulário + `beforeunload` + confirmação ao sair; teste SQL seção 10b |
| 30 | Mobile-first, alvos de toque de 44 px, sem overflow, rodapé fixo Salvar/Cancelar | PREPARADA | `min-h-11` em controles; grade `flex-col` → `xl:grid`; **não verificado em aparelho** (H38) |
| 31 | Tudo dentro do painel admin; rotas `/admin/fornecedores`, `/novo`, `/:id`, `/:id/editar` preservadas | RESOLVIDA | `src/App.tsx` inalterado |
| 32 | Código FOR-0001 | NÃO INICIADA | O pacote diz para não converter o código de exemplo em ID oficial; numeração por empresa precisa de regra. DP-FORN-4 |
| 33 | Compras/Despesas, Contas a Pagar e DRE não são alterados; ficha não paga nem lança | RESOLVIDA | só leitura (RPCs `stable`); nenhuma escrita em `expenses`/`expense_launches` (assert SQL) |
| 34 | F05/F06 reais (títulos, baixas) | PREPARADA | consumidor = `expenses`/`expense_launches`/`expense_launch_items`; mapeamento lógico→físico abaixo |

## Mapeamento lógico → físico (contrato `MAPEAMENTO_REAL_A_PREENCHER.csv`)
| Contrato lógico | Físico |
|---|---|
| SupplierParty | `public.suppliers` (+ colunas novas) |
| SupplierCategory / Links | `supplier_categories`, `supplier_category_links` (100000) |
| ExpenseCategorySupplierMap | **sem físico** (DP-FORN-3) |
| Candidate / ProductInterests / History / Conversion | `supplier_candidates`, `_products`, `_categories`, `_contacts` (100000) |
| CandidateHistoryFilesQuotes | `supplier_candidate_contacts` (kind COTACAO), `supplier_candidate_quotes`, `supplier_files` (candidate_id) |
| ContactsAddressLocation | `suppliers` (contato principal, endereço, lat/lon) + `supplier_contacts` |
| BankBeneficiaryVerification | `supplier_bank_details` |
| PurchaseExpenseLaunch | `expense_launches` (status ABERTO = confirmada; RASCUNHO fora das somas) |
| ItemsSupplierCodesUnits | `expense_launch_items` (agrupado por insumo/catálogo/nome+unidade); `item_supplier_codes` **não ligado** |
| PayablesInstallments / SettlementsReversals | `expenses` (uma linha por parcela: status, `due_date`, `paid_at`, `paid_amount`, `scheduled_payment_at`); estorno/juros sem fonte |
| CreditsAdvances | **sem físico** |
| ProtectedDocuments | `supplier_files` + bucket `supplier-files` |

## Regras de cálculo adotadas (e onde divergem do mock)
- Comprado = `total_amount` (itens + frete − desconto) de lançamentos `ABERTO`, pela **data de emissão do documento (competência quando não há emissão)**. O pacote manda "documentar" a data-base: DP-FORN-1.
- Pago = `paid_amount` (ou valor da parcela) de parcelas `PAGO`, pela data da baixa no fuso da empresa. Sem separação de principal/encargos.
- Aberto = saldo das parcelas não pagas, todos os períodos; vencido = `due_date` < hoje; vence hoje separado; agendado continua aberto.
- Prazo contratado = média ponderada por valor (emissão → vencimento); prazo efetivo = média ponderada por valor (emissão → baixa). Pontualidade = quitadas em dia ÷ quitadas no período; sem quitadas = traço.
- Ranking de fornecedores = `dense_rank` por valor comprado no período, mesma empresa. Ranking de itens = valor do item **antes** do rateio de desconto/frete (não existe motor oficial de rateio no schema; o pacote manda usar o oficial).

## Roteiro de homologação (checklist do pacote; NÃO executado)
O pacote tem 40 cenários (H01-H40). Estado: "auto" = coberto por teste PGlite/vitest (não substitui homologação); "manual" = precisa de backend autenticado e/ou aparelho; "fora" = depende de módulo/ integração que este trabalho não altera. **Nenhum foi executado em ambiente real.**
| ID | Cenário | Cobertura hoje | Passos de homologação (esperado) |
|---|---|---|---|
| H01 | Lista→ficha→editar→salvar→voltar | manual | abrir lista com filtros e página 2; ficha; Alterar; salvar; voltar: mesmo ID, filtros/página preservados (URL) |
| H02 | PF/PJ/CNPJ alfanumérico e legado | auto (SQL+TS) | cadastrar `12.ABC.345/01DE-35`, `00.000.000/0001-91`, CPF; editar legado sem documento |
| H03 | Salvar sem categoria (formal e avaliação) | auto | salvar sem categoria; aparece na busca sem filtro |
| H04 | Criar categoria no formulário | manual | digitar rascunho, "+ Criar categoria", conferir rascunho e seleções mantidos |
| H05 | Categoria duplicada acento/caixa/corrida | auto (100000) | duas abas criando "Embalagens"/"EMBALAGENS " |
| H06 | Inativar categoria com vínculos | auto (100000) | vínculos preservados, novas associações negadas |
| H07 | Categoria financeira Aluguéis destaca locadores | fora (DP-FORN-3) | depende do mapa |
| H08 | Fornecedor fora da correspondência | fora (DP-FORN-3) | — |
| H09 | Busca/filtros combinados e totais | manual | conferir totais do conjunto e tenant |
| H10 | Paginação 10/20/30/50 e exportação | auto (TS+SQL) / manual | sem opção 5; CSV só com `fornecedores.exportar`; abrir no Excel |
| H11 | Formal sem compra e candidato sem contrato | manual | formal mostra "Sem compra"; candidato fora dos totais |
| H12 | Possibilidade com palmito/farinha/granola | auto (100000) | busca por produto; sem SKU |
| H13 | Contato após 60 dias | auto (100000) | primeira data intacta |
| H14 | Catálogo/cotação/arquivos na avaliação | auto (SQL) / manual upload | anexar PDF real, cotar; sem obrigação financeira |
| H15 | Promoção/vínculo + retry simultâneo | auto (SQL) | dois cliques simultâneos: uma parte formal |
| H16 | Promoção sem compra | auto (SQL) | sem saldo/limite/título |
| H17 | Compra confirmada vs rascunho/cancelada/devolvida | auto parcial | rascunho coberto; cancelada/devolvida sem fonte (DP-FORN-2) |
| H18 | Nota com várias parcelas e recebimentos parciais | manual | um lançamento; financeiro sem duplicação |
| H19 | Pago por data da baixa vs comprado | auto (SQL) | períodos distintos; aberto inclui passado |
| H20 | Agendamento, falha, parcial e confirmação externa | manual/fora | agendado ≠ pago |
| H21 | Juros/multa/estorno/renegociação | fora (DP-FORN-2) | sem fonte |
| H22 | Pontualidade e prazos | auto (SQL) | denominador só quitados; nulo sem base |
| H23 | Ranking >6 itens, empates, denominador | auto parcial | "ver todos"; dense_rank |
| H24 | Caixa/unidade/kg/mês/viagem e preços | auto parcial | itens agrupados por unidade; conversão não implementada (não compara unidades) |
| H25 | Rateio desconto/frete | fora (DP-FORN-9) | sem motor oficial |
| H26 | Estoque/investimento/aluguel no DRE | manual | ficha mostra natureza (`by_kind`); DRE não alterado |
| H27 | Mudança de nome/categoria após confirmação | manual | compras guardam `party_name`/snapshot; categoria cadastral não reclassifica |
| H28 | CEP inválido/inexistente/geral | manual | mensagens claras, rua não inventada |
| H29 | Respostas atrasadas/APIs indisponíveis | manual | ViaCEP fora do ar: dados mantidos, retry |
| H30 | Coordenadas e GPS real | auto (SQL+TS) / manual aparelho | par, faixas, vírgula, zero; GPS em celular |
| H31 | Mudança de endereço/ponto | auto (SQL) | confirmação invalidada |
| H32 | Upload inválido/grande/interrompido/repetido | auto (SQL stub) / manual real | tipo real, 8/10 MB, órfão sem vínculo, retry sem duplicar |
| H33 | Banco/Pix alterado | auto (SQL) | permissão, verificação invalidada, nunca paga |
| H34 | Leitura indevida (conta/documento/export/arquivo/outra empresa) | auto (SQL) | A não lê B em nenhuma RPC/tabela/storage |
| H35 | Duas abas editam a mesma revisão | auto (SQL) | CONFLITO_REVISAO e diálogo |
| H36 | Eventos duplicados/fora de ordem | parcial | eventos gravados com revisão; consumidor inexistente |
| H37 | Fechamento mensal com títulos abertos | fora | módulo de fechamento não alterado |
| H38 | Desktop/tablet/celular/teclado | manual | sem overflow, foco, modais |
| H39 | Regressão Clientes/Compras/Financeiro/DRE/Estoque | manual | produtos/insumos/estoque leem `suppliers` (SELECT por `operations.factory.*`/`estoque.movimentar`/`despesas.read`): conferir com perfis reais |
| H40 | Reconciliação/migrations/publicação | manual | ordem 100000 → 141000 → front; não reaplicar; aprovação específica |

## Limitações conhecidas
- Telas não foram abertas em navegador com backend (sem ambiente autenticado); validação por `tsc`, build e testes.
- O front novo **exige** a migration 141000 (RPCs e permissões). Publicar o front antes da migration deixa cadastro/edição sem funcionar. Ordem proposta em DP-FORN-8.
- A lista carrega todos os fornecedores da empresa (hoje 18) e filtra no navegador; agregados financeiros são do servidor. Paginação no servidor fica para escala maior.
