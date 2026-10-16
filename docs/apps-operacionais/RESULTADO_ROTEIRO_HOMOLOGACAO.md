# Resultado do roteiro de homologação (apps operacionais) e preparação de dados

Data: 2026-10-15/16. Ambiente: homologação `dfynvpieyvvameftrent` (única escrita). Produção só leitura, não tocada. Dados 100% sintéticos (`@homolog.test`).

## 0. Snapshot do passo 0 perdido

O roteiro previa `zz_homolog.policy_snapshot` ANTES de aplicar a migration de apps isolados. A homologação já chegou com a migration aplicada (186 migrations) e o snapshot não existe. Consequência: o PASSO 4 (diff de políticas antes/depois) NÃO pode ser feito e fica NÃO INICIADO. A cobertura de regressão passa a ser o comportamento medido (T1 a T5 abaixo e a matriz ampliada), não o diff de políticas. Para um novo diff, tirar o snapshot agora, antes da próxima migration (fase B do Separa, salário/Pix, storage).

## A. Migrations do Separa Confere (origin/homolog/separa-confere-v3)

Lidas por `git show` (não copiadas para esta branch), conferidas antes (dependências e objetos existentes) e aplicadas na ordem pedida. Versões gravadas na trilha são timestamps de 2026-10-16 (a ferramenta gera a versão), com os nomes abaixo.

| Arquivo de origem | Estado antes | Ação | Resultado |
|---|---|---|---|
| 20261014181000 reconciliação de grants | GRANTs já presentes (`is_restricted_operator`, `is_app_scope_allowed` com EXECUTE para authenticated) | reaplicada (idempotente) | OK |
| 20261014221500 faltas com ciclo de vida | ausente (sem colunas `status/command_id`, sem `separation_shortage_events`, sem `can_use_app`) | aplicada | OK: `can_use_app`, `separation_actor_name`, eventos imutáveis, view, RPC de 4 args |
| 20261014224500 inventário escopo de app | 4 funções usavam `can_access_unit` | aplicada | OK: 4 funções passam a `can_access_inventory_unit` |
| 20261014223000 fase A | ausente | aplicada só seções 1 a 3 (funções, `separation_signals`, gatilhos, publicação realtime, `is_separa_only_operator`) | OK |

Fase B (seção 4, bloqueio da leitura direta `*_no_separa_direct`) NÃO aplicada: depende do front novo publicado (decisão 4). Verificação: `select count(*) from pg_policy where polname like '%no_separa_direct'` = 0. Total de migrations: 190 (186 + 4). Uma tentativa de aplicar 224500 e 223000 em paralelo colidiu na versão (23505) e foi revertida por inteiro; reaplicada em série. Nada ficou parcial.

## B. Fixtures e roteiro

Usuários (todos empresa A, exceto outra): separa=`separador@`, producao=`rot-producao@` (só `producao.operar`), entrega=`rot-entrega@` (só `entrega.operar`), multi=`rot-multi@` (os dois), gestor=`gestor@` e admin=`legado-1@` (Proprietário, sem `.operar`), outra=`outra-empresa@` (empresa B). Os três `rot-*` e `rot-unidade@` foram criados por SQL sem senha: servem a testes por JWT simulado; login real exige definir senha em `C:\Users\rruan\homolog-credenciais.txt` (não feito). Os usuários antigos (entregador@, producao@, vendedor@) foram preservados sem alteração: o role ENTREGADOR existente tem `separa_confere.operar`, não `entrega.operar`.

Dados: semeador `scripts/homologacao/01_seed_generico.sql` + `02_fixtures_manuais.sql` deixaram pelo menos 1 linha em cada tabela com `company_id`, nas duas empresas (115 tabelas), exceto `purchase_corrections` (exige compra com item; não semeada).

Roteiro (`scripts/homologacao/03_roteiro_homologacao.sql`, em transação, rollback por exceção): **348 OK, 0 FALHOU, 0 INCONCLUSIVO**. Cobre T1 leitura (6 perfis x 42 tabelas), T2 RPCs por perfil, T3 `my_app_access`, T4 isolamento de empresa, T5 anônimo sem EXECUTE.

A primeira execução deu 343 OK e 12 FALHOU, todos defeito do roteiro e não do banco, corrigidos no script:
- `create_production(...)` com 2 e 3 argumentos ficava ambíguo com NULL (42725); o teste passou a chamar só a sobrecarga de 4 args. Verificado à parte: separa e entrega 42501; producao, multi e gestor passam da guarda (P0001 de validação); anônimo 42501.
- `memberships`: operador restrito lê a própria linha (política `user_id = auth.uid()`), logo "parcial" é o esperado.
- `company_integration_credentials`: nenhum perfil autenticado tem SELECT (desenho para segredos), esperado "nada" também para gestor/admin.
- anônimo: faltava limpar os claims do usuário anterior.

## C. Estoque e inventário sintéticos (empresa A)

Feito por RPCs reais sob JWT simulado (`scripts/homologacao/04_estoque_sintetico.sql`):
- 3 matérias-primas com entrada confirmada por `confirm_raw_material_entry` e lote/validade: Pimenta (LOTE-SINT-1, 2026-12-31, saldo 10), Sal (LOTE-SINT-2, 2027-06-30, 250), Cominho (LOTE-SINT-3, vence 2026-10-20, 5000), custo médio calculado.
- `create_stock_entry` de 50 unidades; baixa de pedido de 3; pedido cancelado gerou `stock_returns` (CANCELLATION) pelo gatilho; `confirm_stock_return(id, 2, obs, true)` devolveu 2 ao estoque (movimento `return`) e registrou 1 perda (`stock_loss_records`, source RETURN). Nota: o gatilho só dispara se o pedido já tinha `separation_finished_at`.
- Inventário: sessão OPEN escopo ALL, 3 contagens pelo separador (`inventory_begin_count` + `inventory_register_count`), divergências resolvidas pelo gestor (1 APPROVED, 1 DISMISSED), `inventory_close_session` (a sessão fechou como CLOSED_INCOMPLETE por haver itens sem contagem).
- Job `estoque-inventory-sync` (`select private.inventory_sync_all()`, */5 min): 58 execuções, 58 ok, 0 falhas. Prova de efeito: sessão OPEN da empresa B com término vencido virou CLOSED_INCOMPLETE ao rodar a mesma função.

Recomendação sobre os 3 cron jobs (nenhum foi desligado):
- `estoque-inventory-sync`: manter na homologação; é o que fecha sessões vencidas e abre as agendadas. Em produção só junto com o pacote de inventário.
- `oris360-monthly-close-sweep` (*/30): 10 execuções ok; inofensivo com dados sintéticos; manter para provar o fechamento, desligar se atrapalhar contagens.
- `monthly-close-rollover` (diário 03:00): nunca rodou; aceitável deixar; antes de ligar em produção, testar numa competência sintética, pois fecha mês.
Custo: os três são rotinas SQL leves; não geram recurso pago.

## Limites

- Teste por `set role` + claims valida RLS/RPC no Postgres real, mas NÃO substitui API, Auth e navegador reais (critério 8).
- Fase B do Separa, salário/Pix 2, storage e crédito não foram tocados nesta onda.
- Itens abertos estão em `docs/homologacao/DECISOES_PENDENTES.md` (itens 9 a 12).
