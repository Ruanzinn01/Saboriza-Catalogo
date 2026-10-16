# Ordem de merge e aplicação de migrations (PROPOSTA, nada executado)

Gerado em 2026-10-16 por mapeamento de `git log`/`merge-base`/`git cherry`. Nenhum push, merge em branch existente ou escrita em banco foi feito.

## 1. Mapa das branches

| Branch | Base | Conteúdo próprio |
|---|---|---|
| `origin/main` = `d1d73de` | – | Ondas de estoque/compras (última: `d1d73de`). |
| `main` local `483173d` | `d1d73de` (23 à frente) | Cópias das frentes de outras sessões (ver 2). |
| `trabalho/pendencias-versionadas` `9621b0a` | `main` +2 | Trilha reconstruída `63aafb0` (163 migrations + harness) e `9621b0a` (pendentes salário/Pix, storage). Já contida em `ondas`. |
| `trabalho/ondas-chief-of-staff` `5522d43` | `main` +20 | Trilha + pendencias-versionadas + ondas 0-3 (homologação, CPF/RG, fornecedores v1, clientes/crédito, auditoria, financeiro, apps-operacionais doc). |
| `trabalho/homologacao-rebase` `c9d7a8e` | `origin/main` +26 | Reaplicação (rebase) dos 20 commits das outras sessões sobre `origin/main`, mais 6 da frente Separa Confere V3 (`22b2230`..). Não contém trilha nem ondas. |
| `origin/homolog/separa-confere-v3` `390dc65` | `origin/main` +7 | Só Separa Confere V3 (`22b2230`, `6e03072`, `375daa6`, `da216d4`, `c8c99f0`, `d68f997`, `390dc65`). |

Merge-base de `ondas` com: `main`=`483173d`; `homologacao-rebase`/`separa-v3`/`origin/main`=`d1d73de`; `pendencias-versionadas`=`9621b0a`.

## 2. Commits de `origin/main..main` (23) por frente

`git cherry` contra `homologacao-rebase`: 20 têm equivalente por patch (SHA diferente, mesmo conteúdo); 3 não têm.

- Separa Confere V3: `f0b25ed` (equivalente a `22b2230`). Na branch `separa-v3` a frente continua com mais 6 commits que a `main` NÃO tem.
- Apps isolados: `54c35da` (frontend), `e2447ea` (migration validada).
- Colaboradores/ponto/integrações/outbox: `c5b86ec`, `5e41ea4`, `f45829a`, `94be1fa`, `49f236e`, `2fea65f`, `366bde4`, `3b23de0`, `77fcd0a`, `dc61837`, `a34490b`.
- Despesas/estoque: `712be48`, `0606cb9`.
- Segurança/homologação docs e testes: `ecf2cfc`, `919bb05`, `92f43f4`.
- Sem equivalente na rebase: `b1ae83c` (alinha versões de migrations; a rebase tem `5e3e95e` adaptado, conferir), `2b8b9fb` e `fd570aa` (crédito do cliente, migration pendente), `483173d` (traz `20261014230013` para a trilha).

## 3. Resultado do teste de combinação (branch descartável `teste/combinacao-ondas`)

`git merge --no-commit trabalho/homologacao-rebase` sobre `ondas`. App.tsx, permissões, rotas e DECISOES_PENDENTES.md auto-mesclaram sem conflito (rotas já estavam na `main`). Conflitos reais, todos de Separa Confere V3 (mesma frente, duas versões):

- `src/store/separation-store.ts`, `SeparationItemSheet.tsx`, `SeparationShortagesReport.tsx` (add/add), `SeparaConfereOrderPage.tsx`: resolvidos com `--theirs` (versão da rebase/V3 é a mais nova, com faltas de ciclo de vida).
- `supabase/migrations/20261014150436_...grant_operator_fn.sql` e `20261014230013_...revoga_falta.sql` (add/add): SQL idêntico, só mudam comentários. Resolvido com `--theirs`.

Verificação no resultado: `npx tsc --noEmit` exit 0; `npm run build` ok; `npm test` 120 testes passam mas 2 arquivos falham sem env (`customer-credit.test.ts`, `auditoria-central.test.ts` importam `src/lib/supabase.ts` e pedem `supabaseUrl`). Com `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` fictícias: 18/18 arquivos, 130/130 testes. A falha sem env já vem das ondas (não do merge); CI roda sem variáveis, então o mesmo isolamento do cliente feito em `a34490b` precisa ser aplicado a esses dois testes.

Conflitos semânticos: nenhuma rota duplicada (`grep path=` sem duplicatas além de `*`); nenhum timestamp repetido entre `supabase/migrations` e `supabase/pendentes` (repetições em pendentes são pares aplicar/reverter). Ponto de atenção de ordem: `20261014230013` (trilha, revoga a função de 3 args) é posterior aos pendentes `221500..224500`; não há choque, pois `221500` faz `drop function` da assinatura de 3 args e concede a de 4 args.

## 4. Ordem de merge proposta

1. Fixar a base: tratar `origin/main` (`d1d73de`) como tronco. Não mexer na `main` local ainda.
2. Frente Separa Confere V3: revisar e mesclar `homolog/separa-confere-v3` (sobre `origin/main`).
3. `homologacao-rebase` sobre o resultado (descarta os 6 commits V3 duplicados, que são os mesmos patches).
4. `ondas-chief-of-staff`: antes, `git rebase --onto` NÃO deve ser feito na `main`; criar branch nova a partir do resultado 3 e fazer cherry-pick só dos commits próprios da ondas (lista abaixo), ou mesclar `ondas` e resolver os 6 arquivos como na seção 3.
5. Corrigir os 2 testes sem env e rodar tsc/test/build antes de qualquer PR.

Commits próprios das ondas (fora da `main`): `63aafb0`, `9621b0a`, `8b5bf18`, `1c9f244`, `cba3a59`, `00f8b23`, `f91b3b2`, `b6ba938`, `26cd33f`, `015cdd4`, `c967a07`, `90b2cb1`, `b537f6e`, `fe73ea6`, `0f0f8a6`, `7e4564e`, `a04ffc3`, `4efbad7`, `bbd0e3e`, `5522d43`. Os 2 commits de crédito (`2b8b9fb`, `fd570aa`) e `483173d` hoje só existem na `main` local e entram via a `ondas`.

## 5. Separar a `main` local de `origin/main`

- A `main` local não deve ser empurrada como está: mistura 3 frentes. Como 20 dos 23 commits já existem na `homologacao-rebase` e na `separa-v3`, a `main` local vira redundante após o passo 3.
- Sugestão: preservar a `main` atual com uma tag/branch de backup (`git branch backup/main-2026-10-16 main`), e só depois, com ordem do dono, alinhar `main` a `origin/main` e reaplicar por merge as branches da seção 4. Não reescrever histórico antes dessa ordem.
- Os 3 commits sem equivalente (`b1ae83c`, `2b8b9fb`+`fd570aa`, `483173d`) precisam de decisão do dono: já estão dentro da `ondas`, então basta não duplicá-los.

## 6. Ordem de aplicação das migrations em produção (PROPOSTA)

Pré-condição: conferir `list_migrations` de produção (somente leitura) contra `supabase/migrations`; a trilha tem 185 arquivos reconstruídos. Cada item abaixo exige ordem direta e teste com rollback.

1. Trilha: nada a aplicar se `list_migrations` bater (a `20261014230013` já está em produção).
2. `20261014180000_apps_operacionais_isolados.sql` seguida, na mesma janela, de `20261014181000_apps_operacionais_reconciliacao_grants.sql`.
3. `seguranca_storage_multiempresa.sql` (depende de `private.is_restricted_operator` do item 2).
4. Separa Confere V3: `20261014221500` (faltas), `20261014223000` (dados mínimos/tempo real), `20261014224500` (escopo de app no inventário; depende de `private.can_use_app` do 221500).
5. `correcoes_pre_homologacao.sql`.
6. Segurança aditivas: `seguranca_salario_pix_1_aditiva`, `seguranca_cpf_rg_telefone_1_aditiva`; depois as restritivas `..._2_restritiva` somente após o frontend compatível estar publicado; `seguranca_higiene_grants` por último das de segurança.
7. `20261015130000_convergencia_horas_extras_obrigacao`, `20261015140000_asaas_webhook_evento_atomico` (Edge Function correspondente continua sem publicar até ordem).
8. `20261015120000_credito_cliente_fonte_unica` (concorrência real não provada; decisão pendente).
9. `20261016100000_fornecedores_v1_categorias_possiveis`, `20261016120000_financeiro_rpcs_atomicas`, `20261016121000_central_auditoria_leitura`.

Cada migration tem arquivo `_reverter`/`_REVERSAO` correspondente. Nota: pendentes `2026101418*` têm timestamp menor que `20261014230013` já aplicada; aplicar por nome via MCP/SQL, não por `supabase db push` (que rejeitaria fora de ordem).
