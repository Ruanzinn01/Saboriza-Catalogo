# Resultado do teste por API real (homologação)

Data: 2026-10-16. Ambiente `dfynvpieyvvameftrent`. Script: `scripts/homologacao/http/api_real.mjs` (Node, fetch nativo; URL e chave publishable via env, senha lida de arquivo fora do repo). Camadas reais: GoTrue (login por senha), PostgREST e RPC. Navegador: **BLOQUEADO** (sem navegador nesta sessão), nada aqui substitui o teste de tela.

Total: 114 casos, 98 PASSOU, 9 FALHOU, 7 BLOQUEADO (execução final; a lista completa sai no stdout do script).

## PASSOU (resumo)
- Login real: gestor, vendedor, separador, entregador, producao, outra-empresa.
- Leitura de orders, order_items, customers, products, stock_movements, inventory_sessions, raw_materials: empresa A nunca vê linha da B; B nunca vê linha da A (7 tabelas x 6 perfis).
- Acesso cruzado A para B (ler por id, UPDATE pedido, DELETE item, INSERT cliente) por gestor, vendedor, separador, entregador, producao: todos barrados. B para A: barrado.
- INSERT em products e customers por separador/entregador/producao: barrado. DELETE de pedido por eles: barrado.
- RPC: reserve_delivery_er e finalize_delivery barrados para perfis indevidos e para pedido da B; create_production barrado (403/409) para entregador, separador, outra e para produto da B; separation_set_item/accept_order em item/pedido da B não alteram nada (corpo `false`); inventory_list_sessions sem dado de outra empresa.

## FALHOU (achados reais, nenhum corrigido)
1. **Perfis restritos alteram preço de produto.** separador, entregador e producao fazem UPDATE de `products.unit_price` (200, 1 linha; valor revertido depois e conferido: 4.90). Política `products_app_scope` (ALL). Decidir se é intencional.
2. **entregador e producao fazem UPDATE em `orders`** (mesmo valor, linha afetada). Pode estar no mapa `app_table_access`; confirmar.
3. **entregador e producao executam `separation_set_item` com efeito real** (separado false para true, revertido pelo gestor). A RPC não checa papel de separação.
4. Achado 2 da matriz confirmado pela API: entregador lê 3 de 3 pedidos e 6 de 6 itens da empresa A, sem atribuição.
5. separador: `separation_accept_order` retornou `false` no pedido de teste (sem efeito; estado do pedido não elegível). Caso permitido inconclusivo, não é falha de segurança.

## BLOQUEADO
- Navegador: sem navegador.
- `create_order` (vendedor, cruzado A/B, anon, logado de B): todas as chamadas dão 409 `23505`. Causa: o pedido de fixture da empresa B (`022c045e...`) tem `order_number=''` e `create_order` insere `''` antes de numerar (índice único global `orders_order_number_key`). Corrigir exigiria UPDATE na homologação, que o classificador negou; não contornei. Consequência: segurança de create_order (produto de outra empresa, anon) segue não provada por API. Observação: `create_order` é SECURITY DEFINER e não checa membership (vitrine pública).
- Achado 1 (UNIT_LIST só Matriz lê a Filial): o login de `rot-unidade@` retorna 400 (sem senha conhecida; os `rot-*` foram criados por claims simulados). Segue valendo só a prova SQL de `MATRIZ_ISOLAMENTO_AMPLIADA.md`.

## Decisões pendentes (para `docs/homologacao/DECISOES_PENDENTES.md` na branch que o contém)
1. Pergunta: restritos podem alterar preço de produto e pedido? Recomendação: não; restringir `products_app_scope` a SELECT para esses apps e exigir papel em `separation_set_item`.
2. Pergunta: autorizo corrigir `order_number` do pedido B de fixture (UPDATE na homologação) para reexecutar create_order? Recomendação: sim, sintético.
3. Pergunta: definir senha conhecida dos `rot-*` ou aceitar só prova SQL para escopo de unidade? Recomendação: criar login real de um gestor UNIT_LIST.

## Dados criados
Nenhum pedido novo (create_order bloqueado). Alterações revertidas: preço do produto Açafrão e estado de separação do item de teste. Clientes/produtos de teste cruzados não foram criados (INSERT barrado).
