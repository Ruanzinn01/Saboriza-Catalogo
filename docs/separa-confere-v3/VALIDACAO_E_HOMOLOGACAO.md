# Separa Confere V3 — validação, evidências e estado por camada

Data: 14/10/2026. Autor da validação: sessão de implementação do V3.

> **Não existe homologação real.** O projeto Supabase `saboriza` (`opeietrhbqlhrhljcdtx`) é o único e não tem branches. Os testes abaixo foram feitos **no banco de produção, dentro de transações que terminam em erro (rollback)**, com empresas, usuários e papéis sintéticos criados e desfeitos na própria transação. Isso valida políticas RLS e funções com o papel `authenticated` e `request.jwt.claims` iguais aos do PostgREST. **Não substitui** HTTP real com JWT real, navegador e aparelho.

## 1. Versionamento e publicação

| Item | Situação |
|---|---|
| Repositório | `https://github.com/Ruanzinn01/Saboriza-Catalogo` |
| Branch com o V3 isolado | `homolog/separa-confere-v3` (base `origin/main` = `d1d73de`, **local, não enviada**) |
| `main` local | 12 commits à frente de `origin/main` (inclui V3 `f0b25ed` e trabalho de outras frentes) |
| Revisão em produção (Vercel `saboriza-catalogo`) | `d1d73de`, deploy `dpl_5CsZZAwqN33VRpxNv1UzFw8FP3TS`, `READY`, `target=production`, branch `main` |
| **Push em `main` publica em produção?** | **Sim.** Os 5 últimos deploys de produção vieram de `main` pela integração Git da Vercel. O CI do GitHub (`.github/workflows/ci.yml`) só roda testes e build, não publica |
| Push em outra branch | Gera **preview** da Vercel. As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` existem **apenas para `production`**: o preview não tem backend configurado. Proteção SSO ativa (`all_except_custom_domains`) |

### Conteúdo do commit `f0b25ed` (31 arquivos)

Frontend: área do operador (`src/pages/operator/*`), `access-store`, `ProtectedRoute` com redirecionamento, `SeparationSections`, `SeparationShortagesReport`, `EstoqueInventarioHistorico`, `InventoryTab` com leitor, `lookupItemByCode` + testes, base de rotas (`separa-base`), `use-online`, ícones e manifest em `public/separa-confere/`.
Banco: **uma** migration, `20261014230000_separa_confere_v3.sql`.

### Migrations do V3 e reconciliação com o banco

| Versão no banco (`schema_migrations`) | Arquivo na branch | Conferência |
|---|---|---|
| `20261014150418 separa_confere_v3` | `supabase/migrations/20261014150418_separa_confere_v3.sql` | Hash MD5 do conteúdo sem espaços e **sem comentários** idêntico ao registrado no banco (`ac6310db…`, 11 891 caracteres). Diferença apenas: o arquivo tem comentários que não foram enviados ao aplicar |
| `20261014150436 separa_confere_v3_grant_operator_fn` | `supabase/migrations/20261014150436_separa_confere_v3_grant_operator_fn.sql` | **Estava só na sessão.** Arquivo criado agora; hash idêntico ao registrado (`82d67651…`) |

Nada foi reaplicado. O arquivo do commit `f0b25ed` se chamava `20261014230000_…`; a branch usa o nome da versão real, como já feito na reconciliação geral (`b1ae83c`).

## 2. Acesso real (resultados)

Cenário sintético: 2 empresas, papéis e usuários de teste, pedidos e produtos clonados. Tudo revertido (verificado: 15 colunas originais em `separation_shortages`, 42 políticas, 0 empresas/usuários/permissões de teste).

### 2.1 Modelo atual aplicado em produção (V3)

| Perfil | `restricted` | Observação |
|---|---|---|
| Operador (só `separa_confere.operar`) | true | Lê 0 `customers`, 0 `raw_materials`; 1 pedido da própria empresa, 0 da outra; `update` em pedido de outra empresa = 0 linhas; falta em item de outra empresa = "Item não encontrado" |
| **Gestor com `operar` + gerenciar inventário** | **true** | **Defeito.** Perde a leitura de `roles` (0 visíveis). Contraria a regra de que gestor/administrador não perdem acesso |
| Gestor sem `operar` | false | Sem mudança |
| Proprietário real | false | `customers=5`, `raw_materials=53` (teste anterior) |

### 2.2 Correção proposta (`supabase/pendentes/20261014221500_…acesso_hibrido_e_faltas.sql`)

Confinado = tem algum `*.operar`, **não** tem `admin.acessar` e **não** tem nenhuma outra permissão. Resultado no mesmo cenário: operador `true`, gestor+operar `false` (roles visíveis 4), gestor sem operar `false`, operar+`admin.acessar` `false`.
Sobreposição: a migration pendente da outra frente (`20261014180000_apps_operacionais_isolados.sql`) também redefine `is_restricted_operator`. **Só pode valer uma definição**; esta é a mais abrangente.

## 3. Dados expostos ao operador

Medido com o operador sintético (leitura direta pela API):

| Tabela | Colunas legíveis | Usadas na separação | Exposição desnecessária confirmada |
|---|---|---|---|
| `orders` | 44 | 13 | telefone, CNPJ, e-mail, endereço, valores, desconto, cupom, vendedor |
| `order_items` | 15 | 10 | preço unitário e total |
| `products` | 32 | 4 (`id`, `image_url`, `code`, `gtin`) | preço, custo médio, último custo, margem, fornecedor, estoque |
| `order_adjustment_requests` | 10 | 7 | — |

O frontend já seleciona colunas específicas em itens, produtos e ajustes, mas `orders` usa `select("*")` e **a API aceita qualquer coluna**: a restrição está só na tela.

**Proposta validada** (`supabase/pendentes/20261014223000_…dados_minimos.sql`): operador "só Separa" perde o acesso direto às 4 tabelas e usa funções `separation_snapshot`, `separation_accept_order`, `separation_release_order`, `separation_set_item`, `separation_request_adjustment`, `separation_resolve_adjustment`. Resultado pela API: leitura direta 0/0/0 linhas, `update` direto 0, `insert` direto negado por RLS; snapshot devolve **13/10/4** colunas e nenhum campo comercial; aceitar, marcar item, ajuste pendente que impede finalizar e finalização depois de resolver se comportam como hoje; outra empresa 0 pedidos e `set_item` falso; operador com `entrega.operar` e gestor mantêm acesso direto.
**Não aplicada**: exige trocar `separation-store.ts` para usar as funções. Efeito: o realtime de `orders` deixa de chegar ao operador confinado (usar polling). Ordem segura: homologação, frontend novo, depois banco.

## 4. Faltas e ajustes

- **Quem acessa a aba Faltas:** gestor e administrador (qualquer membro **não confinado**). A aba existe só em `/admin/separa-confere`; o shell do operador não tem. O operador também é barrado no servidor: lê 0 linhas de faltas e de eventos. O operador **registra** a falta (função), mas não a lê.
- **Idempotência** (migration pendente): mesmo comando repetido devolve a mesma falta (1 falta, 1 pedido de ajuste, 1 evento); mesmo conteúdo com outro comando também; mesmo comando com conteúdo diferente é recusado (`COMMAND_CONFLITO`).
- **Correção:** a mesma falta é atualizada (1 falta, 1 ajuste, 2 eventos), a mensagem do ajuste pendente acompanha, os valores anteriores ficam no evento `CORRECTED`.
- **Resolver o ajuste:** a situação passa a "Resolvida" (derivada); nova falta no mesmo item cria **nova ocorrência**, a antiga é encerrada com evento `RESOLVED` (3 eventos), 2 faltas e 2 ajustes no total.
- **Cancelar:** outro operador é recusado; o autor cancela, o ajuste pendente é encerrado, repetir o cancelamento não duplica evento; pela regra da função, gestor também pode cancelar (caminho não exercitado nos testes).
- **Histórico imutável:** `update` e `delete` em eventos são bloqueados por gatilho.
- **Estado em produção hoje:** a função aplicada é a versão sem comando idempotente. Repetir o registro **duplica** (o frontend em produção ainda nem expõe o botão). A correção está pendente de homologação.

## 5. Leitor (comportamento existente, sem ampliação)

- Dentro do pedido (`SeparaConfereOrderPage`): botão "Ler código" só para o responsável da separação; usa `BarcodeScannerModal` (`html5-qrcode`, câmera traseira), o mesmo componente de Carregamento e Produzir; compara o código lido com `code` ou `gtin` **exatos** dos itens do pedido; fora do pedido: "Produto não pertence a este pedido"; item encontrado abre a ficha, **não confirma** a separação.
- Inventário: botão "Ler código" só na aba Inventário com sessão aberta; busca por `gtin` ou SKU **dentro da sessão**, normalizando zeros à esquerda e caixa; ambíguo abre escolha; já contado avisa; leitor físico digita na busca e usa Enter. Não registra contagem.
- Não há leitor em Pendentes nem em Histórico.

## 6. Roteiro para aparelho real (HTTPS de homologação)

Pré-requisitos: ambiente de homologação com frontend em HTTPS, banco com as migrations e um papel de operador (somente `separa_confere.operar`).

1. Abrir `/operacao/separa-confere` no Android (Chrome) e no iPhone (Safari); entrar com a conta de teste; conferir que abre Pedidos e que a barra tem só Pedidos, Inventário e Histórico.
2. Digitar `/admin` e `/admin/estoque` na barra de endereço: deve voltar para a área do operador.
3. Android: menu do navegador, "Instalar app"/"Adicionar à tela inicial"; conferir nome "Separa Confere" e o ícone aprovado. iPhone: Compartilhar, "Adicionar à Tela de Início". Abrir pelo ícone: modo standalone, sem barra do navegador.
4. Pedidos: aceitar, abrir item, **Ler código** do pedido (permissão de câmera), ler um código do pedido e um de fora; registrar uma falta; repetir tocando duas vezes.
5. Inventário (com sessão aberta iniciada por gestor): **Ler código** (permitir e negar câmera), código da sessão, de fora, duplicado; digitar com leitor físico (Bluetooth/USB) na busca e Enter; contar um item, zero explícito, voltar à lista (filtro e rolagem preservados); recarregar a página.
6. Modo avião: aviso no topo, nada guardado; reconectar e repetir.
7. Fechar o leitor e verificar que a luz da câmera apaga.
8. Entrar como gestor na mesma URL: deve acessar também `/admin`.
Registrar vídeo ou captura de cada passo.

## 7. Estado por camada

| Camada | O que está nela |
|---|---|
| **Somente local** | Branch `homolog/separa-confere-v3` (rename, migration do grant, 2 migrations pendentes, front das faltas com fallback, esta documentação); `main` local com 12 commits à frente |
| **Versionado (remoto)** | Nada do V3. `origin/main` está em `d1d73de` |
| **Em homologação** | Nada. Não existe ambiente |
| **Em produção** | Banco: V3 (`150418`) + grant (`150436`). Frontend: `d1d73de`, **sem** o V3 de interface |

Defasagem conhecida: o banco já tem o V3 e o frontend publicado não. As telas novas só aparecem quando o frontend for publicado.

## 8. Pendências e bloqueios

1. Ambiente de homologação (Supabase branch ou projeto novo + variáveis `Preview` na Vercel apontando para ele). Branch Supabase: US$ 0,01344/hora, organização no plano free (pode exigir upgrade).
2. Decidir a regra única de `is_restricted_operator` entre as duas frentes.
3. Aplicar, em homologação, as 2 migrations pendentes e rodar o roteiro de acesso por HTTP real com JWT.
4. Refatorar `separation-store.ts` para as funções de dados mínimos e polling.
5. Central de PDFs: dependência indisponível, registrada.
6. Fora desta etapa: uso duplo de item, correção de compras, lote na separação.
