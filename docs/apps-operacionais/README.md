# Apps operacionais isolados: Produziu Registra, Entrega Registra e Separa Confere

> **Os novos apps NÃO devem ser considerados isolados.** A autorização no banco está **versionada e testada em ambiente isolado (banco reconstruído em memória)**. Nada foi aplicado em produção e **não existe homologação real**.

## 1. Onde está cada coisa

| Camada | O que existe | Onde |
|---|---|---|
| **Local, commitado** | Frontend dos 2 apps, hub de seleção, login por app, manifests, ícones, perfil por app, painel de papéis | `git log` (commits `feat(operacao)` e `feat(operacao-banco)`) |
| **Versionado, não aplicado** | Migration de permissões, matriz, guardas de RPC, políticas | `supabase/pendentes/20261014180000_apps_operacionais_isolados.sql` |
| **Testado em ambiente isolado** | Migration aplicada sobre o **schema reconstruído da produção** (185 migrations, equivalência por hash) | `supabase/pendentes/testes_apps_operacionais_replay.mjs`, `EVIDENCIA_REPLAY_SCHEMA_REAL.txt` |
| **Roteiro para homologação real** | SQL para rodar num projeto isolado, com 7 usuários | `supabase/pendentes/testes_homologacao.sql` |
| **Homologação real** | **Não existe.** Ver `docs/seguranca/DEVOLUTIVA_HOMOLOGACAO.md §4` (recomenda projeto Supabase separado) | |
| **Produção** | **Nada alterado.** Só leituras de catálogo | |

Frontend publicado em produção: `saboriza-catalogo`, commit `d1d73de`. O banco de produção já tem o V3, então banco e frontend publicado estão defasados entre si hoje.

## 2. Reconciliação do schema com o repositório

Resolvida pela outra frente de trabalho: `docs/seguranca/DEVOLUTIVA_HOMOLOGACAO.md §5` e `supabase/baseline/`. A trilha completa (185 migrations, incluindo as 4 tabelas de entrega, `carrega_entrega_schema` etc.) foi reconstruída a partir de `supabase_migrations.schema_migrations`, com hashes idênticos aos de produção em 12 categorias. **Todos os testes desta entrega rodam sobre essa trilha.**

Produção: projeto Supabase `saboriza` (`opeietrhbqlhrhljcdtx`), conector `p2-conecta`, sem branches. Repositório `Ruanzinn01/Saboriza-Catalogo`, `main`.

## 3. Defeitos meus que a validação pegou antes de produção

Cada rodada de teste achou um problema real na minha migration:

1. **Guarda quebrada para todos** (`42883`): `texto = ANY((select array))` compara texto com array. Teria travado as RPCs de produção e entrega até para admin.
2. **Regressão no Separa Confere**: um atalho liberava ao Separa as 11 tabelas de produção que o V3 bloqueia.
3. **Painel inteiro fora do ar** (`42501 permission denied for function is_app_scope_allowed`): faltava `GRANT EXECUTE` para `authenticated` na função usada pelas políticas. Sem isso, toda leitura das 23 tabelas cobertas falharia para **todos**, inclusive Proprietário. Só o schema real mostrou; o teste sintético tinha *default privileges* que escondiam. (O V3 precisou da mesma correção, na migration `20261014150436`.)
4. Desempenho: as políticas rodam por linha; consolidei 4 consultas de permissão em 1.

## 4. Resultado final (schema reconstruído)

**191 verificações OK, 0 falhas.** Detalhe em `EVIDENCIA_REPLAY_SCHEMA_REAL.txt`.

- **Regressão:** Separa Confere, gestor e Proprietário com visibilidade **idêntica antes e depois em 110 tabelas**. 0 políticas removidas, 11 alteradas (só `*_no_restricted_operator` das tabelas usadas pelos apps), 35 novas.
- **Por app:** Produziu, Entrega e quem tem os dois enxergam **só** as tabelas da matriz (mais `memberships` e `units`, que qualquer membro lê hoje). Todas as tabelas da matriz foram semeadas, então a prova é conclusiva.
- **Escritas diretas e RPCs:** conforme a matriz. Guarda presente em **todas as 17 sobrecargas** das 15 funções-alvo, dentro do corpo.
- **Perfis:** apps e acesso administrativo separados. Híbrido (`producao.operar` + `admin.acessar`) é tratado como administrador. Perfil legado inalterado.
- **Outra empresa:** nada da empresa A aparece para usuário da empresa B (tabelas e funções).
- **`anon`:** perde `EXECUTE` nas 4 RPCs alvo; `create_order` (catálogo público) continua aberta.
- **Convivência com o patch de Storage da outra frente** (aplicado depois desta migration): entrega grava e lê comprovantes da própria empresa; documentos de colaborador ficam fechados para os 3 apps confinados; Proprietário e híbrido leem.

**Limites:** não é o PostgREST, o Auth, o Storage nem as Edge Functions reais. Linhas de teste são geradas. 61 de 104 tabelas foram semeadas (todas as da matriz); nas demais a visibilidade é inconclusiva. Sobrecargas `create_production` de 2 e 3 argumentos são ambíguas com argumentos nulos e foram conferidas pela presença da guarda, não por chamada. **Não substitui a homologação.**

## 5. Achados de segurança em produção (leitura de catálogo, nada foi explorado)

1. **RPCs `SECURITY DEFINER` de produção e entrega sem checagem de permissão.** O V3 não as protege. *Coberto pela migration (guarda).*
2. **`anon` executa** `confirm_production_release`, `create_production` (2 sobrecargas), `reverse_production` e `update_order_items`, que não mostram checagem de autenticação no começo do corpo. **Não testei contra produção.** *Coberto pela migration (revoga `anon` e guarda).*
3. **RPCs administrativas abertas a qualquer membro** (inclusive operador confinado): `adjust_stock`, `create_stock_entry`, `confirm_raw_material_entry`, `reverse_raw_material_entry`. *Coberto pela migration (guarda `admin`).*
4. **`update_employee_salary` e `resolve_salary_base`** checam só "ser membro da empresa". *Tratado pela fase 2 de `seguranca_salario_pix_*.sql` (outra frente), por permissão; deixei de fora da minha migration para não colidir.*
5. **Storage sem escopo de empresa** nos 3 buckets. *Tratado por `seguranca_storage_multiempresa.sql` (outra frente); testei a convivência.* **Decisão pendente:** esse patch libera os comprovantes de entrega a **qualquer membro** da empresa, inclusive operador confinado do Separa e do Produziu. Se não for desejado, trocar a condição por `private.is_app_scope_allowed(o.company_id, 'orders', false, false)`.
6. **Funções da plataforma** (`create_platform_company`, `set_platform_company_status`...) têm `EXECUTE` para `anon`, mas exigem `platform_admins` por dentro (`auth.uid()` nulo cai em `not authorized`). Higiene de grant, não brecha provada. Não alterei.
7. **V3 é lista de bloqueio** (42 tabelas). Das 67 tabelas com `company_id` fora da lista, 54 exigem permissão na leitura, 12 liberam a qualquer membro, 1 não tem política. A migration fecha as 12 para os apps novos sem mexer no Separa. `production_route_stages` (sem `company_id`) é filtrada pela empresa da rota e não é bloqueada ao confinado (só nomes de etapa).

Os itens 1 a 3 existem **hoje**, independentemente dos apps novos.

## 6. `company_id` opcional em `order_adjustment_requests`

Conferido em produção: a coluna é `NOT NULL`, sem default. Um gatilho `BEFORE INSERT` (`order_adjustment_requests_set_company` → `private.set_company_from_order()`) a preenche a partir do pedido. O gerador de tipos vê `NOT NULL` sem default e marca `company_id` como **obrigatório** no `Insert`; o app nunca o envia. O ajuste manual só torna o campo opcional **no tipo**. Continua necessário enquanto o gatilho for o mecanismo (`order_deliveries` tem o mesmo padrão). **Não regenerei tipos nesta etapa** (o código novo usa `rpcUntyped`).

## 7. Etapa seguinte (Parciais, Histórico, progresso): mapeamento, sem implementar

| Necessidade | Existe? | Fonte |
|---|---|---|
| Entrega parcial | Sim | `order_deliveries.result = 'PARTIAL'`, `total_not_delivered`, `er_code` |
| Saldo por item | Sim | `order_delivery_items` (`packs_ordered`, `packs_not_delivered`, `reason`) |
| ER | Sim | `delivery_er_reservations`, `order_deliveries.er_code` |
| **OC (ocorrência)** | **Não encontrada** | nenhuma tabela com esse papel |
| **Status administrativo da parcial** | **Não encontrado** | só há `pending/resolved` em `order_adjustment_requests` (ajuste de pedido), que **não** substitui |
| **Saída (viagem)** | **Não encontrada** | `loading_jobs` é por pedido |

## 8. Lacunas antes de pedir ativação em produção

1. **Homologação real** (projeto Supabase separado, plano free segundo a outra frente). Exige que **você** crie o token e a senha do banco e os guarde em variável de ambiente; eu não tenho nem devo ter essas credenciais.
2. Rodar `testes_homologacao.sql` lá e anexar a saída.
3. **Unidade e atribuição não são aplicadas** (só empresa). O entregador vê todos os pedidos da empresa, não só os dele.
4. **Dispositivo real**: instalação, nome, ícone, maskable e abertura em Android e iOS **não foram testados**. Só gerei os ícones e conferi a prévia com máscara circular.
5. Varredura das demais RPCs executáveis por `authenticated` para confinados: fiz a das `SECURITY DEFINER` que não checam permissão (item 5.3); falta a das `SECURITY INVOKER`.
6. Nenhum usuário tem as permissões novas. **Conceder `producao.operar`, `entrega.operar` e `admin.acessar` é decisão de cada role.** A migration não altera nenhuma role.
7. Ordem de aplicação: respeitar a da outra frente (`correcoes_pre_homologacao`, fase 1, front dual-mode, fase 2, storage) e encaixar esta migration **antes** do patch de Storage, que usa `is_restricted_operator`.

## 9. Rollout sugerido (nada disso foi feito)

Homologação real, conferir evidências, janela e confirmação sua, aplicar em produção, publicar frontend, criar roles e usuários piloto, instalar em aparelho real, só então enviar links.
