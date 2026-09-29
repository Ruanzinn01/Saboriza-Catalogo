# SABORIZA → ÓRIS360 · DIAGNÓSTICO DA TRANSFORMAÇÃO SAAS

**Versão 1.0 · Fase 1 (Inventário, Raio-X e Diagnóstico) · 2026-09-28**

Este documento é a **camada superior de consolidação** entre:

1. O pacote `ORIS360_PACOTE_MESTRE_PROGRAMADOR/` (21 módulos funcionais + arquitetura mestre Fase 2 + patch de implementação Fase 3/Onda 1), e
2. O código-fonte real do Saboriza (este repositório) e o documento operacional `SABORIZA_MODULOS (guia de fases).md`.

Ele **não substitui** nenhum dos dois. Os 21 pacotes originais e o guia de fases permanecem intactos como fontes. Este arquivo apenas organiza a comparação, os conflitos e a ordem de trabalho — seguindo a regra do próprio pacote mestre: *"não gerar ainda o pacote final, não implementar, não alterar banco, apenas entender, inventariar, comparar e diagnosticar."*

**Regra de parada desta fase:** ao final deste documento, aguardar aprovação de Ruan antes de abrir qualquer implementação. Nenhum código, migration ou PR foi criado a partir daqui.

---

## PARTE 0 · O QUE MUDOU DESDE O GUIA DE FASES ATUAL

O `SABORIZA_MODULOS (guia de fases).md` foi escrito quando o projeto ainda era "evolução de um catálogo para uma fábrica single-tenant". O pacote `ORIS360_PACOTE_MESTRE_PROGRAMADOR` chega depois e muda o destino final: **o sistema não termina na Fase 6 (emissão fiscal) — ele continua até virar uma plataforma SaaS multiempresa com 21 módulos**, dos quais o Saboriza é o primeiro tenant.

Isso não anula o guia de fases. As Fases 0 a 4 (fundação fiscal, insumos, produção, estoque, indicadores) continuam válidas como fundação operacional de uma empresa. O que muda é o que vem **depois**: em vez de só "Financeiro e Pagamentos" (Fase 5) e "Emissão Fiscal" (Fase 6), o roadmap real passa a ser a arquitetura Óris360 inteira, com a Fundação SaaS entrando **antes** de qualquer expansão de módulo novo.

**Divergência já encontrada e corrigida neste diagnóstico:** o guia de fases (linha ~211-222) descreve a stack como *"Next.js 14 com App Router + Tailwind/shadcn"*. Isso está **desatualizado frente ao código real**. Ver Parte 3.

---

## PARTE 1 · INVENTÁRIO DO PACOTE ÓRIS360

### 1.1 Estrutura recebida

```
ORIS360_PACOTE_MESTRE_PROGRAMADOR/
  00_LEIA_PRIMEIRO.txt
  01_MODULOS_21/                              → 21 módulos funcionais (specs + protótipos)
  02_MESTRES_ARQUITETURA_IMPLEMENTACAO/
    01_FASE2_ARQUITETURA_MESTRE/              → 25 documentos de arquitetura canônica (APROVADA)
    02_FASE3_ONDA1_FUNDACAO_SAAS_IAM/         → patch de código já preparado (NÃO aplicado)
  MANIFEST_PACOTE_MESTRE.json
```

Repositório-base declarado no pacote: `https://github.com/ugcbyaanacamargo-web/saboriza`. **Divergência**: o remote real deste repositório é `https://github.com/Ruanzinn01/Saboriza-Catalogo.git` — ver Parte 4.1.

### 1.2 Os 21 módulos — tabela-resumo

| # | Módulo | Versão | Objetivo | Depende de | Maturidade |
|---|---|---|---|---|---|
| 01 | Pulso360 | V2 | Dashboard de consolidação em tempo real | Pedidos, Produção, Tarefas, Entrega, Colaboradores | Especificação |
| 02 | Força de Vendas | Funcional V3 + Visual V7 | App de vendas em campo (local → ENVIAR ONLINE, missões, comissões) | Fundação Mestre, Cadastro Central, Separa Confere, Meu360 | ✅ Corrigido 2026-09-28 |
| 03 | Central Colaboradores | V4 | Cadastro laboral central por tenant | Ponto, Produção, Missões, Vendas, Folha | Especificação fechada |
| 04 | Faturar | V5 (substitui V4) | Análise de crédito + faturamento | Pedido, Integração Asaas, fiscal, Entrega | Especificação |
| 05 | Produziu Registra | V3 (substitui V2) | Registro de produção na fábrica | Fundação, Colaboradores, Estoque, Ficha Técnica | Especificação |
| 06 | **Fundação Mestre** | V2 | Arquitetura transversal (base de todos) | — (é a base) | Especificação |
| 07 | Central Gestão Produção | V1 | Camada gerencial da produção | Produziu Registra, Estoque, Urgentes | Aprovado (HTML) |
| 08 | Módulo Estoque | V1 | Controle físico/patrimonial de estoque | Produtos, Ficha Técnica, Separa Confere | Aprovado (HTML) |
| 09 | Aportes dos Sócios | s/n | Entrada de capital de sócio (não é receita) | Financeiro Geral, Despesas, Asaas | Especificação |
| 10 | Módulo Despesas | V3 | Obrigações econômicas + integração salarial | Colaboradores, Contas a Pagar, Asaas | Especificação |
| 11 | Receitas | s/n | Outras entradas econômicas | Financeiro Geral, Vendas, Aportes | Especificação |
| 12 | Financeiro Geral | s/n | Consolidação de leitura financeira | Asaas, Receitas, Despesas, Aportes | Especificação |
| 13 | Módulo Patrimônio | V2 | Bens físicos da empresa | Despesas/Investimentos, Financeiro | **Pendente harmonização** |
| 14 | Integração Mestre Asaas | consolidada | Camada única de integração externa | Pedidos, Despesas, Financeiro | Especificação |
| 15 | Fechamento Mensal | V2 | Virada automática de competência | Financeiro, DRE, Estoque, Patrimônio | **Pendente harmonização** |
| 16 | DRE Gerencial | V2 | Consolidação de resultado (não cria fatos) | Vendas, Receitas, Estoque, Despesas | Especificação |
| 17 | Central Geral Auditoria | V2 | Trilha de auditoria imutável transversal | Todos os módulos | **Pendente harmonização** |
| 18 | Painel do Proprietário | V2 | Camada executiva (6 indicadores vitais) | Financeiro, DRE, Patrimônio, Estoque | Especificação |
| 19 | Tarefas/Missões/Roteiros | V2 Visual Aprovado | Execução central de missões recorrentes | Colaboradores, Meu360, Força de Vendas | **Pendente harmonização** |
| 20 | Meu 360 | V2 | Portal pessoal do colaborador | Colaboradores, Ponto, Asaas | Especificação |
| 21 | Ponto Óris | V1 | Terminal + apuração + espelho de ponto | Colaboradores, Meu360, Gestão Salarial | **Pendente harmonização** |

**Observações transversais do inventário:**

- Nenhum dos 21 módulos cita o Saboriza ou as fases 0-6 do guia atual — são especificações do Óris360 como sistema novo, sem referência cruzada ao legado. A ponte entre os dois mundos é este documento.
- 5 módulos (13-Patrimônio, 15-Fechamento Mensal, 17-Auditoria, 19-Tarefas/Missões, 21-Ponto Óris) trazem a marca explícita *"aprovado no módulo, sujeito à harmonização global posterior"* — são os mais recentes e ainda não foram cruzados entre si nem com o resto.
- **Módulo 02 (Força de Vendas) — corrigido em 2026-09-28.** O pacote original não tinha PATCH_FINAL, checklist, rastreabilidade nem manifesto, e tinha inconsistência de versão (pasta V3_V7, PDF V3, HTML autodeclarado V4 no título mas nomeado V7 no arquivo). O cliente confirmou e reenviou o pacote completo: **autoridade de versão é Especificação Funcional V3 + Visual V7**; o "V4" era só um `<title>` interno desatualizado do HTML, sem terceira versão funcional. Pacote antigo preservado em `01_MODULOS_21/02_FORCA_DE_VENDAS_V3_V7__SUBSTITUIDO_2026-09-28/`; pacote novo já em `01_MODULOS_21/02_FORCA_DE_VENDAS_V3_V7/ORIS360_Forca_de_Vendas_V3_Visual_V7_Pacote_Final/`, no mesmo padrão dos outros 20 módulos. Confirma alinhamento com o resto do ecossistema: documento local nasce sem número, `ENVIAR ONLINE` é o único ponto de oficialização, baixa de estoque continua no Finalizar Conferência do Separa Confere (mesma regra decidida em 4.2), comissão só realiza por liquidação oficial.
- Regra "não inventar nomes físicos" é repetida em quase todos os módulos: os PDFs definem regra de negócio, não schema de banco — nomes de tabela ficam para a reconciliação com o repositório real (que é este próprio documento).
- Encadeamento financeiro é consistente entre os módulos 09, 10, 11, 12, 16, 15 e 18: um fato nasce uma vez no módulo dono; Financeiro Geral/DRE/Painel apenas leem; Aportes e Investimentos nunca entram no resultado operacional; Asaas nunca é chamado fora do módulo 14.
- Cadeia Colaboradores → Despesas → Ponto Óris → Meu 360 é citada de forma idêntica nos 4 módulos (exemplo do salário R$3.000/vale R$300/saldo R$2.700 aparece igual em dois pacotes independentes) — é decisão de negócio já estável, não ambígua.

### 1.3 Arquitetura Mestre Fase 2 (aprovada, 25 documentos)

Resumo dos pontos que **governam** todos os 21 módulos acima:

- **Estilo escolhido**: monólito modular SaaS sobre Supabase/Postgres (não microserviços agora — "distribuir cedo aumentaria risco").
- **Cinco planos do sistema**: Control Plane SaaS · Identity & Access · Domínios Operacionais · Domínio Financeiro · Intelligence/Experience (Pulso, Painel, Meu360).
- **Campo físico canônico de tenant**: `company_id`. `tenant_id` é só sinônimo conceitual — **nunca criar as duas colunas em paralelo**.
- **Hierarquia (corrigida em 2026-09-28)**: `Platform → Grupo Empresarial (opcional) → Company/Organização → Unit → Department/Team → Resources`. Correção de Ruan sobre a arquitetura mestre original: Grupo Empresarial é opcional (empresa funciona normal sem grupo), nunca dá acesso operacional automático a outra empresa do grupo — só habilita visão consolidada explicitamente autorizada (`group.dashboard.read`), com drill-down Grupo → Empresa → Unidade. Estrutura já implementada na Onda 1 (`business_groups`, `group_companies`, `group_memberships`, RBAC de grupo espelhando o de empresa) — ver `ONDA_1_APLICACAO.md`.
- **Entidades SaaS mínimas**: `companies`, `units`, `memberships`, `plans/plan_versions/subscriptions/entitlements`, `onboarding_checklists`.
- **User ≠ Membership ≠ Employee**: identidade de login, vínculo com empresa e identidade laboral são três coisas distintas — colaborador pode existir sem login.
- **Regra de ownership** (matriz completa na Parte 2): cada fato tem um único dono de escrita; todos os outros só leem.
- **Consistência transacional**: operação que mexe em dinheiro/estoque/status crítico é comando server-side atômico (nunca vários `update()` soltos do frontend torcendo pra todos darem certo).
- **Máquina de estados do Pedido redesenhada**: `NOVO → ORÇAMENTO → PEDIDO → FATURADO → FINALIZADO`, com **Separação como domínio próprio** (`NA_FILA → ACEITA → EM_SEPARACAO → AGUARDANDO_FATURAMENTO`) — o `COMPLETED` que hoje dispara baixa de estoque no Saboriza real **deixa de existir nesse formato** (ver conflito 4.2 abaixo).
- **Plano de ondas de implementação** (10 ondas, da Fundação SaaS até Pulso/Painel completo) — ver Parte 6.
- **Migração**: estratégia `Expand → Backfill → Verify → Controlled Cutover → Contract`, nunca big-bang, nunca deletar coluna antes de compatibilidade comprovada.
- **12 regras absolutas para quem for implementar** (`CONTRATO_PARA_IA_PROGRAMADORA.md`): não criar segunda fonte da verdade; não usar frontend como segurança; não escrever saldo de estoque diretamente; não chamar Asaas fora do Gateway Mestre; não usar `orders.COMPLETED` como separação/finalização no alvo; `company_id` é o único campo físico de tenant; não persistir segredo em código/log; não sobrescrever histórico confirmado (usar correção/estorno/versionamento); não liberar módulo sem teste de duas empresas; não aplicar migration destrutiva antes de reconciliar o banco real.

### 1.4 O que já foi preparado como código (Fase 3 / Onda 1) — e não foi aplicado

Existe um patch pronto em `02_MESTRES_ARQUITETURA_IMPLEMENTACAO/02_FASE3_ONDA1_FUNDACAO_SAAS_IAM/ORIS360_FASE3_ONDA1_PATCH/`, gerado contra o commit `e9d8181...` do repositório declarado. Ele é **estritamente aditivo** (expand-only):

- Cria as tabelas `companies`, `units`, `memberships`, `roles`, `permissions`, `role_permissions`, `membership_roles`, `membership_unit_scopes`, `plans`, `plan_versions`, `subscriptions`, `entitlements`, `onboarding_checklists`, `audit_events`, `transactional_outbox` — todas com `create table if not exists`, sem tocar nenhuma tabela legada.
- Cria um schema `private` (para funções `security definer` de RLS) e um bucket de storage privado `oris360-private`, com namespace por `company_id`.
- Toca só 2 arquivos existentes: `.env.example` (adiciona `VITE_ORIS360_SAAS_FOUNDATION_ENABLED=false`) e `src/components/admin/ProtectedRoute.tsx` (adiciona um gate condicional atrás dessa feature flag, **nascendo desligada**).
- Traz também `src/config/features.ts`, `src/modules/iam/permission-keys.ts`, `src/modules/saas/*` (store Zustand de Company/Unit), `src/shared/contracts/*` e o teste `supabase/tests/phase3_wave1_saas_rls.sql` (isolamento com duas empresas simuladas).
- **Nunca foi de fato aplicado**: `BASELINE.json` confirma `github_write_available: false`, `supabase_project_connected: false`, `vercel_project_connected: false` na sessão em que foi gerado. É um conjunto de arquivos prontos para copiar manualmente em branch separada.

Isso significa: **a Onda 1 do plano de implementação já está tecnicamente desenhada e pronta para revisão**, não precisa ser desenhada do zero — precisa ser conferida contra o estado real do repositório (que mudou desde então, ver Parte 4.1) e aplicada com cuidado.

---

## PARTE 2 · MAPA DE OWNERSHIP (FONTES DA VERDADE)

Direto da `MATRIZ_DE_DOMINIOS_E_OWNERSHIP.md` da Arquitetura Mestre — vale para todo o ecossistema, incluindo o Saboriza como primeiro tenant:

| Fato | Dono de escrita | Consumidores | Proibido escrever |
|---|---|---|---|
| Company/Unit | SaaS Control Plane | todos | módulos operacionais |
| Membership/Permission | IAM | todos | cada módulo criar perfil próprio |
| Employee/EmploymentLink | Colaboradores | Produção, Tarefas, Vendas, Entrega, Ponto | apps recriarem colaborador |
| Customer / Product | Cadastro Central | Comercial, Estoque, Produção | cópia paralela por app |
| Order | Pedidos | Separa, Faturar, Entrega, Financeiro | Separa criar segundo pedido |
| Separation | Separa Confere | Estoque, Faturar, Pulso | mudar pedido pra finalizado |
| StockMovement | Estoque | todos os relatórios | Faturar/Entrega alterar saldo |
| Production | Produziu Registra | Estoque, Gestão, Pulso | gestão inventar execução |
| Receivable | Financeiro/Faturamento | Asaas, Comissão, Painéis | app vendedor manter cópia |
| Asaas external state | Integração Mestre | Financeiro | chamadas diretas por módulos |
| Expense | Despesas | AP, Financeiro, DRE | pagamento criar 2ª despesa |
| Contribution (Aporte) | Aportes | Financeiro/Painel | contabilizar como receita |
| DRE Result | DRE | Painel/Fechamento | cada dashboard recalcular |
| AuditEvent | Auditoria | investigação | editar/deletar evento |

Este é exatamente o mesmo princípio já vigente no guia de fases atual (Parte I, item 2: *"cada dado tem um dono"*) — a Arquitetura Mestre apenas estende essa regra para 21 módulos e formaliza quem é dono de quê.

---

## PARTE 3 · RAIO-X DO CÓDIGO ATUAL (o que existe de verdade hoje)

### 3.1 Stack real (corrige o guia de fases)

O código real **não é Next.js**. É:

- **Vite 6 + React 18**, SPA sem SSR, roteamento client-side via `react-router-dom`.
- Sem `app/`, sem `middleware.ts`, sem API routes — não existe camada de backend própria.
- UI própria em `src/components/ui/` com Tailwind CSS 4 — **não usa shadcn/ui nem Radix** (zero ocorrência no `package.json`).
- Todo acesso a dado é client-side direto via `@supabase/supabase-js`, chamado de dentro de stores Zustand (`src/store/*.ts`, 22 arquivos) e `src/lib/*-api.ts`.
- Deploy Vercel como SPA estática (`vercel.json` com rewrite catch-all pra `index.html`).
- 31 páginas admin em `src/pages/admin/`, 69 componentes admin em `src/components/admin/`.

### 3.2 Banco de dados hoje

Não há pasta `supabase/migrations` local — o schema vive só no projeto Supabase remoto (`opeietrhbqlhrhljcdtx`, 62 migrations aplicadas remotamente). Tabelas principais e **nenhuma tem `company_id`/`tenant_id`**:

`categories`, `coupons`, `customers`, `suppliers`, `ibge_cities`, `products`, `product_recipe`, `raw_material_categories`, `raw_materials`, `raw_material_entries`, `production_records`, `production_consumptions`, `stock_movements`, `orders`, `order_items`, `order_adjustment_requests`, `order_deliveries`, `order_delivery_items`, `delivery_er_reservations`, `settings`.

- `settings` é uma **tabela singleton** (uma única linha com CNPJ/IE/regime tributário/WhatsApp da fábrica) — pressupõe explicitamente empresa única.
- `ibge_cities` é a única exceção correta: dado de referência público, deve continuar compartilhado entre empresas.
- **Não existem** tabelas de despesas, receitas, aportes, patrimônio, DRE, fechamento ou auditoria — Fase 5/6 do guia atual e boa parte dos módulos 09-18 do Óris360 ainda não têm base nenhuma no banco real.

### 3.3 Autenticação e autorização hoje

- Login via Supabase Auth nativo (email/senha), `src/store/admin-auth-store.ts`.
- Proteção de rota **100% client-side e binária**: `ProtectedRoute.tsx` só verifica `isAuthenticated`/`isLoading` — sem conceito de perfil/role.
- RLS está **ativado em todas as 19 tabelas**, mas o padrão dominante é `USING (true)` para `authenticated` — qualquer conta logada tem acesso irrestrito de leitura/escrita administrativa. `anon` só é restrito em `categories`/`coupons`/`products` (via `is_active`).
- Mutação de pedidos passa por RPCs `SECURITY DEFINER` (`create_order`, `update_order_items`), outras RPCs administrativas exigem `authenticated`.
- **Não existe tabela `roles` nem RLS por papel.** O `saboriza_role=admin` citado no patch da Onda 1 como algo "a preservar" **não foi encontrado em nenhum arquivo de `src/`** — se existir, vive só no `app_metadata` do Supabase Auth, fora do código versionado.

### 3.4 Zero infraestrutura multiempresa hoje

Busca completa por `company`, `tenant`, `empresa`, `saboriza_role` em `src/`:

- `tenant`: nenhuma ocorrência.
- `company`/`company_name`: só como razão social de cliente/fornecedor nas tabelas `customers`/`suppliers`/`orders` — não é conceito de tenant da plataforma.
- `empresa` (português): aparece em 9 arquivos, sempre no sentido de "razão social do cliente" ou "dados da fábrica em Configurações" — nunca no sentido de multiempresa.

**Conclusão: o código atual está em zero absoluto de SaaS.** Isso não é um problema — é exatamente o ponto de partida que a Fundação Mestre V2 e a Onda 1 do patch já esperam.

### 3.5 Módulos do admin: guia de fases x código real

| Fase do guia | Guia diz | Código real |
|---|---|---|
| 0 — Fiscal/Configurações | Concluída | Implementado (`SettingsPage.tsx`) |
| 1 — Matérias-primas | Concluída | Implementado |
| 2 — Produção | Concluída | Implementado |
| 3 — Estoque | Concluída | Implementado |
| 4 — Indicadores | Em validação | Parcial |
| 5 — Financeiro | Não iniciada | **Confirmado**: zero tabela, zero rota |
| 6 — Emissão fiscal (Asaas) | Não iniciada | **Confirmado**: zero menção a Asaas em todo o código |

Módulos existentes no código mas fora do vocabulário do guia: Pedidos, Clientes, Fornecedores, Categorias, Separa-Confere, Carrega-Entrega — todos já batem, em espírito, com conceitos que os módulos 04 (Faturar), 06 (Fundação), 08 (Estoque) do Óris360 tratam com mais rigor.

### 3.6 Integrações externas hoje

- **Asaas**: não existe (zero código, zero env var, zero migration).
- **WhatsApp**: ativo via link `wa.me` (não é API oficial), usado em checkout/pedido/confirmação.
- **Supabase Storage**: 3 buckets — `product-images`, `delivery-signatures`, `delivery-receipts`. O patch da Onda 1 adicionaria um 4º bucket privado por empresa (`oris360-private`).

---

## PARTE 4 · CONFLITOS E DIVERGÊNCIAS PARA DECISÃO DO PROPRIETÁRIO

Seguindo a regra do pacote mestre (*"nunca resolver silenciosamente"*), os pontos abaixo precisam de decisão explícita antes da implementação.

### 4.1 — Identidade do repositório — **DECIDIDO em 2026-09-28**

- ✅ **Decisão de Ruan**: `https://github.com/Ruanzinn01/Saboriza-Catalogo.git` é o repositório real de produção.
- `ugcbyaanacamargo-web/saboriza` (declarado no `BASELINE.json` do patch) não é o repositório correto.
- **Ação necessária antes de aplicar qualquer coisa da Onda 1**: regerar `BASELINE.json` contra o commit atual de `Ruanzinn01/Saboriza-Catalogo`. O conteúdo do único arquivo já tocado pelo patch (`ProtectedRoute.tsx`) continua compatível — só a identidade declarada do repositório precisa ser corrigida, o diff em si não muda.

### 4.2 — Regra de baixa de estoque: `COMPLETED` do pedido x `separation.finalized` — **DECIDIDO em 2026-09-28**

- **Guia de fases atual (Fase 3, já concluída e em produção)**: baixa de estoque acontece quando o pedido muda para `COMPLETED` (Finalizado) — decisão autorizada por Ruan em 2026-09-19, validada com pedido real.
- **Arquitetura Mestre Óris360 (ADR-005, ADR-006)**: baixa física deve ocorrer ao **finalizar a conferência no Separa Confere** — um domínio de Separação próprio, independente do status do Pedido.
- ✅ **Decisão de Ruan**: migrar para a regra do Óris360 — baixa passa a acontecer na finalização da Separação, não mais em `COMPLETED`.
- **Isso não muda nada agora.** É trabalho da **Onda 3** (Parte 6), depois que Fundação SaaS (Onda 1) e Cadastros (Onda 2) estiverem prontos. Continua exigindo plano de migração com dupla escrita/feature flag antes do cutover, porque redesenha a máquina de estados de Pedido inteira e mexe em código já em produção.

### 4.3 — Stack declarada x stack real (DECISÃO NECESSÁRIA: NÃO, só correção documental)

- O guia de fases descreve Next.js 14 + shadcn/ui; o código real é Vite + React Router + UI própria.
- Não é um conflito de arquitetura real (ninguém migrou stack) — é um erro de documentação que precisa ser corrigido para não induzir decisões erradas. Corrigido na Parte 5.

### 4.4 — `saboriza_role=admin` — **VERIFICADO em 2026-09-28 (via MCP Supabase, projeto `saboriza` / opeietrhbqlhrhljcdtx)**

- Consulta direta em `auth.users` (projeto real, ativo): **existem apenas 2 usuários** (`rruan012007@gmail.com` e `comerciodobem@gmail.com`), e nenhum dos dois tem qualquer role em `raw_app_meta_data` — só `{"provider":"email","providers":["email"]}`.
- ✅ **Confirmado: o claim `saboriza_role=admin` não existe em produção.** O patch da Onda 1 pressupunha esse claim para preservá-lo durante a migração de autorização — essa premissa cai.
- **Consequência prática**: o plano de migração de autorização da Fundação Mestre (módulo 06, Parte II) começa mais simples do que previsto — não existe nada legado pra migrar/desligar. Os 2 usuários atuais viram diretamente `User` + `Membership` de proprietário/admin na empresa Saboriza (empresa inicial), sem etapa de "ler claim antigo".

### 4.5 — Módulo Força de Vendas incompleto — **RESOLVIDO em 2026-09-28**

- O cliente (dono do pacote Óris360) confirmou a inconsistência apontada e reenviou o módulo 02 corrigido: `ORIS360_Forca_de_Vendas_V3_Visual_V7_Pacote_Final_CORRIGIDO`.
- ✅ **Autoridade de versão confirmada**: Especificação Funcional **V3** (`Especificacao_Mestre_Forca_de_Vendas_Oris360_V3.pdf`) + Referência Visual **V7** (`Oris360_Forca_de_Vendas_Visual_Aprovado_V7.html`). O "V4" era só um `<title>` interno desatualizado do HTML — corrigido nesta versão, sem alterar nenhuma regra, tela ou fluxo.
- Pacote agora tem o mesmo padrão dos outros 20 módulos: `00_LEIA_PRIMEIRO.md`, `VERSION_AUTHORITY.md`, `FORCA_VENDAS_PATCH_FINAL.md`, `FORCA_VENDAS_ACCEPTANCE_CHECKLIST.md`, `FORCA_VENDAS_SOURCE_TRACEABILITY.md`, `MANIFEST.json` (com SHA-256 de cada arquivo).
- **Substituição feita no repositório de documentação**: pacote antigo preservado em `01_MODULOS_21/02_FORCA_DE_VENDAS_V3_V7__SUBSTITUIDO_2026-09-28/` (não apagado, só movido); pacote novo em `01_MODULOS_21/02_FORCA_DE_VENDAS_V3_V7/ORIS360_Forca_de_Vendas_V3_Visual_V7_Pacote_Final/`.
- **Conteúdo funcional confirmado, coerente com o resto do ecossistema**: documento local (Orçamento/Pedido) nasce sem número e sem efeito em estoque/financeiro/comissão/separação/entrega; `ENVIAR ONLINE` é o único comando de oficialização, com revalidação server-side de autenticação/empresa/cliente/produtos/preço/estoque/idempotência; **baixa física de estoque continua acontecendo no Finalizar Conferência do Separa Confere** — mesma regra já decidida em 4.2, não em `COMPLETED` do pedido nem no envio do pedido; comissão nasce como potencial no pedido oficial, vira prevista no recebível, e só realiza (proporcionalmente) na liquidação oficial — nunca na criação do pedido.
- Novidade central da V3 em relação a versões anteriores: bloco "Comissões a receber" em Relatórios e Comissões (previsto, próximos 15 dias, atrasadas, filtros por período, liquidação parcial/total com atualização de agenda).
- **Módulo 02 volta ao roadmap normal**, na Onda 9 do plano de ondas (Parte 6), junto com Tarefas/Missões/Roteiros e o restante da Força de Vendas completa.

### 4.6 — Cinco módulos "pendentes de harmonização global" (LACUNA, não bloqueia a Fundação)

Patrimônio (13), Fechamento Mensal (15), Auditoria (17), Tarefas/Missões (19) e Ponto Óris (21) foram aprovados individualmente mas ainda não foram cruzados uns com os outros nem com o restante do pacote. Isso não impede começar a Fundação SaaS (Onda 1) nem Pedido/Separação/Estoque (Onda 3) — mas esses 5 módulos não devem ser implementados como estão sem essa reconciliação prévia.

---

## PARTE 5 · CORREÇÃO NECESSÁRIA NO GUIA DE FASES ATUAL

O arquivo `SABORIZA_MODULOS (guia de fases).md` continua sendo a fonte de verdade das Fases 0-4 (já concluídas e validadas em produção). Duas correções pontuais foram aplicadas nele nesta sessão, sem alterar nenhuma regra de negócio:

1. **Stack corrigida** (Parte IV): de "Next.js 14 com App Router / Tailwind e shadcn/ui" para o real "Vite 6 + React 18 (SPA) com React Router, Tailwind CSS 4 e componentes próprios".
2. **Nota adicionada ao final da Parte V** (antes da Fase 0) apontando para este documento como continuação do roadmap além da Fase 6, para quem abrir o arquivo sem saber da transformação SaaS.

Nenhum checkbox, nenhuma tarefa e nenhuma decisão de negócio das Fases 0-6 foi alterada.

---

## PARTE 6 · ORDEM PRELIMINAR DE IMPLEMENTAÇÃO (não iniciar sem aprovação)

Direto do `PLANO_DE_IMPLEMENTACAO_POR_ONDAS.md`, já cruzado com o estado real do código (Parte 3):

| Onda | Escopo | Situação hoje | Gate de saída |
|---|---|---|---|
| 0 | Reconciliação: conectar Supabase/Vercel reais, congelar baseline, backup testado | ✅ **Feito localmente em 2026-09-28** — falta só backup/restauração testado (não bloqueia Onda 1) | nenhuma divergência crítica desconhecida — cumprido |
| 1 | Fundação SaaS/IAM: Company/Unit/Membership/Roles/Entitlements, RLS multiempresa, audit/outbox | **Patch já escrito, não aplicado** (Parte 1.4) | teste de isolamento A/B 100% |
| 2 | Cadastros company-aware: Customers/Suppliers/Products, migração da Saboriza como empresa inicial | Não iniciada | sem vazamento, contagem reconciliada |
| 3 | Pedido + Separação + Estoque: nova máquina de status, `SeparationJob` próprio, baixa na conferência | Não iniciada — **depende da decisão 4.2** | nenhuma dupla baixa, retry idempotente |
| 4 | Colaboradores + Produção: Employee/EmploymentLink, Produziu Registra V3 | Produção já existe no legado (Fase 2 do guia) mas sem company/employee | produção atômica e rastreável |
| 5 | Finance Core + Asaas Gateway + Faturar V5 | Não iniciada (Fase 5 do guia também não) | webhook/retry sem duplicação |
| 6 | Entrega Registra | Fluxo Carrega-Entrega já existe no legado, sem evidências/assinatura formal | comprovante imutável |
| 7 | Despesas/Receitas/Aportes/Patrimônio | Não iniciada | reconciliação sem duplicidade econômica |
| 8 | Fechamento + DRE + Comissões | Não iniciada | números reconciliam por drill-down |
| 9 | Tarefas/Missões/Roteiros + Força de Vendas completa | Não iniciada — **módulo 02 pendente de esclarecimento** (4.5) | rascunho local nunca é fato oficial antes do envio |
| 10 | Pulso + Painel do Proprietário + SaaS Admin completo | Não iniciada | cada indicador rastreia sua origem |

**Leitura prática**: as Fases 0-4 do guia atual já cobriram, informalmente, parte do que as Ondas 3 e 4 pedem (produção, estoque). A Fundação SaaS (Onda 1) é o próximo passo real e **não depende de nenhuma decisão de negócio pendente** — só da reconciliação de ambiente (Onda 0) e da confirmação do repositório (4.1).

---

## PARTE 7 · LACUNAS PARA DECISÃO (não preenchidas por suposição)

| Lacuna | Tipo | Situação |
|---|---|---|
| Repositório/commit real de produção | Técnica | ✅ Resolvida — ver 4.1 |
| Regra de baixa de estoque (COMPLETED x Separação) | Funcional/negócio | ✅ Resolvida — ver 4.2 |
| Existência do claim `saboriza_role=admin` | Técnica | ✅ Resolvida (confirmado inexistente) — ver 4.4 |
| Especificação fechada do Força de Vendas | Documental | ✅ Resolvida — ver 4.5 |
| Harmonização de Patrimônio/Fechamento/Auditoria/Tarefas/Ponto entre si | Funcional | Ver 4.6 — não bloqueia Ondas 1-4 |
| Segmento comercial do Saboriza dentro do modelo multiempresa (Indústria/Fabricação é o mais claro, mas não foi confirmado como decisão formal) | SaaS | Não bloqueia Onda 1 |
| Política de planos/assinatura (o que a Saboriza paga, o que futuros tenants pagam) | SaaS/negócio | Não documentada em nenhum dos 21 módulos nem na Fundação — é do Control Plane SaaS, que só define a estrutura de tabelas (`plans`, `subscriptions`), não os valores |

---

## PARTE 8 · RELATÓRIO EXECUTIVO

1. **O que existe hoje**: um SPA Vite/React funcional, com Fases 0-4 do guia local (fiscal, insumos, produção, estoque, indicadores) implementadas e validadas em produção para uma única empresa. Zero infraestrutura multiempresa, zero tabela de RLS por identidade real (é `true/true`), zero integração Asaas.
2. **O que o Óris360 aprovado exige**: uma plataforma SaaS multiempresa com 21 módulos integrados por eventos e fontes da verdade únicas, arquitetura já fechada e aprovada (Fase 2), com plano de migração incremental (`expand → backfill → cutover`) sem big-bang.
3. **Quanto do código atual pode ser reaproveitado**: a maior parte. Produção, Estoque, Matérias-primas e Configurações têm regra de negócio madura e testada — a Arquitetura Mestre cita explicitamente `create_production` como "boa base conceitual". O trabalho é **adicionar** `company_id`/`unit_id` e as camadas de IAM/eventos por cima, não reescrever.
4. **Maiores diferenças**: (a) ausência total de tenant no schema; (b) autorização binária sem papéis; (c) regra de baixa de estoque presa ao status do Pedido em vez de um domínio de Separação próprio; (d) módulos financeiros inteiros (Despesas, Receitas, Aportes, DRE, Patrimônio, Fechamento) ainda não existem no banco real.
5. **Conflitos que precisam de decisão**: identidade do repositório (4.1), regra de baixa de estoque (4.2 — a mais sensível, porque já está em produção), existência do claim de admin legado (4.4), especificação incompleta do Força de Vendas (4.5).
6. **Maiores riscos**: aplicar o patch de Onda 1 contra um baseline de commit não confirmado; migrar a regra de baixa de estoque sem plano de dupla escrita/feature flag; tratar os 5 módulos "pendentes de harmonização" como prontos para implementar.
7. **Módulos realmente prontos para implementação**: 01 (Pulso360), 02 (Força de Vendas, corrigido em 2026-09-28), 03 (Colaboradores), 04 (Faturar), 05 (Produziu Registra), 06 (Fundação — é pré-requisito de tudo), 07 (Gestão Produção), 08 (Estoque), 09 (Aportes), 10 (Despesas), 11 (Receitas), 12 (Financeiro Geral), 14 (Asaas), 16 (DRE), 18 (Painel), 20 (Meu360) — todos com PDF, PATCH_FINAL, checklist e rastreabilidade completos.
8. **Módulos que dependem de infraestrutura anterior**: todos os 21 dependem da Fundação Mestre (06) e da Onda 1 (IAM/Company/Unit) antes de qualquer linha de código de negócio.
9. **Mudanças estruturais necessárias para SaaS**: adicionar `company_id`/`unit_id` em praticamente todo o schema atual (lista completa na Parte 3.2); substituir RLS `true/true` por policies reais baseadas em `auth.uid()` + membership; criar tabelas de IAM (já desenhadas no patch da Onda 1).
10. **Ordem preliminar de implementação**: Onda 0 (reconciliar ambiente) → Onda 1 (Fundação SaaS/IAM, patch já pronto) → Onda 2 (cadastros company-aware) → Onda 3 (Pedido/Separação/Estoque, com a decisão 4.2 resolvida) → Onda 4 em diante conforme Parte 6.
11. **Decisões que ainda precisam do proprietário**: as 5 listadas na Parte 4, com destaque para 4.1 e 4.2, que bloqueiam a Onda 0 e a Onda 3 respectivamente.
12. **A documentação é suficiente para avançar à Arquitetura Mestre?** A arquitetura transversal **já está fechada e aprovada** (Fase 2 completa, 25 documentos, sem lacuna bloqueadora). O que falta não é arquitetura — é (a) reconciliar o ambiente real (Onda 0), (b) resolver as 5 decisões da Parte 4, e (c) esclarecer/completar o módulo Força de Vendas antes de tocá-lo.

---

## PARTE 9 · REGRA DE PARADA

Este documento encerra a **Fase 1** (inventário, raio-X, diagnóstico). Conforme a regra do próprio pacote mestre:

> Não avançar automaticamente para implementação. Não modificar código de negócio. Não criar PR. Não aplicar migration. Não alterar banco.

A próxima etapa (**Fase 2 de implementação** — que na prática já está desenhada nos 25 documentos de arquitetura mestre, só falta ser autorizada a começar pela Onda 0) já teve as 4 decisões bloqueadoras resolvidas em 2026-09-28:

1. ✅ Repositório real confirmado: `Ruanzinn01/Saboriza-Catalogo` (4.1);
2. ✅ Migração da regra de baixa de estoque para a Separação, aprovada, execução na Onda 3 (4.2);
3. ✅ Claim `saboriza_role=admin` confirmado inexistente em produção via consulta direta ao Supabase Auth (4.4);
4. ✅ Módulo Força de Vendas (02) corrigido e reintegrado ao pacote — autoridade V3 funcional + V7 visual confirmada (4.5).

**Onda 0 executada em 2026-09-28** (só localmente, nenhum commit git): `BASELINE.json` regerado com repositório/commit reais; conteúdo dos 2 arquivos que o patch toca reconferido por git blob hash (idêntico); `npm run build` rodou limpo; snapshot do banco real tirado via Supabase MCP (62 migrations, 20 tabelas, volumes atuais, RLS `true/true` confirmado, 2 usuários sem role claim). Backup/restauração ainda não testado (requer painel do Supabase) — não bloqueia a Onda 1, que é 100% aditiva. Relatório completo em `ORIS360_FASE3_ONDA1_PATCH/ONDA_0_RECONCILIACAO.md`.

**Está pronto para a Onda 1** assim que Ruan der o aceite para aplicar o patch em branch separada. A única lacuna remanescente sem prazo definido é a harmonização global dos 5 módulos citados em 4.6 (Patrimônio, Fechamento Mensal, Auditoria, Tarefas/Missões, Ponto Óris), que não bloqueia a Onda 1.

---

**Fim do documento.**

Este arquivo é vivo: deve ser atualizado a cada onda concluída, sem apagar o histórico de decisões e conflitos já resolvidos.
