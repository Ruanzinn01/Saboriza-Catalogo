# Resultado da prova de concorrência do crédito (homologação dfynvpieyvvameftrent)

Data: 2026-10-16. Status: **NÃO PROVADA** (cenários A, B e C não executados como concorrentes).

## Pré-requisitos confirmados (somente leitura/sondagem, tudo com rollback)
- Migration aplicada na homologação: `private.sync_credit_commitment`, `private.compute_credit_snapshot` (3 funções no schema private), `public.oris360_billing_confirm`, `oris360_credit_overview`, `oris360_set_credit_limit`, trigger `orders_sync_credit_commitment` e tabela `credit_commitments` existem (SELECT em pg_proc/pg_trigger/pg_class).
- Extensões: `dblink` e `postgres_fdw` estão apenas disponíveis (installed_version nulo); `pg_background` não existe. Não foram instaladas (proibido).

## Sondagem de concorrência do MCP
Duas chamadas `execute_sql` na mesma resposta, cada uma um bloco `do $$` com rollback por `raise exception`:
- Teste 1: A pega `pg_advisory_xact_lock(777001)` e dorme 8 s; B espera 2 s e chama `pg_try_advisory_xact_lock(777001)`. Resultado: B obteve `true` (pids distintos 47085/47087), ou seja, A não segurava o lock quando B rodou.
- Teste 2: A pega lock 777002 (início 54.476, fim 02.492); B (início 03.036) obteve o lock após 2 s de sleep. B começou depois do fim de A: as chamadas são **serializadas pelo cliente/MCP**, não paralelas.

Conclusão: o MCP não oferece duas sessões simultâneas; qualquer cenário rodado assim passaria por serialização e não provaria o lock por cliente. Nenhum dado sintético foi criado (a prova foi abortada antes do passo 0).

## Como provar (pendente, sem segredos no repositório)
Script Node com duas conexões `pg` reais, lendo a URL de conexão direta de variável de ambiente fornecida pelo responsável fora do repositório (ex.: `HOMOLOG_DB_URL`, nunca versionada), apontando só para a homologação. Roteiro: passo 0 sintético (cliente ZZ-CONCORRENCIA, `@homolog.test`, empresa de homologação) com commit; cenários A/B/C de `scripts/homologacao/credito_concorrencia.sql` com S1 em `begin` + `pg_sleep(10)` + `rollback` e S2 iniciada 2 s depois, medindo `s2_fim - s2_inicio` (esperado >= 7 s em A/B; B2 recusada com OVER_LIMIT se S1 confirmar) e a verificação final (0 billings `zz-conc-%`, 0 commitments abertos). Alternativa: instalar `dblink` na homologação, mediante ordem direta do responsável.
