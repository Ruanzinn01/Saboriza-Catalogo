# Ambiente de homologação, envio da branch e efeitos automáticos

Estado em 2026-10-14. Nada foi enviado ao GitHub. Nada foi alterado em produção (só leituras).

## 1. Avaliação do projeto `saboriza-homolog` (ref zkaqzayzpowupzxekali) para homologação conjunta

Somente leitura. Não foi pausado, excluído ou recriado.

| Item | Encontrado |
|---|---|
| Origem | criado em 2026-10-14 22:39 UTC, região sa-east-1, plano free; provavelmente pela sessão do Separa Confere |
| Schema `public` | 54 tabelas, 87 funções em `public`/`private`, 627 colunas (produção: 1.591 colunas, 211 funções) |
| Tabela de migrations | não existe `supabase_migrations.schema_migrations`: o schema foi montado fora da trilha, sem registro de versões |
| Ausentes | `employees`, `time_punches`, `employee_employments`, `salary_obligations`, `expenses` e todo o módulo de ponto, folha e despesas |
| Presentes | núcleo SaaS, pedidos, produtos, estoque, Separa Confere (`separation_*`, `inventory_*`), `transactional_outbox`, buckets `delivery-*` e `oris360-private` |
| Dados | 2 empresas, 4 pedidos, 7 usuários Auth com e-mail `@homolog.test` (sintéticos) |
| Extensões | `pgcrypto`, `supabase_vault`, `pg_cron` |
| Edge Functions | nenhuma publicada |

Conclusão: atende ao Separa Confere (é o que ele cobre), mas NÃO atende à homologação de ponto, folha, remuneração, Despesas e Asaas, porque o schema é parcial. Usá-lo assim esconderia incompatibilidades.

Para torná-lo conjunto seria preciso reconciliar as 54 tabelas criadas fora da trilha com a trilha completa reconstruída (185 migrations). Opções, sem executar nada agora:
- (a) recriar um ambiente limpo a partir da trilha (exige liberar vaga no plano free ou upgrade) e migrar o Separa Confere para ele;
- (b) aplicar a trilha por cima, depois de comparar tabela a tabela o que já existe (maior risco de divergência, não recomendado);
- (c) manter o `saboriza-homolog` só para o Separa Confere e criar um segundo ambiente para o restante.

Antes de qualquer reconstrução: a trilha está completa e reconciliada localmente (185 arquivos, equivalência por hash provada em PGlite). As migrations em `supabase/pendentes/` ficam fora da trilha até aprovação.

## 2. Variáveis e permissões mínimas (configuração por canal seguro, nunca no chat)

| Variável | Onde | Valor | Permissão mínima |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Vercel, ambiente Preview, restrita à branch de homologação | URL do projeto de homologação | pública |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | idem | chave publishable (anon) do projeto de homologação | pública, só RLS |
| `SUPABASE_ACCESS_TOKEN` | variável de ambiente local de quem aplica migrations | token pessoal de um membro com acesso APENAS ao projeto de homologação | token pessoal não tem escopo granular: usar conta/membro sem acesso a produção |
| `SUPABASE_DB_PASSWORD` | idem | senha do banco de homologação | administrador do banco de homologação |
| `HOMOLOG_PROJECT_REF` | idem | ref do projeto de homologação | nenhuma (identificador) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | secrets das Edge Functions do projeto de homologação | injetadas pela própria Supabase em cada projeto | service role só dentro da função; nunca no front |
| Chaves do Asaas | a confirmar onde o sistema as guarda (as funções não leem do ambiente; provavelmente tabela de configuração ou vault) | chave do ambiente de testes (sandbox) | somente sandbox, sem cobrança real |

Regras: no front de homologação nenhuma credencial de produção; as variáveis atuais da Vercel existem só para o ambiente Production. O webhook do Asaas de homologação aponta para a função do projeto de homologação, com token próprio.

## 3. Os 17 commits de `origin/main..main` (escopo e origem)

Mesmo autor não prova pertencer a esta entrega. Origem por escopo:

| Commit | Escopo | Origem |
|---|---|---|
| 0606cb9 | estoque: faixas de saúde (1 arquivo) | pré-existente (pacote de estoque); o Separa V3 do commit seguinte depende dele |
| f0b25ed | Separa Confere V3 (31 arquivos) | OUTRA FRENTE. Conteúdo idêntico ao 22b2230 da branch do Separa Confere (mesma data/hora; difere só pelo 0606cb9) |
| 712be48 | Despesas Visão Geral V5.7, busca de fornecedor | esta entrega |
| c5b86ec | Colaboradores V4.1: vencimento salarial, folha nos totais | esta entrega; 2 migrations aplicadas em produção antes |
| 5e41ea4 | Integrações pacote 0: outbox, ponto e Meu 360 endurecidos | esta entrega |
| b1ae83c | alinha versões das 18 migrations com as do banco | esta entrega |
| f45829a | histórico de contratação por período | esta entrega |
| 94be1fa | revisão de ponto, ajustes, Espelho | esta entrega |
| 49f236e | worker de outbox e consumidores | esta entrega |
| 2fea65f | docs: prévia salarial, plano de homologação do ponto | esta entrega |
| 366bde4 | correção das funções de borda (não publicadas) | esta entrega |
| 54c35da | apps isolados Produziu/Entrega Registra (41 arquivos) | OUTRA SESSÃO; mexe em `employees-store`, `employee-mapper`, `RolesPermissionsPanel`, `App.tsx` |
| ecf2cfc | patches pendentes de correção e testes de compatibilidade | esta entrega (patches NÃO aplicados) |
| 919bb05 | devolutiva de homologação | esta entrega |
| 3b23de0 | front de remuneração por funções, comissão, fuso do ponto | esta entrega |
| 77fcd0a | docs: convergência salarial, verificação de batidas | esta entrega |
| e2447ea | migration pendente dos apps isolados validada em réplica (3 arquivos em `supabase/pendentes`, 4 docs em `docs/apps-operacionais`) | OUTRA SESSÃO; entrou na `main` depois da criação da branch |
| dc61837 | docs: exemplo antes/depois de horas extras | esta entrega |

Há ainda commits locais posteriores: o teste de remuneração isolado do cliente Supabase (o CI roda `npm run test` sem variáveis de ambiente; defeito pego na cópia isolada) e este documento.

## 4. Rebase em cópia local isolada

- Referência preservada: branch `trabalho/homologacao-anterior-dc61837`.
- Cópia isolada: pasta `../saboriza-rebase-isolado`, branch `trabalho/homologacao-rebase`, a partir de `origin/homolog/separa-confere-v3`.
- Comparação: o Separa V3 do meu `f0b25ed` e o `22b2230` da branch dele têm conteúdo idêntico, então o `f0b25ed` não foi reaplicado. Os demais commits foram reaplicados com `cherry-pick -x`, sem conflito textual.
- Validação na cópia: `tsc --noEmit` limpo; 14 arquivos e 104 testes unitários passando, com e sem variáveis de ambiente.
- Limite: ausência de conflito textual não prova ausência de conflito semântico (por exemplo `App.tsx` e permissões editados pelas duas frentes). Falta teste de navegador.
- Nenhuma branch remota foi reescrita; sem force push.

## 5. Efeitos automáticos de um push

Confirmado por leitura:
- **Vercel (`saboriza-catalogo`)**: repositório conectado (existe domínio `...-git-main-...`). Produção sai da `main`; outra branch gera deploy de Preview. As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` existem só no ambiente Production; o Preview não recebe nenhuma. `src/lib/supabase.ts` não tem fallback, então um Preview sem variáveis quebra ao abrir e não fala com produção. Proteção SSO ativa. Efeito: o push da branch geraria um Preview inerte, sem publicar em produção.
- **CI do GitHub** (`.github/workflows/ci.yml`): roda só em push e PR para `main`. Push de outra branch não dispara; um PR para `main` dispararia test e build (não aplica migrations).
- **Supabase de produção**: sem ramificações (branches) e sem `supabase/config.toml` no repositório.

Não confirmado (depende do painel, não acessível por aqui):
- se a integração GitHub do Supabase está ligada ao projeto de produção e aplica migrations de `supabase/migrations` ao receber push. Como essa pasta tem 185 arquivos (163 reconstruídos), uma integração automática que os reaplicasse seria perigosa;
- se o Vercel tem "Ignored Build Step" ou branch de Production diferente de `main`.

Recomendação: confirmar a integração no painel (Settings, Integrations, GitHub) antes de qualquer push que contenha arquivos de `supabase/migrations/`.
