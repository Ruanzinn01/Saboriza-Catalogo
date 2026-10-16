# Fornecedores V1 — levantamento de lacunas (etapa 6)

Data: 2026-10-16 · Branch: `worktree-agent-a96d0c8408cf27876` · Nada foi aplicado em banco algum, nada foi enviado ao remoto.

## (a) O que o pacote especifica
Pacote lido: `Downloads\ORIS360_Fornecedores_V1_Mestre_Completo\` (LEIA_PRIMEIRO, PRD, RFC, campos/ações, regras de cálculo, matriz de integrações, mapa de substituição, prompt, checklist H01-H20, mapeamento CSV). Os HTMLs de referência não foram abertos nesta etapa; a implementação seguiu os documentos escritos.

- Lista com abas Fornecedores / Possíveis fornecedores / Configurações; busca, filtros (categoria, cidade, comprador, situação), paginação 10/20/30/50, estados distintos, filtros preservados ao voltar; KPIs comprado/pago/aberto com base explícita.
- Categorias do fornecedor opcionais e múltiplas, por ID, 8 iniciais, criação dentro do formulário sem perder rascunho, gerenciar (criar/renomear/inativar), normalização, inativar preserva vínculos, não reclassifica despesa.
- Mapa configurável categoria financeira → categorias de fornecedor (por IDs) para a busca em Compras/Despesas.
- Ficha completa (cadastro expandido, compras, pagamentos, pontualidade, títulos, itens/preços, adiantamentos).
- Formulário completo (PF/PJ, contatos, endereço/IBGE, lat/lon, mídia, comprador, condições, operação, banco/Pix, documentos); revisão concorrente e auditoria.
- Possíveis fornecedores (separados dos formais, produtos declarados pesquisáveis, histórico de contatos com primeira data fixa, situações, cotações/arquivos) e promoção idempotente com vínculo a existente.
- Permissões distintas, CSV seguro, eventos mínimos, rascunho persistente.

## (b) O que já existe no código
- Rotas (coincidem com as sugeridas pelo pacote): `/admin/fornecedores`, `/novo`, `/:supplierId`, `/:supplierId/editar` (`src/App.tsx`).
- `SuppliersPage` (busca simples em memória, sem paginação), `SupplierDetailPage` (dados + produtos vinculados + excluir), `SupplierFormPage`/`SupplierFormFields` (12 campos de texto), `suppliers-store` (CRUD direto na tabela `suppliers`, duplicidade local por CNPJ ou telefone), `supplier-mapper`, `supplier-display`.
- Tabela `public.suppliers` (colunas em `src/types/supabase.ts`): name, company_name, phone, trade_name, cnpj, ie, email, address, neighborhood, cep, city, state, company_id. A migration `add_suppliers_table_and_product_link` NÃO está em `supabase/migrations/` deste branch (a trilha reconstruída está em outros branches/commit 63aafb0); a estrutura foi confirmada só pelos tipos gerados e por FKs de `20261014090000_estoque_onda2_compras.sql` (`item_supplier_codes`, `supplier_credits`, `expense_launches.supplier_id`). RLS/policies de `suppliers` não puderam ser lidas aqui (não verificado).
- Fora do módulo: `item_supplier_codes` (código do fornecedor por item), `supplier_credits`, seleção de fornecedor em `NovaDespesaPage`.

## (c) Lacunas e estado final
| ID | Lacuna | Estado |
|---|---|---|
| G01 | Lista: abas, busca (nome/razão/documento/contato/cidade/categoria), filtro categoria e cidade, paginação 10/20/30/50, estado na URL (voltar mantém), mobile-first | RESOLVIDA (ordenação só por nome) |
| G02 | KPIs comprado/pago/aberto/vencido, colunas de valor, concentração, ordenação por compras/saldo, filtros financeiros. UI mostra "indisponível", sem zero falso | BLOQUEADA POR DECISÃO (D10) |
| G03 | Categorias opcionais/múltiplas por ID, 8 iniciais (botão explícito), criar no formulário, renomear/inativar, normalização, delta sem apagar seleção concorrente | PREPARADA (código + migration; não aplicada, não testada em banco) |
| G04 | Mapa categoria financeira → fornecedor em Compras/Despesas | BLOQUEADA POR DECISÃO (D3) |
| G05 | Possíveis fornecedores: registro, produtos declarados pesquisáveis, histórico, primeira data fixa, situações, busca no servidor paginada | PREPARADA |
| G06 | Cotações, arquivos e catálogo da avaliação | BLOQUEADA POR DECISÃO (D8) |
| G07 | Promoção idempotente (único por avaliação, advisory lock por documento, vínculo a existente, sem compra/dívida) | PREPARADA |
| G08 | Ficha: categorias exibidas | RESOLVIDA |
| G09 | Ficha completa (recência, gráfico, compras, pagamentos, pontualidade, títulos, itens, adiantamentos) | BLOQUEADA POR DECISÃO (D10) |
| G10 | Formulário: validação de formato CPF/CNPJ (inclui alfanumérico; só ao alterar) | RESOLVIDA |
| G11 | Formulário completo (PF/PJ, contatos múltiplos, IBGE, lat/lon, mídia, comprador, condições, operação) | NÃO INICIADA (exige colunas novas em `suppliers`, D11) |
| G12 | Banco/Pix do favorecido e verificação | BLOQUEADA POR DECISÃO (D9) |
| G13 | Ativo/inativo, revisão concorrente e auditoria em `suppliers` | BLOQUEADA POR DECISÃO (D5, D11) |
| G14 | Permissões distintas (cadastro, categorias, comercial, banco, anexos, export) | BLOQUEADA POR DECISÃO (D1); provisório: `despesas.read/manage` |
| G15 | Exportação CSV com proteção contra fórmula | NÃO INICIADA |
| G16 | Eventos/outbox (`supplier.*`) | NÃO INICIADA (sem consumidor comprovado, como pede a matriz) |
| G17 | Rascunho persistente e proteção contra navegação acidental no formulário | NÃO INICIADA |
| G18 | Teste SQL da migration em banco (PGlite/homologação) e checklist H01-H20 | NÃO INICIADA (sem harness no worktree; homologação é de outro agente) |

Mapeamento lógico→físico (parcial, do CSV do pacote): SupplierParty = `public.suppliers`; SupplierCategory/Links, Candidate, CandidateProductInterests, CandidateHistory, CandidateConversion = tabelas novas da migration pendente; ExpenseCategorySupplierMap, Purchase/Payables/Settlements/Credits, Items, Bank, ProtectedDocuments = não mapeados (decisões D3, D9, D10).

## (d) Divergências pacote × código (viram decisões, nada foi suposto)
1. Código permite excluir fornecedor (bloqueia só com produtos vinculados); pacote prevê ativo/inativo, sem exclusão. -> D5.
2. Código exige nome do contato, razão e telefone (NOT NULL na tabela); pacote exige só fantasia/razão. -> D2.
3. Duplicidade no código: CNPJ ou telefone; pacote: documento normalizado (letras/zeros preservados). Código novo: servidor compara documento normalizado; telefone permanece só como aviso local. -> D2.
4. Código valida CNPJ numérico (`src/lib/cnpj.ts`, não usado no formulário de fornecedor); pacote quer CNPJ alfanumérico com regra oficial. Implementado só conferência de formato. -> D6.
5. "Produtos" na lista = produtos vinculados ao fornecedor; pacote = itens comprados com ranking. -> D10.
6. Migration `add_suppliers_table_and_product_link` ausente do branch; RLS de `suppliers` não verificada. -> D12.
7. Permissão: pacote exige chaves distintas; banco só tem `despesas.*` para esse domínio. -> D1.

## Segurança da migration pendente
`supabase/pendentes/20261016100000_fornecedores_v1_categorias_possiveis.sql` (+ `_REVERSAO.sql`): aditiva, não altera `suppliers`; RLS de leitura por `despesas.read`; nenhuma policy de escrita (só RPC SECURITY DEFINER, `search_path` vazio, empresa vinda de `private.default_company_id()`, nunca do navegador); `REVOKE` de public/anon e `GRANT EXECUTE` só para `authenticated` em 11 RPCs; FKs compostas `(company_id, id)` impedem vínculo entre empresas; vínculo fornecedor-categoria tem trigger de mesma empresa. Não foi executada em nenhum Postgres (sem PGlite neste ambiente): sintaxe e comportamento sem prova; primeiro passo em homologação é rodar a migration e os cenários H03-H06, H11-H16.
