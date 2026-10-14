# Apps operacionais isolados: Produziu Registra, Entrega Registra e Separa Confere

> **Os novos apps NÃO devem ser considerados isolados.** A autorização no banco está só **versionada e testada em memória com schema sintético**. Nada foi aplicado em produção e nada foi validado em homologação real, que **não existe** hoje.

## 1. Onde está cada coisa

| Camada | O que existe | Onde |
|---|---|---|
| **Local** | Frontend dos 2 apps, hub de seleção, login por app, manifests, ícones, perfil de acesso por app | árvore de trabalho / commit local |
| **Versionado, não aplicado** | Migration de permissões, matriz, guardas de RPC, políticas | `supabase/pendentes/20261014180000_apps_operacionais_isolados.sql` |
| **Testado em memória (PGlite, schema sintético)** | Migration + roteiro + regressão do Separa | `EVIDENCIA_PGLITE.txt`, `supabase/pendentes/harness-pglite.mjs` |
| **Homologação real** | **Não existe.** Projeto `saboriza` é o único ativo e não tem branch | — |
| **Produção** | **Nada alterado por mim.** Só leituras de catálogo | — |

Frontend publicado em produção: `saboriza-catalogo`, commit `d1d73de` (branch `main`, 14/10 00:51). O repositório local está bem à frente dele (inclui o Separa Confere V3). **O banco de produção já tem o V3** (`20261014150418 separa_confere_v3` e posteriores), então banco e frontend publicado já estão defasados entre si hoje.

## 2. Reconciliação do schema real com o repositório

- Projeto Supabase de produção: **`saboriza`** (`opeietrhbqlhrhljcdtx`, sa-east-1), acessível pelo conector `p2-conecta`. Sem branches.
- Repositório: `Ruanzinn01/Saboriza-Catalogo`, `main`.
- O repositório tem 22 migrations (a partir de `20261006`). O banco tem ~190, desde `20260909232045 001_initial_schema`. **As migrations anteriores a 06/10 não estão no repositório.**
- As 4 tabelas citadas no relatório (`order_deliveries`, `order_delivery_items`, `delivery_er_reservations`, `loading_jobs`) existem em produção. Os `CREATE TABLE` vêm das migrations `carrega_entrega_schema` (20260923171210) e `delivery_receipts_registro_entrega` (20260923194740), mais `phase3_wave*` (company_id, unidade). **Nenhuma está no repositório.**
- Consequência: **não dá para reconstruir o banco só com o repositório.** Recomendo exportar o histórico faltante (ou um dump de schema) antes de qualquer homologação por branch: um branch Supabase recria o banco a partir das migrations do repositório e vai falhar ou sair incompleto.

## 3. Achados de segurança (leitura de catálogo, nada foi explorado)

1. **RPCs de produção e entrega sem guarda.** `finalize_delivery`, `create_production_release`, `confirm_production_release`, `create_production` (3 sobrecargas), `reverse_production` e `floor_*` são `SECURITY DEFINER` e **não checam permissão nem operador restrito**. As políticas `restrictive` do V3 não as protegem. Um operador do Separa Confere conseguiria chamá-las direto pela API.
2. **`anon` executa 4 delas**: `confirm_production_release`, `create_production` (2 sobrecargas), `reverse_production`. `reverse_production` não mostra checagem de autenticação nos primeiros 700 caracteres do corpo. **Não testei contra produção.** Se for explorável, um chamador anônimo que conheça o UUID de uma produção poderia estorná-la.
3. **Storage sem escopo de empresa.** Buckets `delivery-receipts`, `delivery-signatures` e `employee-documents`: políticas só por `bucket_id`. Qualquer usuário autenticado de qualquer empresa lê comprovantes, assinaturas e documentos de colaboradores. Não corrigi: depende do padrão de caminho e da sua decisão.
4. **O V3 é lista de bloqueio**: 42 tabelas com política ativa (a lista tem 43 nomes; `production_route_stages` não tem `company_id` e ficou de fora, **não verifiquei como ela é protegida**). Das 67 tabelas com `company_id` fora da lista, 54 exigem permissão específica na leitura (financeiro, RH), **12 liberam leitura a qualquer membro** (orders, order_items, products, settings, stock_movements, etc.) e 1 (`transactional_outbox`) não tem política permissiva. A migration fecha as 12 para os apps novos sem mexer no Separa.
5. **RPCs fora do escopo dos 3 apps não foram auditadas uma a uma.** Falta varredura completa antes de dar o isolamento por encerrado.

Os itens 1 e 2 existem **hoje**, independentemente deste trabalho. Recomendo tratar com prioridade, separado da ativação dos apps.

## 4. O que a validação em memória encontrou e corrigiu

O harness reproduz o estado de produção lido (V3 real do repositório, RPCs sem guarda, grants para `anon`), aplica a migration e roda o roteiro. **Na primeira execução achou 2 defeitos meus**, ambos corrigidos:

1. A guarda comparava `texto = ANY((select array))` e estourava `42883` para **todos**, inclusive admin. Teria travado as RPCs de produção e entrega para a empresa inteira.
2. O atalho "tem `separa_confere.operar`" liberava também as 11 tabelas de produção que o V3 bloqueia ao Separa. Regressão de segurança.

Resultado final: **355 OK, 0 FALHOU**; escritas diretas e RPCs conforme a matriz; **Separa Confere, gestor e admin com visibilidade idêntica antes e depois em 55 tabelas**; `my_access_profile` legado inalterado; `anon` sem `EXECUTE`; 0 políticas removidas, 11 alteradas, 35 novas.

**Limites dessa evidência:** schema sintético, não o real. Corpos de RPC simulados (os reais podem ser `LANGUAGE sql` ou ter `begin` em outro ponto, e a migration aborta se não achar o ponto de inserção). Sem JWT real do Supabase. Sem Storage. **Não substitui a homologação.**

## 5. `company_id` opcional em `order_adjustment_requests`

Conferido em produção nesta sessão: a coluna é `NOT NULL`, sem default. Um gatilho `BEFORE INSERT` (`order_adjustment_requests_set_company` → `private.set_company_from_order()`) a preenche a partir do pedido. O gerador de tipos vê `NOT NULL` sem default e marca `company_id` como **obrigatório** no `Insert`. O app nunca envia esse campo, então o ajuste manual só torna o campo opcional **no tipo**, para o TypeScript compilar. Ele continua sendo necessário enquanto o gatilho for o mecanismo (`order_deliveries` tem o mesmo padrão e gatilho). **Não regenerei tipos nesta etapa** (o código novo usa `rpcUntyped`), então não houve reaplicação.

## 6. O que fica para a etapa seguinte (Parciais, Histórico, progresso)

Mapeamento do que existe hoje, **sem implementar**:

| Necessidade | Existe? | Fonte |
|---|---|---|
| Entrega parcial | Sim | `order_deliveries.result = 'PARTIAL'`, `total_not_delivered`, `er_code` |
| Saldo por item | Sim | `order_delivery_items` (`packs_ordered`, `packs_not_delivered`, `reason`, `value_not_delivered`) |
| ER | Sim | `delivery_er_reservations`, `order_deliveries.er_code` |
| **OC (ocorrência)** | **Não encontrada** | nenhuma tabela com esse papel |
| **Status administrativo da parcial** (pendente, complementada, encerrada) | **Não encontrado** | só existe `pending/resolved` em `order_adjustment_requests`, que é ajuste de pedido e **não deve** substituir |
| **Saída (viagem)** | **Não encontrada como entidade** | `loading_jobs` é por pedido |

Consequência: a aba Parciais pode listar parcial e saldo, mas **não consegue mostrar estado administrativo nem OC** sem decisão de modelo. Progresso por Saída depende de definir o que é uma Saída. Nada de migration para isso foi escrito.

## 7. Lacunas restantes antes de pedir ativação em produção

1. Homologação real (branch ou projeto isolado) com o histórico de migrations completo.
2. Rodar `supabase/pendentes/testes_homologacao.sql` com os 7 usuários e anexar a saída.
3. Confirmar que a injeção de guarda funciona nos corpos reais das 10 RPCs.
4. Varredura das demais RPCs executáveis por `authenticated`/`anon` para confinados.
5. Storage (item 3) e `anon` (item 2): decisão e correção.
6. **Unidade e atribuição não são aplicadas**: as políticas são só por empresa. O entregador vê todos os pedidos da empresa, não só os dele; `membership_unit_scopes` existe mas não está nessas tabelas.
7. **Dispositivo real**: instalação, nome, ícone, maskable e abertura em Android e iOS **não foram testados**. Só gerei os ícones e conferi a prévia com máscara circular.
8. Colocar o frontend no ar antes da migration é seguro (cai no perfil legado). Aplicar a migration antes do frontend também, porque `my_access_profile` não muda.
9. Nenhum usuário tem as permissões novas. **Conceder `producao.operar`, `entrega.operar` e `admin.acessar` é decisão de cada role.** A migration não altera nenhuma role.

## 8. Rollout sugerido (nada disso foi feito)

Homologação → conferir evidências → aplicar migration em produção com janela e confirmação sua → publicar frontend → criar roles e usuários piloto → instalar em aparelho real → só então enviar links.
