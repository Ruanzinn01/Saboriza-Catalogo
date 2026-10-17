# Regra única de acesso dos apps operacionais

Escopo: Separa Confere, Produziu Registra e Entrega Registra. **Proposta para reconciliar duas frentes; nada foi aplicado.**

## 1. Regra funcional adotada (decisão do proprietário)

1. Usuário exclusivamente operacional fica nos apps autorizados.
2. Um usuário pode operar mais de um app.
3. Gestor ou administrador **com acesso administrativo explicitamente autorizado** usa os apps sem perder esse acesso.
4. Permissão auxiliar **não** retira o confinamento e **não** libera `/admin` por si só.
5. Empresa, unidade e operação autorizadas continuam sendo verificadas.

## 2. Definições existentes e decisão

| Frente | Definição de `private.is_restricted_operator` | Situação |
|---|---|---|
| Separa Confere V3 | tem `separa_confere.operar` | **Aplicada em produção** (`…150418` + grant `…150436`). Cobre só um app |
| Apps operacionais (`supabase/pendentes/20261014180000_apps_operacionais_isolados.sql`) | tem algum `*.operar` **e** não tem `admin.acessar` | Versionada, não aplicada |
| Proposta que fiz na validação (retirada) | `*.operar` e **nenhuma outra permissão** | **Retirada**: contraria a regra 4 (uma permissão auxiliar liberaria o painel) |

**Decisão proposta:** a definição da migration de apps operacionais é a base única: *confinado = algum `*.operar` e sem `admin.acessar`*. Ela generaliza a V3 (compatível: hoje nenhuma role tem `separa_confere.operar`) e atende as regras 1 a 4. A minha proposta anterior foi descartada **com justificativa registrada aqui**, não silenciosamente. O que o Separa Confere acrescenta (faltas, dados mínimos, sinais) **consome** essas funções e não redefine nenhuma.

## 3. Funções compartilhadas (uma implementação)

| Função | Origem | Uso |
|---|---|---|
| `private.operator_perm_keys(company)` | apps operacionais | lê as 4 chaves relevantes do usuário na empresa |
| `private.operator_apps(company)` | apps operacionais | lista de apps autorizados |
| `private.is_restricted_operator(company)` | apps operacionais | confinado ou não |
| `private.is_app_scope_allowed(...)`, `private.assert_app_access(app)` | apps operacionais | matriz por tabela e guarda de RPC |
| `public.my_app_access()` | apps operacionais | perfil lido pelo frontend |
| `private.can_use_app(company, app)` | **Separa Confere (arquivo 221500)**, proposto para entrar na base | variante **por empresa** da guarda: não restrito passa; restrito só no app que tem |
| `private.is_separa_only_operator(company)` | Separa Confere (arquivo 223000) | confinado com exatamente o app Separa (decide a fase B) |

`assert_app_access` usa a empresa padrão do usuário; `can_use_app` recebe a empresa da linha afetada, necessária porque o frontend trabalha com a empresa selecionada. Recomendo que a base adote `can_use_app` em vez de manter duas variantes.

## 4. Matriz de precedência

Avaliada nesta ordem; a primeira regra que decide encerra a avaliação.

| # | Condição | Resultado |
|---|---|---|
| 1 | Sem autenticação | Negado (28000) |
| 2 | Sem vínculo ativo e vigente com a empresa | Negado (a empresa "não existe" para o usuário) |
| 3 | Vínculo restrito a unidades e a unidade da operação fora do escopo | Negado nas operações por unidade (`can_access_unit`) |
| 4 | Tem `admin.acessar` | **Não confinado**: apps liberados e `/admin` liberado |
| 5 | Não tem nenhum `*.operar` | **Não confinado** (gestor/proprietário de hoje): apps e `/admin` liberados |
| 6 | Tem `*.operar` e não tem `admin.acessar` | **Confinado**: só os apps cujo `*.operar` possui; `/admin` negado; leitura direta limitada à matriz |
| 7 | Permissões auxiliares (ex.: `estoque.inventario.gerenciar`) | Valem **dentro** do app permitido; não alteram as regras 4 a 6 |

Como o acesso administrativo é concedido: `admin.acessar` é atribuído pelo administrador à role de quem opera apps e também administra. A migration **não altera nenhuma role**.

## 5. Matriz de perfis (resultado medido em transação simulada)

| Perfil (permissões) | Confinado | Apps | `/admin` | Gerenciar inventário | Papéis visíveis |
|---|---|---|---|---|---|
| Só `separa_confere.operar` | sim | separa | não | não | 0 |
| `separa_confere.operar` + `entrega.operar` | sim | separa, entrega | não | não | 0 |
| `separa_confere.operar` + auxiliares (`estoque.inventario.gerenciar`, `iam.memberships.read`) | **sim** | separa | **não** | **sim** (dentro do app) | 0 |
| `separa_confere.operar` + `admin.acessar` | não | 3 | sim | conforme permissão | todos |
| Gestor (sem `*.operar`) | não | 3 | sim | sim | todos |
| Só `entrega.operar` | sim | entrega | não | não | 0 |

Unidade: usuário com vínculo `UNIT_LIST` só na unidade 1 recebeu "Sessão não encontrada" ao ler sessão de inventário da unidade 2; usuário de escopo da empresa leu normalmente.

## 6. Pontos a corrigir na migration de apps operacionais antes de aplicar

1. **Falta `GRANT EXECUTE ... TO authenticated` em `private.is_app_scope_allowed`.** Ela é chamada dentro de políticas RESTRICTIVE; definida só com `REVOKE FROM public, anon`, o teste mostrou `has_function_privilege('authenticated', ...) = false`. Foi exatamente o erro `42501` que a V3 teve e que quebraria toda consulta às tabelas protegidas. (Para `is_restricted_operator` o grant já existe em produção e é preservado pelo `CREATE OR REPLACE`.)
2. Adotar `private.can_use_app(company, app)` (seção 3).
3. Unidade e atribuição **não** são aplicadas em `orders`/`order_items` (lacuna já registrada por aquela frente). Continua aberta.
4. Decidir `admin.acessar` para roles existentes (hoje nenhuma tem `*.operar`).

## 7. Como as duas frentes se encaixam

Ordem de aplicação (somente em homologação primeiro, depois produção com aprovação específica):
1. migration de apps operacionais, já com os ajustes da seção 6;
2. `20261014221500_separa_confere_v3_faltas_ciclo_de_vida.sql`;
3. `20261014223000_separa_confere_v3_dados_minimos_e_tempo_real.sql`, **fase A** (funções, sinais, gatilhos, publicação);
4. frontend com o `separation-store` adaptado publicado e validado;
5. **fase B** (bloqueio da leitura direta do operador "só Separa").

## Reconciliação (2026-10-14)

- Definição única de `private.is_restricted_operator`: a da migration `20261014180000_apps_operacionais_isolados.sql` (qualquer `*.operar` e sem `admin.acessar`). O Separa Confere V3 usa a mesma; `can_use_app` (221500) só acrescenta o app ao teste.
- Ordem de aplicação em produção: `180000` → `181000` (grants, DEF-06) → `221500` → `224500` (inventário, DEF-07) → `223000` fase A → frontend dos 3 apps → fase B.
- Nada da migration dos apps operacionais foi editado; a correção está em arquivo separado `20261014181000_apps_operacionais_reconciliacao_grants.sql`. Pendente de aprovação para aplicar.
