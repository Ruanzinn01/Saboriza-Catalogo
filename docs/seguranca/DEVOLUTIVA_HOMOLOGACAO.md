# Devolutiva: segurança, ambiente reproduzível, versionamento e correções

Nada deste documento foi aplicado em produção. Produção só recebeu leituras nesta etapa.

## 1. Estado por camada

| Item | Local | Versionado (commit local) | Homologação | Produção |
|---|---|---|---|---|
| Trilha de migrações reconstruída (185 arquivos) | sim | sim | não existe | banco original, intacto |
| Patch segurança salário/Pix (fase 1 aditiva, fase 2 restritiva) | sim | sim, em `supabase/pendentes/` | não aplicado | NÃO aplicado |
| Patch storage multiempresa | sim | sim | não aplicado | NÃO aplicado |
| Correções pré-homologação (competência ambígua, eventos sem perda, USAGE em `private`) | sim | sim | não aplicado | NÃO aplicado |
| Funções de borda (ponto, Meu 360, Asaas) | sim | sim | não publicadas | NÃO publicadas |
| Worker de outbox | sim | sim | sem ativação | sem ativação |
| Front: dual-mode de remuneração (funções com fallback), motivo salarial, comissão por função, fuso da empresa nos ajustes de ponto | sim (tsc + 98 testes unitários) | sim | não testado em navegador | NÃO publicado |

## 2. Achado crítico: gravação de batida pela função de borda falha em produção

`service_role` não tem `USAGE` no schema `private`. Dois gatilhos de `time_punches` (`time_punch_eligibility` e `sync_occurrence_after_punch`) são funções invoker que consultam `private.*`. Qualquer insert de batida como `service_role` falha com `permission denied for schema private`.

- O gatilho `sync_occurrence_after_punch` é anterior às migrações desta entrega: o defeito é pré-existente.
- Não foi verificado em produção se batidas reais foram perdidas (exigiria consulta aos logs da função; fica para a homologação).
- Correção: `grant usage on schema private to service_role` (em `correcoes_pre_homologacao.sql`). Reversão: `revoke usage`. Testada por hash.

## 3. Segurança de salário e Pix

Prova executada (replay do banco reconstruído, PGlite): `docs/seguranca/EVIDENCIA_TESTES_SALARIO_PIX.txt` (89 verificações).

- Fase 1 (aditiva): permissões `colaboradores.remuneracao.read/manage`, concedidas a quem já tinha `despesas.manage`; funções `get/list/set_employee_compensation`, `set_employee_commission_rate`, `list_commission_rates`. Não muda nenhum comportamento existente.
- Fase 2 (restritiva): revoga leitura direta das colunas sensíveis de `employees` e de `salary_history` para `authenticated/anon`; salário passa a ser lido e gravado só pelas funções com permissão e motivo. Só aplicar depois que o front usar as funções (item pendente).
- Auditoria: Pix nunca gravado inteiro (máscara + impressão curta).
- Reversão: `seguranca_salario_pix_reverter_1.sql` e `_reverter_2.sql` (gerada pelo teste, verificada por hash).
- Acesso do próprio colaborador: não existe vínculo usuário-colaborador hoje; há gancho documentado na função de leitura. Meu 360 usa função de borda com service_role e não depende das colunas.

Limitações conhecidas (não resolvidas):
- CPF, RG e telefone continuam legíveis a qualquer membro ativo da empresa.
- `despesas.read` enxerga a folha gerada.
- Teste feito em replay, não pela API PostgREST real.
- O front atual lê as colunas direto: a fase 2 quebra telas até o front migrar.

Ordem de aplicação proposta (cada passo exige aprovação específica): correções pré-homologação, fase 1, publicar front dual-mode, fase 2, storage.

## 4. Ambiente de teste e banco reproduzível

| Opção | Custo | Prós | Contras |
|---|---|---|---|
| Local isolado (PGlite, já em uso) | zero | funciona hoje, prova por hash | não roda PostgREST, Auth, Edge Functions |
| Local Supabase CLI (Docker) | zero | stack completa | Docker não instalado nesta máquina |
| Projeto Supabase separado | plano free: US$0 (limite de projetos ativos, pausa por inatividade) | API real, funções de borda reais | precisa de credenciais |
| Ramificação (branch) do projeto | cerca de US$0,01344/h (~US$0,32/dia) | cópia do esquema | exige trilha de migrações completa (agora existe) |

Recomendação: projeto separado para homologação, com a trilha reconstruída. Pré-requisito: criar dois usuários placeholder no Auth (UUIDs referenciadas por migrações antigas). Nunca rodar `db push` apontado para produção.

Credenciais, procedimento seguro: criar o token de acesso do Supabase e a senha do banco no painel, guardar em variável de ambiente da máquina (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`), nunca em mensagem, chat ou repositório.

## 5. Reconciliação banco × repositório

- Histórico real recuperado de `supabase_migrations.schema_migrations`: 163 migrações reconstruídas + 21 idênticas ao repositório + 1 diferente (`estoque_onda4a`). Manifesto: `supabase/baseline/MANIFESTO_HISTORICO.json`.
- Equivalência: replay da trilha e produção geraram hashes idênticos nas 12 categorias de `supabase/baseline/assinaturas.sql` (funções comparadas ignorando comentários).
- `estoque_onda4a`: o arquivo do repositório difere do texto aplicado; vale o aplicado (reconstruído). O arquivo antigo fica registrado como divergência no manifesto.
- Reproduzir: `PGLITE_DIR=<pasta> node supabase/baseline/replay-pglite.mjs --assinaturas`.

## 6. Versionamento sem publicação automática

- Push na `main` dispara deploy do front na Vercel (produção). CI só roda test/build. Migrações NÃO rodam no push. A integração GitHub do Supabase não foi confirmada: conferir no painel antes de qualquer push.
- Commits desta frente dependem de: `f0b25ed` (Separa Confere), `0606cb9` (estoque) e `54c35da` (apps operacionais, de outra sessão: mexe em employees-store, employee-mapper, RolesPermissionsPanel e App.tsx). Nenhum arquivo de outra sessão foi alterado por mim.
- Branch local de trabalho `trabalho/homologacao` criada a partir do estado atual, sem push.

## 7. Correções antes da homologação

Executado e aprovado em replay (`EVIDENCIA_TESTES_COMPATIBILIDADE_E_CORRECOES.txt`):
- Competência ambígua (duas contratações no mesmo mês): obrigação não é formada automaticamente, erro `COMPETENCIA_AMBIGUA`.
- Duas alterações do mesmo campo na mesma transação: nenhum evento perdido (4/4 e 2/2).
- Compatibilidade app/funções antigos com banco novo: executada, tudo OK após o grant em `private`.

Feito no front (não publicado): ajuste de batida interpreta o horário no fuso da empresa (`src/lib/company-time.ts`, testes unitários) em vez do fuso do navegador.

## 8. Integrações

- Outbox é infraestrutura preparada; nenhum módulo está integrado a ela.
- Liquidações salariais NÃO conectadas ao Asaas.
- Convergência das 3 portas salariais (`generate_salary_obligation`, `create_expense_launch` com salário, `oris360_resolver_banco_horas('PAGO')`) em um único comando: apenas especificada, não implementada. Critério: as três chamam uma função única que valida vínculo, competência e idempotência.
- Webhook Asaas: teste unitário do resultado existe (`asaas-webhook-outcome.test.ts`). Teste de integração com falha, repetição e recuperação NÃO executado (precisa de ambiente de homologação com a função publicada).

## 9. Lacunas (não executado)

1. Front dual-mode validado só por tipos e testes unitários; falta teste em navegador contra o banco com fase 1 e depois fase 2. Telas fora de Colaboradores/Vendas que leiam salário não foram encontradas na busca por colunas, mas a fase 2 deve ser homologada tela a tela.
2. (resolvido no código) fuso da empresa nos ajustes de ponto.
3. Testes de navegador e roteiro H01 a H19 (exigem homologação e dispositivo real).
4. Teste de integração do webhook Asaas.
5. Convergência das 3 portas salariais.
6. Verificação em produção de batidas eventualmente perdidas pelo defeito da seção 2.
7. Confirmação da integração GitHub do Supabase.
