# Separa Confere V3 — validação, evidências e estado por camada

Atualizado em 14/10/2026. Documentos relacionados: `REGRA_UNICA_DE_ACESSO.md`, `AMBIENTE_DE_HOMOLOGACAO.md`.

> **Não existe homologação real.** Nenhuma verificação abaixo foi feita por HTTP real com JWT, nem em navegador ou aparelho. Ver seção 2.

## 1. Estado por camada (o que está onde)

| Camada | O que contém | Evidência |
|---|---|---|
| **Commit local** | Commit posterior ao `6e03072` na branch `homolog/separa-confere-v3`: regra única, faltas com ciclo de vida, dados mínimos e sinais de tempo real (SQL em `supabase/pendentes/`), `separation-store` adaptado, testes e esta documentação. **Não enviado** | `git log` da branch |
| **Commit enviado ao GitHub** | Branch `homolog/separa-confere-v3` em **`6e030720832d40c031e084eace1f009b1f8489c5`** (2 commits sobre `origin/main` = `d1d73de`). `main` remoto continua em `d1d73de` | `git ls-remote`: `refs/heads/homolog/separa-confere-v3 = 6e03072…`, `refs/heads/main = d1d73de…` |
| **Frontend publicado** | **Produção:** `d1d73de` (`dpl_5CsZZAwq…`, `READY`, `target=production`), sem as telas do V3. **Preview** da branch: `dpl_4Quji36y…`, `READY`, `target=null`, build concluído; sem variáveis do Supabase (existem só para Production), portanto não é uma homologação utilizável | Vercel |
| **Migrations aplicadas (produção)** | `20261014150418 separa_confere_v3` e `20261014150436 separa_confere_v3_grant_operator_fn`. Última registrada: `20261014174752` (185 no total) | `schema_migrations` |
| **Migrations só versionadas** | `supabase/pendentes/20261014221500_…faltas_ciclo_de_vida.sql`, `…223000_…dados_minimos_e_tempo_real.sql` (e a da outra frente `…180000_apps_operacionais_isolados.sql`). **Nenhuma aplicada em lugar algum** | arquivos |
| **CI do GitHub** | O workflow (`ci.yml`) dispara só em `push` para `main` e em PR para `main`. **O push da branch não gerou execução** (0 runs para `6e03072`). Equivalente executado localmente na branch: `tsc -b`, `vitest` (84 testes) e `npm run build` passaram; o build da Vercel do preview também concluiu | API do GitHub, Vercel |

O push da branch **não** publicou em produção, **não** aplicou migrations e **não** criou branch de banco (lista de branches vazia; última migration inalterada).

## 2. Classificação das evidências

| Tipo | O que foi feito |
|---|---|
| **Transações SQL com contexto simulado** | Todos os testes de acesso, dados mínimos, sinais e faltas (seção 4). Rodados no banco de produção, dentro de uma transação que termina em erro (rollback), com empresas, usuários, papéis e pedidos **sintéticos**, usando `SET LOCAL ROLE authenticated` e `request.jwt.claims` iguais aos do PostgREST. Validam RLS, funções e gatilhos. Verificado depois: 0 sobras (empresas, usuários, permissões de teste), 26 MB, 42 políticas, 15 colunas em `separation_shortages` |
| **Chamadas HTTP reais com JWT de operador** | **Nenhuma.** Bloqueio: não há ambiente de homologação nem conta de operador real; não criei usuários em produção |
| **Realtime real** | **Nenhum.** A entrega de eventos pelo servidor de Realtime não foi exercitada; só foram validados, em SQL, os gatilhos, o conteúdo dos sinais e a visibilidade por RLS |
| **Navegador e aparelho** | **Nenhum.** O roteiro está na seção 7 |
| **Testes automatizados** | `vitest`: 84 passando (inclui `lookupItemByCode` e `separation-snapshot`) |
| **Locks** | Os testes que criam gatilhos em `orders`, `order_items` e `order_adjustment_requests` seguram, durante a transação (segundos), o lock desses DDLs. Escritas simultâneas aguardariam, sem falhar |

## 3. Defeitos abertos

| ID | Prioridade | Descrição | Estado |
|---|---|---|---|
| **DEF-01** | **Alta** | **Falta de separação duplica em produção.** A função aplicada (`separation_report_shortage(uuid, int, text)`) não é idempotente: repetir o registro cria outra falta e outro pedido de ajuste. Hoje o frontend publicado não expõe o botão, mas a função é executável por qualquer membro autenticado pela API | **Aberto.** Correção pronta e testada em `…221500` (índice único de falta aberta por item, comando idempotente, gravação atômica). Aguarda aprovação para aplicar. Mitigação possível sem esperar: revogar `EXECUTE` da função até o frontend sair (também depende de aprovação) |
| DEF-02 | Alta | Migration de apps operacionais sem `GRANT EXECUTE` em `private.is_app_scope_allowed` (usada em políticas RESTRICTIVE): `authenticated` sem permissão, o que reproduziria o erro 42501 que a V3 teve | Aberto, na outra frente; ver `REGRA_UNICA_DE_ACESSO.md` |
| DEF-03 | Média | Operador confinado lê todas as colunas de `orders`, `order_items` e `products` (telefone, CNPJ, valores, custo, margem) | Aberto. Solução pronta (`…223000`), depende do frontend novo e da homologação |
| DEF-04 | Média | Duas definições concorrentes de `is_restricted_operator` | Reconciliação proposta, nada aplicado |
| DEF-05 | Baixa | Unidade e atribuição não aplicadas em `orders`/`order_items` | Aberto (já registrado pela outra frente). Para inventário a unidade foi validada |

## 4. Resultados (SQL simulado)

### 4.1 Regra única de acesso e isolamento
Matriz completa e precedências em `REGRA_UNICA_DE_ACESSO.md`. Medido: só Separa `restr=t apps={separa_confere}`; Separa+Entrega `apps={separa_confere,entrega}`; Separa + permissões auxiliares **continua confinado** e ainda pode gerenciar inventário; Separa + `admin.acessar` e gestor **não** confinados; só Entrega confinado ao Entrega. Empresa B não lê nem altera nada da A; escopo de unidade barra sessão de inventário de outra unidade.

### 4.2 Dados mínimos
`separation_snapshot` devolve **13 / 10 / 4** colunas (pedidos / itens / produtos), sem telefone, CNPJ, valores, preço, custo ou margem. Recusas: outra empresa, usuário só do Entrega e usuário sem vínculo. Escritas (aceitar, marcar item, ajuste, resolver, liberar) com paridade com o fluxo atual: ajuste pendente impede finalizar; outro operador não libera; gestor libera. Após a fase B, o operador "só Separa" lê 0 linhas de `orders`/`order_items`/`products`/`order_adjustment_requests` e `update` direto afeta 0; operador Separa+Entrega, administrador e gestor mantêm a leitura direta.

### 4.3 Tempo real sem campos restritos
Tabela `separation_signals` com apenas `order_id, company_id, status, responsible, separation_finished, version, updated_at`, mantida por gatilhos em `orders`, `order_items` e `order_adjustment_requests`. Operador do Separa lê os sinais da própria empresa, não os de outra empresa; usuário só do Entrega lê 0; escrita direta é negada; `version` incrementou a cada mudança (12 após o fluxo de teste). O frontend assina `separation_signals` (filtro por empresa) além do canal antigo de `orders`, agrupa eventos (250 ms) e relê pela função. **Polling não foi implementado como substituto**; o tempo real é o mecanismo principal. A entrega real dos eventos depende de homologação.

### 4.4 Faltas e ajustes (código final)
- **Repetir:** mesmo comando duas vezes → mesma falta, 1 falta, 1 ajuste.
- **Corrigir:** mesma falta atualizada (separadas 2 → 1), 1 ajuste, 2 eventos (`REPORTED`, `CORRECTED`).
- **Resolver o ajuste:** situação "Resolvida" para o gestor; nova falta no item abre **nova ocorrência**, a antiga fica `CLOSED` com evento `RESOLVED`; 2 ocorrências e 2 ajustes no total.
- **Cancelar por gestor:** situação "Cancelada" por `mgr@…`, 3 eventos, 0 ajustes pendentes; cancelar de novo não gera evento; nova falta depois do cancelamento abre ocorrência (2 no total, 1 aberta).
- **Cancelar por outro operador confinado:** recusado.
- **Acesso:** usuário só do Entrega e empresa B não registram (item "não encontrado"); operador do Separa lê 0 no relatório; gestor lê.
- **Atomicidade:** falha simulada logo depois do ajuste → 0 ajustes e 0 faltas gravados; nova tentativa → 1 ajuste e 1 falta.
- **Barreira do banco:** segunda falta aberta direta no mesmo item → `unique_violation`; comando repetido direto → `unique_violation`.
- **Simultaneidade:** duas chamadas para o mesmo item se enfileiram no bloqueio da linha do item (`FOR UPDATE`) e a segunda cai no caminho idempotente; o índice único é a segunda barreira. **Teste com duas conexões reais não foi feito** (exige ambiente com conexões independentes).
- **Quem acessa a aba Faltas:** gestor e administrador (não confinados). O operador registra, não lê.

## 5. Dados expostos hoje ao operador (medição)

| Tabela | Colunas legíveis | Usadas na separação |
|---|---|---|
| `orders` | 44 | 13 |
| `order_items` | 15 | 10 |
| `products` | 32 | 4 |
| `order_adjustment_requests` | 10 | 7 |

## 6. Leitor (comportamento existente, preservado)

- **Dentro do pedido** (`SeparaConfereOrderPage`): botão "Ler código" só para o responsável; `BarcodeScannerModal` (`html5-qrcode`, câmera traseira); casa `code` ou `gtin` **exatos** com os itens do pedido; fora do pedido: "Produto não pertence a este pedido"; item encontrado abre a ficha e **não confirma**. Não foi alterado.
- **Inventário:** botão "Ler código" só na aba Inventário com sessão aberta; busca por `gtin` ou SKU dentro da sessão (zeros à esquerda e caixa normalizados); ambíguo abre escolha; já contado avisa; leitor físico digita na busca com Enter. Não registra contagem. Sem leitor em Pendentes ou Histórico.

## 7. Roteiro para aparelho real (HTTPS de homologação)

Pré-requisitos: homologação com frontend em HTTPS, banco com as migrations e um papel de operador (somente `separa_confere.operar`).
1. Abrir `/operacao/separa-confere` no Android (Chrome) e no iPhone (Safari); entrar com a conta de teste; conferir Pedidos e a barra só com Pedidos, Inventário e Histórico.
2. Digitar `/admin` e `/admin/estoque`: deve voltar para a área do operador.
3. Android: "Instalar app"/"Adicionar à tela inicial". iPhone: Compartilhar, "Adicionar à Tela de Início". Conferir nome "Separa Confere" e ícone aprovado; abrir pelo ícone (standalone).
4. Pedidos: aceitar, abrir item, **Ler código** do pedido (permissão de câmera), um código do pedido e um de fora; registrar falta; tocar duas vezes no botão.
5. Inventário (sessão aberta por gestor): **Ler código** (permitir e negar câmera), código da sessão, de fora, duplicado; leitor físico na busca com Enter; contar, zero explícito, voltar à lista (filtro e rolagem), recarregar.
6. Modo avião: aviso no topo, nada guardado; reconectar.
7. Fechar o leitor: a luz da câmera apaga.
8. Entrar como gestor na mesma URL: acessa também `/admin`.
9. Tempo real: com dois aparelhos, criar/liberar/aceitar pedido em um e ver a fila do outro atualizar sem recarregar.
Registrar vídeo ou captura de cada passo.

## 8. Pendências e bloqueios

1. Ambiente de homologação (decisão e eventual custo: `AMBIENTE_DE_HOMOLOGACAO.md`).
2. Reconciliar as duas frentes antes de qualquer aplicação (`REGRA_UNICA_DE_ACESSO.md`).
3. Em homologação: aplicar na ordem documentada, rodar HTTP com JWT real, Realtime real, duas conexões simultâneas, navegador e aparelho.
4. Aprovação específica para: aplicar `…221500` (DEF-01), publicar o frontend e qualquer alteração no banco de produção.
5. Central de PDFs: dependência indisponível, registrada.
6. Fora desta etapa: uso duplo de item, correção de compras, lote na separação.

## 9. Resultados em homologação com HTTP real (2026-10-14)

Projeto Supabase Free `saboriza-homolog` (US$ 0), separado da produção. Login real no GoTrue, JWT real, PostgREST real, Realtime real (supabase-js). Esquema: réplica parcial das migrations de produção + V3 + núcleo dos apps operacionais + 221500 + 223000. Limites: módulos sem relação com Separa/Inventário omitidos e parte das políticas RLS ausente; não é fidelidade total.

**Antes da fase B (só funções, sem bloqueio no banco):** operador lê 43 colunas de `orders` e 19 produtos direto e altera `total_amount` (200, 1 linha). Confirma a exposição medida em produção. O canal Realtime antigo de `orders` entrega 43 colunas, incluindo telefone.

**Depois da fase B (políticas `*_no_separa_direct`):**
- Operador só-Separa: `orders` direto 0 linhas, `products` 0, PATCH de `total_amount` 0 linhas, canal antigo de `orders` sem eventos.
- Snapshot do operador: 13 colunas de pedido, 10 de item, 4 de produto, sem vazamento.
- Owner, gestor, multi-app e só-Entrega mantêm leitura direta. Só-Entrega é negado no snapshot ("Sem acesso a este app"); multi-app (Separa+Entrega) passa.
- Empresa B não vê nada da A (snapshot, faltas, Realtime).
- Realtime `separation_signals`: operador recebe evento só com `company_id, order_id, responsible, separation_finished, status, updated_at, version`; empresa B e só-Entrega recebem 0.
- Faltas por HTTP: 10 chamadas simultâneas com o mesmo comando geram 1 falta e 1 ajuste; comandos distintos deixam 1 aberta; conteúdos diferentes deixam 1 aberta com eventos CORRECTED; outro operador confinado não cancela; gestor cancela (CANCELLED, ajuste fechado, 3 eventos); cancelar de novo não duplica evento; nova falta após cancelar e após resolver cria nova ocorrência; operador não lê relatório nem eventos; empresa B não registra falta na A.

**Defeito novo (DEF-06):** `private.is_app_scope_allowed` sem `GRANT EXECUTE` para `authenticated` na migration dos apps operacionais gera 403 para owner, gestor e operador. Corrigido só na homologação; precisa entrar na migration deles antes de aplicar.

**DEF-01 em produção:** mitigado (execute revogado da `separation_report_shortage` antiga; migration `20261014230013`). Aplicar a 221500 depende de aprovação.

**Não validado:** navegador e aparelho real (preview sem backend), câmera/leitor, modo avião, inventário completo por HTTP, perfis híbridos com `admin.acessar` por HTTP (cobertos só por SQL simulado).

## 10. Inventário e perfis híbridos por HTTP real (homologação, 2026-10-14)

**Inventário (JWT real):** gestor cria sessão; operador não cria ("Sem permissão para gerenciar inventário"); operador lista 19 itens, inicia contagem (recebe só token, nome, apresentação, unidade, sem saldo), registra contagem (diferença calculada no servidor), repete o mesmo comando sem duplicar (`replayed: true`), reusar a fotografia com outro comando é negado; segundo operador no mesmo item é negado ("sendo contado por outro operador"); operador não lê resultados nem histórico; gestor lê resultados; empresa B não vê a sessão da A.

**DEF-07 (novo):** o inventário não respeitava o escopo de app: usuário confinado só ao Entrega listava os itens e emitia token de contagem. Corrigido em homologação e versionado em `supabase/pendentes/20261014224500_separa_confere_v3_inventario_escopo_de_app.sql` (helper `can_access_inventory_unit`, aplicado a begin_count, register_count, session_items e list_sessions). Depois da correção o usuário só-Entrega recebe "Sessão não encontrada"/"Item não encontrado". Não aplicado em produção.

**Perfis híbridos (trocando permissões do papel na homologação):**
| Papel | restrito | apps | leitura direta de pedidos | snapshot |
|---|---|---|---|---|
| Separa + Entrega + auxiliar (`iam.memberships.read`) | sim | separa, entrega | sim (precisa para Entrega) | sim |
| Separa + `estoque.inventario.gerenciar` | sim | separa | 0 linhas | sim; gerencia inventário |
| Separa + `admin.acessar` | não | separa, produção, entrega | sim | sim |
Permissão auxiliar não retira confinamento nem libera administração; `admin.acessar` explícito libera tudo. Papéis restaurados ao estado original depois do teste.

**Lacuna da réplica:** `raw_materials.gtin` ausente (existe em produção); adicionada só na homologação.
