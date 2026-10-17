# Prova em PGlite: sequência dos apps isolados sobre o estado atual de produção

Data: 2026-10-17. Branch: `trabalho/publicacao-apps`. Nada foi aplicado em banco real. PGlite não substitui homologação (sem PostgREST, Auth, Storage, Realtime nem concorrência real).

## 1. Pré-checagem em produção (`opeietrhbqlhrhljcdtx`, somente SELECT)

- 192 migrations, última `20261016220303` (central_auditoria_leitura). Confere.
- Objetos criados pelos 5 arquivos dos apps: nenhum existe ainda, exceto dois que as migrations redefinem de propósito:
  - `private.is_restricted_operator(uuid)`: hoje é só `has_permission(..., 'separa_confere.operar')`; a 180000 troca pela regra "algum `*.operar` e sem `admin.acessar`".
  - `public.separation_report_shortage`: a 221500 faz `drop function` e recria.
- Inexistentes: `app_table_access`, `separation_shortage_events`, `separation_signals`, `separation_shortage_report`, as permissões `producao.operar`, `entrega.operar`, `admin.acessar`, as funções `operator_perm_keys`, `operator_apps`, `is_app_scope_allowed`, `assert_app_access`, `can_use_app`, `separation_actor_name`, `block_shortage_event_changes`, `can_access_inventory_unit`, `touch_separation_signal`, `is_separa_only_operator`, `my_app_access`, `operator_list_production_employees`, `operator_confirmed_billing_order_ids`, `separation_snapshot`, `separation_accept_order`, `separation_release_order`, `separation_set_item`, `separation_request_adjustment`, `separation_resolve_adjustment`, `separation_cancel_shortage`, e nenhuma policy `*_app_scope*` ou `*_no_separa_direct`.
- Membros: 3, todos ACTIVE, todos no papel `OWNER`. Nenhum papel tem permissão `*.operar` nem `admin.*` (consulta em `role_permissions` não retornou linhas). Logo, nenhum membro atual vira "restrito" ao aplicar.

## 2. Ordem exata provada

Base: trilha de 186 (`supabase/migrations`) reconstruída em PGlite, depois:

1. 20261015120000_credito_cliente_fonte_unica
2. 20261016100000_fornecedores_v1_categorias_possiveis
3. 20261016140000_clientes_v1_mestre
4. 20261016141000_fornecedores_v1_mestre_complemento
5. 20261016142000_clientes_v1_fix_conflito_revisao_errcode
6. 20261016121000_central_auditoria_leitura
7. 20261014180000_apps_operacionais_isolados
8. 20261014181000_apps_operacionais_reconciliacao_grants
9. 20261014221500_separa_confere_v3_faltas_ciclo_de_vida
10. 20261014224500_separa_confere_v3_inventario_escopo_de_app
11. 20261014223000_separa_confere_v3_dados_minimos_e_tempo_real, SOMENTE Fase A

Observação: 224500 vem antes de 223000 porque a Fase A não depende dela e 224500 depende só de `can_use_app` (221500). A 223000 depende de 180000 e 221500 (cabeçalho do arquivo).

### Linha de corte da Fase A (arquivo `supabase/pendentes/20261014223000_separa_confere_v3_dados_minimos_e_tempo_real.sql`, 319 linhas)

- Aplicar as linhas 1 a 304. A linha 304 é a última da seção 3: `grant execute on function private.is_separa_only_operator(uuid) to authenticated;`
- Linha 305 em branco. Linhas 306 a 308 são o cabeçalho da seção 4; linha 307: `-- 4) FASE B — bloqueio da leitura/escrita direta. NÃO executar antes do frontend novo estar publicado.`
- Linhas 309 a 319 (bloco `do $$ ... foreach t in array array['orders','order_items','order_adjustment_requests','products']` que cria `*_no_separa_direct`) NÃO devem ser aplicadas.
- Sem ambiguidade: o cabeçalho do arquivo (linhas 6 a 8) define fase A = seções 1 a 3 e fase B = seção 4, e a seção 3 inclui `is_separa_only_operator` (usada só pela Fase B, mas é aditiva e inofensiva).
- Se for aplicar por `apply_migration`, enviar o conteúdo exato das linhas 1 a 304 (`head -n 304`).

## 3. Resultados (harness `prova_sequencia.mjs` no scratchpad da sessão, usa `replay-pglite.mjs` sem alterá-lo)

- Trilha 186: 0 falhas. As 6 já em produção: aplicadas sem erro (base: 291 funções, 344 políticas, 147 tabelas).
- 5 migrations dos apps (Fase A): todas aplicadas sem erro de dependência, na ordem acima.
- Novos: 21 funções (private + public), 3 tabelas (`app_table_access`, `separation_shortage_events`, `separation_signals`), 38 políticas.
- Nenhuma policy ou objeto `*_no_separa_direct` depois da Fase A (0 linhas em `pg_policies`; trecho da Fase A não contém o texto).
- 19 funções esperadas existem (faltas: `separation_report_shortage`, `separation_cancel_shortage`; snapshot/aceitar/liberar/item/ajuste; inventário: `inventory_begin_count`, `inventory_register_count`, `inventory_session_items`, `inventory_list_sessions`). As 4 de inventário usam `can_access_inventory_unit`.
- Funções `private.*` citadas em políticas (10): todas com EXECUTE para `authenticated`.
- Anon: nada novo em `public` com EXECUTE. Total com EXECUTE para anon em `public` caiu de 41 para 36 (a 180000 revoga 5 RPCs de produção/pedido). Informativo: `private.inventory_can_manage` já tinha EXECUTE para anon antes dos apps (fora do escopo, schema `private`).
- Proprietário (sintético, sem `*.operar`): `is_restricted_operator=false`, `is_separa_only_operator=false`, `my_app_access.admin_access=true`, lê `orders`/`products`/`employees`/`separation_signals` sem erro, chama RPC de app sem 42501.
- Operador só-Separa: restrito=true, separa_only=true, ainda lê `orders` direto (correto sem a Fase B), não lê `employees`, `separation_snapshot` não dá 42501.
- Teste existente `supabase/pendentes/testes_apps_operacionais_replay.mjs` (trilha 186 + 180000 + patch de Storage): 191 verificações OK, 0 falhas. Ele não inclui as 6 migrations atuais nem as demais 4; por isso o harness da seção acima cobre a sequência completa.
- Testes unitários TS dos apps (`operator-apps.test.ts`, `inventory.test.ts`, `separation-snapshot.test.ts`): 3 arquivos, 26 testes OK.
- Não existe teste PGlite específico de Separa Confere/inventário em `supabase/pendentes/`; o que existe sobre o tema está em `testes_apps_operacionais_replay.mjs` e `testes_homologacao.sql` (este último é para banco real, não executado).

## 4. Riscos e pontos de atenção

1. PGlite não prova: PostgREST/RLS via HTTP real, Realtime (publicação `separation_signals` só testada pelo SQL), concorrência, performance das políticas por linha. A 181000 existe justamente por um defeito (DEF-06, 42501 em política) que só apareceu por HTTP real.
2. A 180000 troca a regra de `is_restricted_operator` e injeta guarda nos corpos de ~17 RPCs (`create or replace` por reescrita do `pg_get_functiondef`). Em produção os corpos podem divergir do banco reconstruído; a prova só vale se produção bater com a trilha (hash por função recomendado antes de aplicar).
3. Hoje nenhum papel de produção tem `*.operar`; após aplicar, quem receber `producao.operar`/`entrega.operar` ou `separa_confere.operar` sem `admin.acessar` fica confinado aos apps. Não conceder essas permissões a Proprietário sem `admin.acessar`.
4. A Fase B (`*_no_separa_direct`) fica fora. Só aplicar depois do frontend novo estar publicado, em migration separada. Até lá o operador do Separa ainda lê `orders`, `order_items`, `order_adjustment_requests`, `products` direto.
5. Aplicar 180000 e 181000 na mesma janela (sem a 181000, leituras das tabelas com política restritiva falham com 42501).
6. As migrations em `pendentes/` não têm timestamps iguais aos que o Supabase registra (produção registrou as 6 anteriores com versões `20261016215555`...); definir os nomes ao aplicar.
7. `separation_report_shortage` sofre `drop function` + recriação: confirmar que o frontend em produção não chama a assinatura antiga durante a janela.
