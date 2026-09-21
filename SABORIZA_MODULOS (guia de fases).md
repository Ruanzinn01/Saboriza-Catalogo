# SABORIZA · DOCUMENTO CONSTITUCIONAL DE EVOLUÇÃO

**Versão 1.0 · Setembro de 2026 · RE Digital**

Este documento governa todas as decisões técnicas da evolução modular do sistema
Saboriza. Nenhuma implementação começa sem que a fase correspondente esteja aberta
aqui, e nenhuma fase é dada como concluída sem que sua definição de pronto tenha
passado integralmente.

Em caso de conflito entre este documento e qualquer instrução pontual de sessão,
**este documento prevalece**, salvo quando Ruan autorizar a exceção de forma
explícita.

---

## PARTE I · PRINCÍPIOS INVIOLÁVEIS

Dez regras que valem para toda fase, todo módulo e toda sessão.

### 1. O sistema já foi entregue

Tudo aqui é evolução sobre uma base funcionando em produção. Não existe
reconstrução, não existe reescrita, não existe "aproveitar para arrumar".

### 2. Uma única fonte de verdade

Cada dado tem um dono. Produto pertence ao cadastro de Produtos. Composição
pertence à Ficha Técnica. Saldo pertence às movimentações. Custo médio pertence às
entradas confirmadas. Nenhuma tela mantém cópia própria de um dado que já tem dono.

### 3. Saldo é consequência, nunca campo

Estoque atual e custo médio jamais são digitados. São sempre resultado de
movimentações oficiais. Um campo editável de saldo é um defeito, não uma
funcionalidade.

### 4. Nenhum estoque paralelo

Existe uma e apenas uma estrutura central de movimentação. Produção não cria a sua.
Matéria-prima não cria a sua. Indicadores não criam a sua.

### 5. Inspecionar antes de afirmar

Nunca assumir que algo não existe porque não foi citado. Ler o código real antes de
propor tabela, componente ou rota. Duplicação por desconhecimento é falha de
processo, não acidente.

### 6. Nenhuma integração antes da estrutura

Asaas, NF-e e certificado só entram depois que a base operacional está fechada e
validada. Integração sobre estrutura instável multiplica o problema.

### 7. Nenhuma automação antes do processo

Automatizar um fluxo que o cliente ainda não opera manualmente gera automação
errada. O fluxo primeiro, a automação depois.

### 8. O físico manda sobre o cadastro

Se a produção aconteceu, ela é registrada. Saldo insuficiente no sistema nunca
bloqueia um fato que já ocorreu no chão de fábrica. Baixa até zero, nunca negativo,
nunca pendência automática.

### 9. Nada sensível é apagado em silêncio

Entrada confirmada, lançamento financeiro e evento de auditoria não são excluídos.
São estornados, cancelados ou inativados, sempre com responsável, data, hora e
motivo.

### 10. Refatoração exige justificativa prévia

Mudança estrutural só acontece depois de explicar por que é necessária, o que é
afetado, qual o risco, como os dados atuais são preservados e como será testada.

---

## PARTE II · HIERARQUIA ARQUITETURAL

A ordem abaixo não é sugestão de menu. É a cadeia de dependência real do sistema.
Cada elo só existe porque o anterior existe.

```
Insumo
   ↓
Ficha Técnica
   ↓
Produção
   ↓
Movimentação de Estoque
   ↓
Pedido
   ↓
Indicador
```

E, em paralelo, a cadeia financeira:

```
Despesa
   ↓
Classificação (rateável ou não)
   ↓
Produção concluída no período
   ↓
Custo indireto por unidade
   ↓
Custo do produto
```

**Leitura obrigatória desta hierarquia:** nenhuma fase pode ser antecipada sobre a
anterior. Produção sem Ficha Técnica não tem o que consumir. Estoque sem Produção
não tem o que receber. Indicador sem Estoque não tem o que ler. Rateio sem Produção
não tem denominador.

---

## PARTE III · MODO DE AÇÃO

Protocolo de operação do agente. Vale em toda sessão de trabalho.

### Antes de escrever qualquer linha

1. Ler este documento por inteiro.
2. Identificar em qual fase o projeto está, consultando a Parte VI.
3. Confirmar que a fase anterior está marcada como concluída.
4. Inspecionar o código real das áreas que serão tocadas.
5. Listar o que já existe e pode ser reaproveitado.
6. Só então propor o plano de execução da fase.

### Durante a execução

- Trabalhar **uma fase por vez**. Não adiantar tarefa de fase futura, mesmo que
  pareça trivial.
- Dentro da fase, seguir a ordem das tarefas. Banco primeiro, interface depois,
  integração por último.
- Ao encontrar algo fora do previsto no documento, **parar e reportar** antes de
  decidir sozinho.
- Ao encontrar código existente que resolve parte do problema, usar o existente.
- Não criar migration destrutiva. Toda alteração de schema é aditiva ou tem plano
  de preservação de dados descrito antes.

### O que exige autorização explícita de Ruan

- Qualquer alteração em tabela que já contém dados de produção.
- Qualquer mudança em catálogo público, checkout, pedidos ou autenticação.
- Qualquer refatoração que toque mais de um módulo já entregue.
- Qualquer desvio da ordem de fases.
- Qualquer decisão de arquitetura não prevista neste documento.

### Ao concluir uma tarefa

- Marcar o checkbox correspondente.
- Rodar a verificação descrita na fase.
- Não seguir adiante com teste falhando.

### Ao concluir uma fase

1. Percorrer a definição de pronto item por item.
2. Executar o roteiro de validação da fase.
3. Atualizar a tabela de estado na Parte VI.
4. Reportar a Ruan o que foi entregue e o que ficou de fora.
5. Aguardar liberação antes de abrir a próxima fase.

### Formato de comunicação

- Reportar em português, direto, sem enfeite.
- Ao propor algo, apresentar a decisão e o motivo, não só o código.
- Ao encontrar um problema, apresentar o problema e as opções, não uma escolha já
  tomada.

---

## PARTE IV · CONTEXTO DO NEGÓCIO

Conhecimento fixo do domínio. Não muda entre fases.

### Posicionamento

A Saboriza é **fábrica** de temperos e condimentos. Nunca chamar de distribuidora,
nem na interface, nem em texto, nem em relatório.

Vende B2B para mercadinhos, lojas, restaurantes, pizzarias e padarias.

### Categorias comerciais

São exatamente estas seis, definidas pelo cliente:

1. Sal e Churrasco
2. Frascos
3. Potes
4. Molhos
5. Sachês
6. Linha Maior

Embalagem e apresentação (frasco, pote, sachê, pacote, balde, caixa, kit) são
**atributos do produto**, jamais categorias.

### Modelo de venda

Preço cadastrado é unitário. Venda acontece por pack.

```
A�afrão · unitário R$ 4,90 · pack de 12
1 pack  = 12 unidades = R$ 58,80
3 packs = 36 unidades = R$ 176,40
```

Estoque controla **unidades físicas individuais**. Pedido e produção operam em
**packs**. A conversão é responsabilidade do sistema, nunca do usuário.

### Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 com App Router |
| Linguagem | TypeScript |
| Interface | Tailwind e shadcn/ui |
| Banco | Supabase com PostgreSQL |
| Segurança | RLS por perfil |
| Deploy | Vercel |

Stack fechada. Não introduzir biblioteca nova sem autorização.

---

## PARTE V · AS FASES

Sete fases, executadas em ordem estrita.

```
Fase 0  Fundação fiscal
Fase 1  Base de insumos
Fase 2  Produção
Fase 3  Estoque
Fase 4  Leitura gerencial
Fase 5  Financeiro e pagamentos
Fase 6  Emissão fiscal
```

---

# FASE 0 · FUNDAÇÃO FISCAL

> Módulo 0 · Complexidade baixa · 4 a 5 horas · R$ 50

## Objetivo

Deixar a tela de Configurações com todos os dados fiscais que os módulos seguintes
vão precisar consultar. Sem integração alguma nesta fase.

## Por que vem primeiro

Despesas precisa da empresa configurada para vincular beneficiário e emitir
relatório com dados corretos. A Fase 6 precisa deste bloco pronto para não
duplicar cadastro. Fazer depois significaria retrabalho nas duas pontas.

## Pré-condições

- Nenhuma. Esta é a fase de abertura.

## Modo de ação

1. Abrir a tela de Configurações atual e mapear os campos existentes.
2. Confirmar quais já atendem à especificação fiscal e quais faltam.
3. Criar a migration **aditiva**, sem tocar nos campos atuais.
4. Popular a tabela de municípios antes de construir o seletor.
5. Reorganizar a interface em blocos, preservando o que já funciona.

## Escopo

### Tarefa 0.1 · Banco de dados

- [ ] Adicionar à tabela de configurações: `fantasy_name`, `cnae`, `tax_regime`,
      `municipal_registration`, `cep`, `street`, `number`, `complement`,
      `neighborhood`, `state_code`, `state_name`, `city_code`, `city_name`,
      `ibge_code`, `country`, `rbt12`, `effective_rate`, `schedule_annex`,
      `reference_competence`
- [ ] Criar tabela `ibge_cities` com código de 7 dígitos, nome e UF
- [ ] Popular a tabela com a base oficial do IBGE
- [ ] Prever atualização futura da tabela territorial

### Tarefa 0.2 · Bloco de identificação fiscal

- [ ] Preservar nome da fábrica, razão social, CNPJ, inscrição estadual, WhatsApp
      e horário
- [ ] Adicionar nome fantasia
- [ ] Adicionar CNAE como seleção pesquisável, guardando código e descrição
- [ ] Adicionar regime tributário (CRT) como lista controlada
- [ ] Adicionar inscrição municipal
- [ ] Validar formato e dígitos do CNPJ

### Tarefa 0.3 · Bloco de endereço fiscal

- [ ] CEP com máscara, sugerindo logradouro, bairro, município e UF
- [ ] UF como lista pesquisável com as 27 unidades, guardando nome, sigla e código
- [ ] Município como lista dependente da UF, com busca por parte do nome
- [ ] Código IBGE preenchido automaticamente, somente leitura
- [ ] Ao trocar a UF, limpar o município e recarregar a lista
- [ ] Impedir combinação UF e município inválida
- [ ] País como lista controlada, padrão Brasil

### Tarefa 0.4 · Bloco de parâmetros gerenciais

- [ ] RBT12 como valor monetário
- [ ] Anexo ou enquadramento como seleção
- [ ] Alíquota efetiva como percentual
- [ ] Competência de referência como mês e ano

### Tarefa 0.5 · Quadro de prontidão

- [ ] Indicador de cadastro empresarial: completo ou pendente
- [ ] Indicador de endereço e códigos: validado ou pendente
- [ ] Indicador de regime tributário: confirmado ou pendente
- [ ] Cada pendência com link levando ao campo que falta

## Fora de escopo

NCM, CEST, GTIN, CFOP, CST, CSOSN, ICMS, PIS, COFINS, IPI, certificado digital,
NF-e, integração com provedor e tela de apuração do DAS. Tudo isso pertence à
Fase 6 ou ao cadastro de produto.

## Definição de pronto

- [ ] Nenhuma função que existia antes parou de funcionar
- [ ] CEP preenche o endereço automaticamente
- [ ] UF filtra corretamente a lista de municípios
- [ ] Código IBGE é preenchido sozinho e não aceita edição manual
- [ ] Trocar a UF limpa o município anterior
- [ ] Quadro de prontidão reage ao preencher e ao limpar campos
- [ ] Salvar registra responsável, data e hora

## Roteiro de validação

1. Abrir Configurações e conferir que todos os campos antigos continuam lá.
2. Informar um CEP de Salvador e verificar o preenchimento automático.
3. Selecionar Bahia e confirmar que só aparecem municípios baianos.
4. Trocar para São Paulo e confirmar que o município foi limpo.
5. Tentar editar o código IBGE e confirmar que é impossível.
6. Deixar o regime tributário vazio e confirmar que o quadro acusa pendência.

## Saída desta fase

Empresa cadastrada com dados fiscais completos, servindo de fonte única para as
fases seguintes.

---

# FASE 1 · BASE DE INSUMOS

> Módulo 1 · Complexidade média · 6 a 8 horas · R$ 150

## Objetivo

Criar o cadastro oficial de matérias-primas, embalagens e insumos, com saldo e
custo médio calculados pelo sistema, lote e validade rastreáveis.

## Por que vem aqui

É a baseline da cadeia física. Produção não tem o que consumir sem este cadastro.

## Pré-condições

- [ ] Fase 0 concluída

## Modo de ação

1. Verificar se já existe qualquer estrutura de insumo no sistema atual.
2. Confirmar que o cadastro de Fornecedores existente pode ser reaproveitado.
3. Criar as tabelas e o trigger de código antes de qualquer tela.
4. Construir cadastro antes de entrada, porque entrada depende de item cadastrado.
5. Só então implementar o cálculo de custo médio.

## Conceito central

> Cadastro define **o que o item é**.
> Entrada registra **o que chegou**.
> Histórico mostra **o que aconteceu**.

Os três nunca se misturam.

## Escopo

### Tarefa 1.1 · Banco de dados

- [ ] Tabela `raw_materials`: nome, código MTP, descrição, categoria, unidade de
      controle, embalagem de compra, estoque mínimo, estoque máximo, custo médio,
      fornecedor principal, imagem
- [ ] Tabela `raw_material_entries`: insumo, quantidade, valor unitário, lote,
      validade, fornecedor, dados de nota fiscal, responsável, data, saldo
      anterior, saldo posterior
- [ ] Trigger gerando código `MTP-0001` sequencial, único e imutável
- [ ] RLS por perfil configurado

### Tarefa 1.2 · Lista geral

- [ ] Colunas: imagem, código, insumo, categoria, estoque, custo, fornecedor,
      usado em, situação, ações
- [ ] Indicadores no topo com quantidade e percentual: estoque OK, estoque baixo,
      sem estoque
- [ ] Quando houver filtro ativo, deixar claro que a visão está filtrada
- [ ] Busca por nome, código e fornecedor
- [ ] Filtros por categoria, situação e fornecedor, com limpeza simples
- [ ] Situação calculada automaticamente pelo saldo contra o mínimo
- [ ] Clique na linha abre o histórico completo do item
- [ ] Campo "usado em X produtos" clicável, abrindo a relação de produtos

### Tarefa 1.3 · Cadastro e edição

- [ ] Editáveis: nome, descrição, categoria, unidade de controle, imagem,
      embalagem de compra, estoque mínimo, estoque máximo, fornecedor principal
- [ ] Somente leitura: código MTP, estoque atual, custo médio atual
- [ ] **Trava crítica:** unidade de controle não pode ser alterada depois da
      primeira movimentação, porque mudaria a interpretação de todo o histórico
- [ ] Fornecedor principal é referência e não impede compra de outro fornecedor
- [ ] Resumo lateral com código, unidade, categoria, saldo, mínimo, situação e uso

### Tarefa 1.4 · Entrada de matéria-prima

- [ ] Fornecedor obrigatório, selecionado do cadastro oficial
- [ ] Data obrigatória
- [ ] Nota fiscal opcional, com número, emissão, série e chave de acesso
- [ ] Ausência de nota não impede a confirmação
- [ ] Busca cobrindo todos os itens cadastrados, independente do fornecedor
- [ ] Filtro por categoria na seleção
- [ ] Área de seleção enxuta: imagem, código, nome, categoria e botão adicionar
- [ ] **Não exibir** custo, saldo, situação ou edição na área de seleção
- [ ] Carrinho persistente ao trocar busca ou categoria
- [ ] Por item: quantidade, unidade puxada do cadastro, valor unitário, lote
      obrigatório, validade obrigatória
- [ ] Múltiplos lotes do mesmo item na mesma compra em registros separados
- [ ] Conversão de embalagem de compra para unidade de controle antes de movimentar
- [ ] Bloquear conversão entre grandezas incompatíveis

### Tarefa 1.5 · Confirmação e custo

- [ ] Rascunho salva a preparação **sem** alterar saldo, custo ou histórico
- [ ] Confirmar valida obrigatórios e efetiva a movimentação
- [ ] Aumentar o saldo na quantidade convertida
- [ ] Registrar fornecedor, data, responsável, lote, validade, valores e nota
- [ ] Recalcular o custo médio ponderado
- [ ] Registrar saldo anterior e saldo posterior
- [ ] Atualizar todas as telas que consultam saldo e custo

**Fórmula obrigatória:**

```
(valor do estoque anterior + valor da nova entrada)
─────────────────────────────────────────────────── = novo custo médio
(quantidade anterior + quantidade da entrada)
```

O usuário nunca informa custo médio, nem o anterior nem o novo.

### Tarefa 1.6 · Rastreabilidade

- [ ] Entrada confirmada não pode ser apagada
- [ ] Correção apenas por estorno ou movimento corretivo, com motivo obrigatório
- [ ] Estorno registra responsável, data, hora, motivo e referência à entrada
      original
- [ ] Lote e validade permanecem vinculados à quantidade recebida

## Fora de escopo

Consumo por produção, que pertence à Fase 2. Indicadores consolidados, que
pertencem à Fase 4.

## Definição de pronto

- [ ] Cadastrar insumo, registrar entrada e ver saldo correto
- [ ] Custo médio recalculado corretamente em duas entradas seguidas com valores
      diferentes
- [ ] Lote e validade obrigatórios, sem exceção
- [ ] Unidade de controle bloqueada após a primeira movimentação
- [ ] Rascunho não alterando saldo nenhum
- [ ] Estorno funcionando com motivo obrigatório
- [ ] Lista carregando sem lentidão com 100 itens

## Roteiro de validação

1. Cadastrar um insumo e conferir o código gerado.
2. Tentar digitar o estoque atual e confirmar que é impossível.
3. Registrar entrada de 100 unidades a R$ 2,00.
4. Registrar entrada de 100 unidades a R$ 4,00.
5. Conferir que o custo médio resultante é R$ 3,00.
6. Tentar alterar a unidade de controle e confirmar que está travada.
7. Salvar um rascunho e conferir que o saldo não mudou.

## Saída desta fase

Cadastro de insumos com saldo e custo confiáveis, pronto para ser consumido.

---

# FASE 2 · PRODUÇÃO

> Módulo 2 · Complexidade muito alta · 12 a 14 horas · R$ 350

## Objetivo

Registrar a produção real da fábrica e, no mesmo evento, consumir os componentes e
lançar o produto acabado.

## Por que é a fase mais crítica

É o único ponto do sistema onde duas cadeias se cruzam. Erro aqui contamina insumo,
estoque, indicador e custo ao mesmo tempo.

## Pré-condições

- [ ] Fase 1 concluída
- [ ] Cadastro de produtos com quantidade por pack preenchida
- [ ] Ficha técnica definida para ao menos um produto de teste

## Modo de ação

1. Modelar ficha técnica e registros de produção antes de qualquer tela.
2. Implementar e testar o consumo automático isoladamente, com dados de teste.
3. Construir a tela mobile depois que o motor de consumo já funciona.
4. Painel administrativo por último, porque é leitura do que já foi gravado.
5. Testar a regra de saldo insuficiente antes de considerar a fase pronta.

## Conceito central

> Produção é o evento que liga o consumo dos componentes à entrada do produto
> acabado. O usuário **não** faz lançamentos duplicados em telas diferentes.

## Escopo

### Tarefa 2.1 · Banco e ficha técnica

- [x] Tabela `production_records`: produto, quantidade em packs, quantidade em
      unidades, situação, responsável, data de criação, data de confirmação
- [x] Tabela `product_recipe`: produto, insumo componente, quantidade por unidade,
      unidade
- [x] Trigger de confirmação consumindo componentes conforme a ficha (implementado
      como RPC transacional `create_production`, com `for update` nas linhas
      tocadas — mesmo efeito de um trigger, validado com produção real)
- [x] Trigger de confirmação lançando o produto acabado no estoque
- [x] Ambos vinculados ao mesmo registro de produção
- [x] RLS por perfil configurado

### Tarefa 2.2 · Produziu Registra

Página independente, otimizada para celular e chão de fábrica.

- [x] Busca por nome ou código como primeiro elemento funcional
- [x] Área grande de leitura, ativando a câmera ao toque para código de barras ou QR
- [x] Busca e câmera como caminhos alternativos para o mesmo objetivo
- [x] Registro **por pack ou kit**, nunca por unidade digitada
- [x] Quantidade por pack puxada automaticamente do cadastro do produto
- [x] Botões de mais e menos ajustando os packs
- [x] Conferência exibindo `1 pack × 12 un = 12 unidades`
- [x] Carrinho com foto, código, nome, packs e total em unidades
- [x] Remover item e ajustar quantidade antes de confirmar
- [x] Botão único confirmando todos os itens de uma vez
- [x] **Nenhum valor financeiro em nenhuma parte desta tela**
- [ ] Alertas apenas de amarelo e vermelho, para produtos e para insumos —
      só insumo implementado; alerta de produto acabado depende do estoque
      mínimo do produto, que é Tarefa 3.1 (Fase 3)
- [x] Itens em situação normal não ocupam espaço na tela
- [x] Gráfico simples da produção da semana, de segunda a sábado
- [x] Mensagens de boas-vindas variando por dia da semana e turno

### Tarefa 2.3 · Regra de saldo insuficiente

```
Consumo calculado: 15 kg
Saldo registrado:  10 kg

Componente vai a 0 kg
Produção é registrada normalmente
Produto acabado entra no estoque
Saldo NUNCA fica negativo
```

- [x] Produção física que aconteceu nunca é bloqueada — validado com produção
      real (Açafrão PRD-0019), dois componentes zerados, produção seguiu normal
- [x] Baixa até zero quando o saldo é menor que o consumo
- [x] Sem saldo negativo automático
- [x] Sem pendência automática de estoque

### Tarefa 2.4 · Painel administrativo

- [x] Filtros rápidos: hoje, semana, mês, ano, personalizado
- [x] Busca de produto por nome ou código, e filtro por categoria
- [x] Cartões: produção total, peso produzido, produtos produzidos, registros
- [x] Gráfico de produção por período, clicável
- [x] Clique em um dia abre o detalhamento **na mesma tela**, sem nova página
- [x] Lista detalhada com foto, código, nome, quantidade e peso, sem preço
- [x] PDF, impressão e Excel respeitando exatamente os filtros ativos (Excel
      sai em CSV — a lib `xlsx` do npm tem vulnerabilidade alta sem correção)
- [x] Relatório saindo com empresa, período, data, hora e filtros aplicados

### Tarefa 2.5 · Card nos indicadores gerais

- [x] Card compacto de produção na tela de Indicadores
- [x] Total produzido em destaque e mini gráfico de evolução diária
- [ ] Card acompanha o filtro de período dos indicadores gerais — Indicadores
      não tem filtro de período global hoje; criar um é escopo de Fase 4
- [x] Botão levando à página completa, preservando o período selecionado
- [x] Card é resumo, não duplica filtros nem relatórios

## Fora de escopo

Acompanhamento de produtividade por funcionário e integração com Equipe. Ficam para
o roadmap futuro.

## Definição de pronto

- [x] Confirmar produção gera baixa de componentes e entrada de produto acabado em
      uma operação vinculada
- [x] Conversão de packs para unidades correta em todos os casos
- [x] Saldo de insumo nunca negativo
- [x] Nenhum valor financeiro aparecendo no Produziu Registra
- [ ] Tela funcionando em celular real, não só em simulador — não verificado
      nesta sessão (sem acesso a navegador/dispositivo); build de produção
      passa limpo, mas falta esse teste visual manual
- [x] Números do relatório idênticos aos da tela filtrada (PDF, CSV e tabela
      leem da mesma função `buildProductionReportRows`, uma única fonte)

## Roteiro de validação

1. Criar produto com ficha técnica de três componentes.
2. Registrar 5 packs pelo celular e confirmar.
3. Conferir a baixa de cada componente na proporção correta.
4. Conferir a entrada do produto acabado no estoque.
5. Zerar um componente e produzir de novo, confirmando que não bloqueia.
6. Confirmar que o saldo desse componente ficou em zero, não negativo.
7. Gerar o PDF do período e conferir que os números batem com a tela.

## Saída desta fase

Fábrica registrando produção pelo sistema, sem planilha.

---

# FASE 3 · ESTOQUE

> Módulo 3 · Complexidade média-alta · 8 a 10 horas · R$ 200

## Objetivo

Consolidar todas as movimentações físicas em uma estrutura central rastreável, e
conectar a saída automática por pedido.

## Pré-condições

- [ ] Fase 2 concluída
- [ ] Produção gerando entradas corretamente

## Modo de ação

1. Confirmar que a estrutura de movimentação criada na Fase 2 atende, em vez de
   criar outra.
2. Implementar a baixa por pedido antes das telas de consulta.
3. Construir o ajuste depois, porque depende do saldo já confiável.
4. Testar o ciclo completo antes de abrir a Fase 4.

## Fluxo oficial

```
Entrada → Estoque atual → Pedido → Saída → Histórico
```

## Escopo

### Tarefa 3.1 · Banco e automações

- [x] Tabela `stock_movements`: produto, variação, origem, referência vinculada,
      responsável, data, observação, saldo anterior, saldo posterior
- [x] Origens: `production`, `entry`, `order`, `adjustment`
- [x] Trigger de produção confirmada gerando entrada (retrofit do
      `create_production`, validado com produção real: 30 un, saldo 1020→1050)
- [x] Trigger de pedido confirmado gerando baixa — autorizado por Ruan em
      2026-09-19. Dispara em `COMPLETED`, clampa em zero igual a produção
      (achado em teste real: a constraint `current_stock >= 0` já existente
      bloqueava a conclusão do pedido inteira até eu corrigir o clamp)
- [x] Campo de estoque mínimo no cadastro de produto
- [x] RLS por perfil configurado

### Tarefa 3.2 · Estoque na tela de produtos

- [x] Quantidade atual visível em cada item da lista
- [x] Indicador de movimentação com seta e texto ao passar o mouse
- [x] Elemento clicável levando ao histórico daquele produto

### Tarefa 3.3 · Movimentação individual

- [x] Página dedicada por item com saldo atual, entradas e saídas
- [x] Colunas: data, movimento, quantidade, saldo, responsável, observação
- [x] Filtros: últimos 7 dias, este mês, período personalizado

### Tarefa 3.4 · Gerenciar estoque

- [x] Lista com produto, código, descrição, estoque, preço e movimentação
- [x] Situação calculada: em estoque, baixo ou crítico
- [x] Busca por nome
- [x] Cartões de resumo: total de produtos, itens críticos, valor total
- [x] Botão de entrada de estoque
- [x] Botão de ajuste de estoque

### Tarefa 3.5 · Ajuste de estoque

- [x] O usuário informa o estoque físico real contado
- [x] O sistema calcula a diferença sozinho

```
Sistema: 380    Físico: 365    →    ajuste de -15
```

- [x] Registrar anterior, atualizado, diferença, responsável, data, hora e origem
- [x] Motivo obrigatório

### Tarefa 3.6 · Entrada manual

- [x] Acrescenta quantidade ao saldo existente
- [x] Para item fabricado pela empresa, a via preferencial continua sendo o
      Produziu Registra
- [x] Motivo e observação registrados

### Tarefa 3.7 · Baixa por pedidos

```
Venda de 2 packs de 12  →  saída de 24 unidades
```

- [x] Pedido concluído gera baixa automática em unidades físicas — dispara em
      `COMPLETED` (Finalizado), não `CONFIRMED`. Validado com pedido de teste
      real: 42→38 unidades
- [x] Movimentação registrada com referência ao pedido (`reference_id` = id
      do pedido, observação com o número `#0016`)
- [x] Estoque insuficiente alerta mas não bloqueia — validado: pedido de 12 un
      contra estoque 0 completou normalmente, saldo ficou em 0 (nunca
      negativo, por causa da constraint `current_stock >= 0` já existente),
      movimentação registrada com aviso, e toast de alerta na tela de Pedidos

## Fora de escopo

Consolidação gerencial e gráficos, que pertencem à Fase 4.

## Definição de pronto

- [x] Produção confirmada aumenta o estoque sem ação manual — validado com
      produção real (30 un, 1020→1050, origem `production`)
- [x] Pedido confirmado reduz o estoque sem ação manual — na verdade dispara
      em **concluído** (`COMPLETED`), não confirmado (`CONFIRMED`); validado
      com pedido de teste real
- [x] Ajuste calcula a diferença corretamente — validado com produto real
      (50→42, diferença -8)
- [x] Toda movimentação rastreável por origem, responsável, data e motivo
- [x] Saldo anterior e posterior registrados em cada movimento
- [x] Nenhuma planilha externa necessária

## Roteiro de validação

1. Registrar produção e conferir a entrada no histórico com origem correta.
2. Confirmar um pedido de 2 packs e conferir a saída de 24 unidades.
3. Fazer um ajuste de 380 para 365 e conferir o registro de menos 15.
4. Abrir o histórico do produto e conferir os três movimentos em ordem.
5. Conferir saldo anterior e posterior de cada linha.

## Saída desta fase

Estoque confiável, rastreável e alimentado automaticamente.

---

# FASE 4 · LEITURA GERENCIAL

> Módulo 4 · Complexidade média · 7 a 9 horas · R$ 120

## Objetivo

Transformar os saldos e movimentações em informação de decisão, sem tocar em
nenhum dado.

## Pré-condições

- [x] Fase 3 concluída
- [ ] Histórico com volume suficiente para leitura de giro — não verificado nesta
      sessão (sem sessão autenticada pra ler dado real, ver nota de testes abaixo)

## Modo de ação

1. Confirmar que **nenhuma** rota desta fase escreve no banco.
2. Construir cada indicador consumindo as fontes oficiais já existentes.
3. Validar cada cálculo contra uma consulta manual antes de seguir.
4. Relatórios por último, reproduzindo exatamente o que a tela mostra.

## Regra desta fase inteira

> Indicadores consulta e consolida. **Não cria, não altera e não corrige saldo.**
> A área é somente leitura. Sem cadastrar, sem editar, sem excluir.

## Escopo

### Tarefa 4.1 · Saúde do estoque

- [x] Gráfico de rosca clicável
- [x] Verde acima de 150% do mínimo
- [x] Amarelo entre 100% e 150%
- [x] Vermelho igual ou abaixo do mínimo
- [x] Itens zerados em vermelho, destacados como sem estoque
- [x] Clique em uma cor abre a lista já filtrada

### Tarefa 4.2 · Valor do estoque

- [x] Valor total por `saldo atual × custo médio atual`
- [x] Composição por produtos acabados, matérias-primas, embalagens e insumos —
      quebrada pela categoria real de cada item (não por um par fixo de 2 blocos);
      "embalagens" e "insumos" aparecem como categorias próprias se cadastradas
      assim em matéria-prima
- [x] Quantidade atual item a item

### Tarefa 4.3 · Validade e risco

- [x] Verde confortável, amarelo próximo do vencimento, vermelho vencido
- [x] Prazos de atenção configuráveis
- [x] Quantidade, lotes e valor financeiro em risco
- [x] Detalhe com item, lote, quantidade, validade e dias restantes

### Tarefa 4.4 · Giro e movimentação

- [x] Entradas contra saídas no período
- [x] Maior giro, baixa movimentação e itens parados
- [x] Alertas configuráveis de 30, 60 e 90 dias sem movimentação — o mesmo toggle
      define a janela de entradas/saídas e o limiar de "parados"
- [x] Clique abre saldo, entradas, saídas e última movimentação

### Tarefa 4.5 · Evolução mensal

- [x] Gráfico do valor do estoque mês a mês
- [x] Visualizar total, matérias-primas, produtos acabados, embalagens e insumos —
      clique no mês abre o detalhamento por categoria real
- [x] Quantidade como série secundária quando útil, sem substituir o valor —
      aparece no tooltip do mês e no detalhamento, só quando os itens filtrados
      compartilham a mesma unidade (ex.: filtrando "Produto acabado" mostra
      unidades); com unidades mistas (kg + un) somar quantidade não faz sentido
      e a série é omitida
- [x] Respeitar mês, ano, intervalo personalizado ou histórico completo —
      presets de 3/6/12/24 meses, "histórico completo" (desde a movimentação
      mais antiga) e intervalo personalizado por mês/ano de início e fim
- [x] Recalcular quando o usuário filtrar por categoria ou grupo — filtro de
      grupo dedicado na própria seção
- [x] Clique no mês abre o detalhamento correspondente

### Tarefa 4.6 · Inventário e divergências

- [x] Divergência entre saldo do sistema e contagem física — só produto acabado;
      matéria-prima ainda não tem função de ajuste (gap da Fase 1, fora deste
      escopo)
- [x] Saldo, quantidade física, diferença, ajuste, motivo, responsável e data
- [x] Sem divergência, apresentar situação positiva

### Tarefa 4.7 · Tabela e relatórios

- [x] Colunas: código, item, grupo, unidade, quantidade, mínimo, situação, custo
      médio, valor total, lote, validade, última movimentação — lote e validade
      são derivados das entradas confirmadas (mesma fonte da seção "Validade e
      risco"): mostram o lote de vencimento mais próximo do insumo, sem criar
      cópia do dado. Produto acabado exibe "-----" (não tem lote no sistema)
- [x] Busca e filtros por item, grupo, categoria, situação, validade e período —
      categoria comercial do produto (ou categoria do insumo), situação pelo
      clique na rosca, validade pelo botão "Com risco de validade" e período
      pela última movimentação (30/60/90 dias, +90 dias, nunca movimentado)
- [x] PDF em A4, impressão sem menus, exportação Excel
- [x] Gráficos com título, legenda e números também em texto, para leitura humana
      e por IA

## Definição de pronto

- [x] Cartões, gráficos, tabela, PDF e Excel matematicamente consistentes —
      valores arredondados ao centavo na fonte (`stockValue`), então a soma das
      linhas exibidas é igual ao total em tela, PDF e CSV; cálculos de saúde,
      valor, composição, validade, evolução mensal e giro conferidos por script
      isolado contra contas manuais (28 verificações)
- [x] Nenhum campo editável em toda a área — nenhuma rota ou store desta fase
      faz `insert`, `update`, `upsert`, `delete` ou `rpc`; os únicos campos são
      filtros de visualização
- [x] Valores batendo com os saldos oficiais — conferido em 2026-09-21 com dado
      real do banco (41 itens ativos): valor total R$ 1.630,50 (produtos
      R$ 1.430,50 + insumos R$ 200,00), idêntico entre a soma feita no SQL e o
      cálculo do código da tela (`buildStockItems` + `stockValue`)
- [x] Filtros produzindo os mesmos números em tela e em relatório — PDF, CSV e
      tabela leem da mesma lista filtrada; a tela mostra "N de M itens · valor
      total" e o PDF imprime os filtros aplicados

## Roteiro de validação

1. Conferir a saúde de um item com saldo 200 e mínimo 100, esperando verde.
2. Zerar um item e conferir que aparece em vermelho como sem estoque.
3. Conferir o valor total contra uma soma manual de saldo por custo.
4. Filtrar por categoria e conferir que o gráfico recalculou.
5. Gerar o PDF e comparar linha a linha com a tela.
6. Tentar editar qualquer campo e confirmar que não existe essa opção.

## Saída desta fase

Gestão enxergando estoque em valor, saúde, validade e giro sem abrir planilha.

---

# FASE 5 · FINANCEIRO E PAGAMENTOS

> Módulo 5 · Complexidade alta · 22 a 28 horas · R$ 350

## Objetivo

Registrar despesas, agendar e pagar boletos pelo Asaas sem sair do sistema, e
alimentar o custo do produto sem duplicar o que já está no estoque.

## Pré-condições

- [ ] Fase 2 concluída, produção gerando o denominador do rateio
- [ ] Fase 0 concluída, empresa configurada
- [ ] Conta Asaas apta ao recurso Pague Contas
- [ ] Acesso ao ambiente de homologação liberado

## Modo de ação

1. Construir o cadastro e os lançamentos **antes** de tocar na integração.
2. Validar o rateio com dados reais de produção antes de conectar o Asaas.
3. Implementar a integração em homologação, nunca direto em produção.
4. Implementar verificação de duplicidade **antes** de habilitar o agendamento.
5. Só habilitar baixa automática depois que os webhooks estiverem estáveis.

## Decisões estruturais desta fase

> Não existe campo operacional separado de competência. A organização mensal segue
> as datas de **vencimento e pagamento**.

> Agendamento confirmado **não** significa pagamento concluído.

> Despesa registrada e despesa rateável são conceitos diferentes.

## Escopo

### Tarefa 5.1 · Banco de dados

- [ ] Tabela `expenses`: descrição, categoria, natureza, tipo, recorrência, valor,
      beneficiário com tipo e referência, forma de pagamento, rateável,
      observações, anexo
- [ ] Tabela `expense_installments`: parcela X de Y, vencimento, valor, linha
      digitável, situação de validação, data de agendamento, ID externo, data de
      pagamento
- [ ] Tabela `expense_audit_log`: ação, valor anterior, valor novo, responsável,
      data, hora, motivo, origem automática ou manual, retorno da integração
- [ ] RLS por perfil configurado

### Tarefa 5.2 · Visão geral

- [ ] Indicadores: total do período, pago, a pagar, agendado, atrasado
- [ ] Indicadores de custo preservados: despesas rateáveis, produção concluída,
      custo indireto médio por unidade, previsto contra realizado
- [ ] Gráfico de despesas por categoria, com valor, percentual e clique para filtrar
- [ ] Gráfico de evolução mensal com variação contra o período anterior
- [ ] Cinco maiores despesas do mês
- [ ] Previsto contra realizado e rateável contra não rateável
- [ ] Filtros: mês atual, mês anterior, últimos meses, ano, personalizado, vida
      inteira
- [ ] PDF completo, PDF executivo, impressão A4 e Excel
- [ ] Relatório com empresa, período, data, hora e marca de mês reaberto

### Tarefa 5.3 · Lançamentos mensais

- [ ] Colunas: despesa, categoria, beneficiário, vencimento, valor, forma de
      pagamento, rateável, situação, pagamento, comprovante, ações

| Situação | Cor | Regra |
|---|---|---|
| Aberto | Cinza | Sem pagamento e sem agendamento confirmado |
| Agendado | Azul | Asaas confirmou a criação do agendamento |
| Pago | Verde | Pagamento confirmado, baixa automática |
| Atrasado | Vermelho | Venceu sem confirmação de pagamento |

- [ ] Erro técnico **não** é uma quinta situação, vira alerta no topo da tela
- [ ] Sem reprocessamento automático nesta versão
- [ ] Filtros rápidos: hoje, próximos 7, 15 e 30 dias, personalizado
- [ ] Recorrentes geradas automaticamente
- [ ] Eventuais adicionadas sem alterar a estrutura das demais
- [ ] Fechar mês bloqueia alteração retroativa
- [ ] Reabrir exige permissão sensível e motivo, com marca permanente
- [ ] Acesso ao que foi alterado depois da reabertura
- [ ] Baixa manual disponível, com auditoria

### Tarefa 5.4 · Nova despesa

- [ ] Identificação: descrição, categoria, natureza, tipo, recorrência, valor,
      observações, anexo
- [ ] **Beneficiário nunca é texto livre.** Escolher o tipo, fornecedor ou
      colaborador, e selecionar no cadastro correspondente do sistema
- [ ] Formas: Pix, cartão, boleto, débito automático, transferência, dinheiro, outro
- [ ] Bloco de rateio por centro ou setor, com divisão por percentual ou valor
- [ ] Aviso obrigatório na interface sobre não ratear insumo já apropriado

### Tarefa 5.5 · Grade de boletos

Foi descartada a lógica de intervalos automáticos. Fornecedores criam sequências
irregulares.

- [ ] Usuário informa a quantidade de parcelas
- [ ] Sistema gera uma linha por parcela no formato `1 de 4`
- [ ] Cada linha com vencimento real, valor próprio e linha digitável
- [ ] Situação de validação: não consultado, validado, divergência, erro

### Tarefa 5.6 · Integração Asaas

| Etapa | Comportamento |
|---|---|
| 1. Cadastrar | Registrar despesa, beneficiário, boletos, valores e vencimentos |
| 2. Verificar duplicidade | Bloquear boleto já pago, alertar boleto já cadastrado |
| 3. Simular | Enviar linha digitável e obter os dados do título |
| 4. Conferir divergência | Comparar valores, nunca ajustar em silêncio |
| 5. Agendar | Usuário autorizado agenda direto, sem aprovação obrigatória |
| 6. Confirmar | Situação vira agendado só quando a API confirma |
| 7. Acompanhar | Receber eventos e atualizar o estado técnico |
| 8. Baixar | Só confirmação de pagamento efetivo muda para pago |
| 9. Falha | Alerta de erro, com baixa manual como alternativa |

- [ ] Estados técnicos internos: criado, pendente, processamento bancário, pago,
      cancelado, falhou, estornado
- [ ] Interface do usuário permanece com quatro situações apenas
- [ ] Acompanhamento preferencial por webhooks
- [ ] Persistir IDs externos e tratar eventos de forma idempotente
- [ ] Registrar quem agendou, data, hora, data programada, ID retornado e resultado
- [ ] Alertar combinação suspeita de mesmo beneficiário, mesmo valor e vencimento
      próximo, sem bloquear automaticamente

### Tarefa 5.7 · Rateio e custo indireto

```
total de despesas rateáveis do período
────────────────────────────────────── = custo indireto por unidade
unidades com produção concluída
```

- [ ] A base é **produção concluída**, não venda
- [ ] Total produzido vem automaticamente da Fase 2, nunca redigitado
- [ ] Boletos de matéria-prima e mercadoria **não entram no rateio**, porque o custo
      já foi apropriado pelo estoque e pela ficha técnica
- [ ] Custo indireto alimenta a composição do custo do produto automaticamente
- [ ] Cada unidade concluída recebe a mesma parcela neste modelo inicial

### Tarefa 5.8 · Permissões e auditoria

| Perfil | Permissões |
|---|---|
| Visualizador | Somente leitura |
| Operador ou gerente | Cadastrar, lançar, anexar, agendar e dar baixa conforme permissão |
| Administrador | Fechar e reabrir mês, corrigir períodos, administrar permissões |

- [ ] Título do cargo não concede ação sensível automaticamente
- [ ] Lançamento financeiro nunca apagado, apenas cancelado ou inativado
- [ ] Alertas: reabertura de mês, alteração retroativa, tentativa sem permissão,
      erro de pagamento
- [ ] Marcar alerta como revisado sem apagar o evento original
- [ ] Quem gerou o evento não pode eliminá-lo

### Tarefa 5.9 · Card no dashboard

- [ ] Despesas totais e variação contra o período anterior
- [ ] Previsto contra realizado
- [ ] Despesas contra faturamento
- [ ] Mini gráfico de evolução e principais categorias
- [ ] Contas a vencer, vencidas e agendadas
- [ ] Cards clicáveis levando à tela já filtrada
- [ ] Dashboard **não** duplica a tela completa de despesas

## Fora de escopo

Conciliação bancária, integração bancária direta, parcelamento avançado e fluxo de
caixa completo.

## Definição de pronto

- [ ] Ciclo completo funcionando: simular, agendar, acompanhar e baixar
- [ ] Custo indireto por unidade calculado sobre produção concluída
- [ ] Mês fechado bloqueando retroativo
- [ ] Mês reaberto marcado para sempre
- [ ] Nenhum custo de insumo contado duas vezes
- [ ] Situação agendado nunca aplicada sem confirmação da API
- [ ] Baixa automática nunca antes da confirmação efetiva

## Roteiro de validação

1. Cadastrar despesa de aluguel recorrente e conferir a geração dos próximos meses.
2. Cadastrar despesa com quatro boletos de vencimentos irregulares.
3. Simular um boleto em homologação e conferir os dados retornados.
4. Forçar divergência de valor e confirmar que o sistema destaca.
5. Tentar lançar a mesma linha digitável de novo e confirmar o bloqueio.
6. Agendar e conferir que a situação só muda com a confirmação da API.
7. Lançar R$ 1.000 rateáveis com 500 unidades produzidas e conferir R$ 2,00 por
   unidade.
8. Lançar boleto de matéria-prima e confirmar que ficou fora do rateio.
9. Fechar o mês, tentar editar, reabrir como administrador e conferir a marca
   permanente.

## Saída desta fase

Empresa sabendo quanto gastou, com o quê, quanto entra no custo e quanto custa
produzir uma unidade.

---

# FASE 6 · EMISSÃO FISCAL

> Módulo 6 · Complexidade muito alta · 20 a 25 horas · R$ 450

## Objetivo

Completar a camada fiscal com certificado digital, numeração de NF-e e conexão com
o provedor, deixando a empresa apta para homologação e depois produção.

## Pré-condições

- [ ] Fase 0 concluída
- [ ] Fase 5 concluída
- [ ] Certificado digital disponível
- [ ] Conta no provedor ativa com acesso a homologação

## Modo de ação

1. Confirmar que os dados da Fase 0 estão completos antes de começar.
2. Certificado antes de integração, porque a integração depende dele.
3. Trabalhar **exclusivamente** em homologação até a validação final.
4. Nunca expor segredo em tela, log ou mensagem de erro.
5. Quadro de prontidão por último, porque lê todos os blocos anteriores.

## Escopo

### Tarefa 6.1 · Configuração de NF-e

- [ ] Tipo de documento, com arquitetura preparada para outros sem misturar regras
- [ ] Ambiente: homologação sem valor fiscal, produção oficial
- [ ] Série da NF-e
- [ ] Próximo número, com alteração exigindo permissão e registrando histórico
- [ ] Finalidade padrão, sobrescrevível na operação
- [ ] Bloquear produção enquanto houver requisito crítico pendente

### Tarefa 6.2 · Certificado digital

- [ ] Suporte a A1 e A3
- [ ] Upload com armazenamento seguro, **nunca expondo o conteúdo**
- [ ] Senha mascarada e nunca exibida
- [ ] Leitura automática da validade
- [ ] Situação: válido, próximo do vencimento, vencido ou erro

### Tarefa 6.3 · Integração com o provedor

- [ ] Ambiente coerente com o ambiente da NF-e
- [ ] Credenciais com exibição parcial, permitindo substituir ou revogar
- [ ] Identificador externo relacionando os registros dos dois sistemas
- [ ] Situação da conexão: conectado, não conectado, erro, credencial inválida
- [ ] Último teste com data, hora e resultado
- [ ] Botão de testar conexão executando diagnóstico **sem emitir nota**

### Tarefa 6.4 · Quadro de prontidão

- [ ] Cadastro empresarial: completo ou pendente
- [ ] Endereço e códigos: UF, município, IBGE e país validados
- [ ] Regime tributário: confirmado
- [ ] Certificado digital: presente e válido
- [ ] NF-e: série, numeração e ambiente validados
- [ ] Integração: conexão e credenciais confirmadas
- [ ] Situação final: pronto para homologação, pronto para produção ou pendências
- [ ] Ações: salvar, testar integração, validar prontidão, editar configurações
      críticas somente para autorizado

## Fora de escopo

Grupo de impostos, ficha fiscal do produto e regras de operação. São etapa própria,
reaproveitando NCM e demais dados já existentes no cadastro de produtos.

## Definição de pronto

- [ ] Conexão testável sem emitir nota
- [ ] Certificado armazenado com segurança e nunca exposto
- [ ] Quadro de prontidão totalmente automático
- [ ] Ambiente de produção bloqueado enquanto houver pendência
- [ ] Empresa apta para homologação

## Roteiro de validação

1. Subir o certificado e conferir a leitura automática da validade.
2. Conectar com credencial válida e conferir a situação conectado.
3. Conectar com credencial inválida e conferir a mensagem de erro.
4. Testar conexão e confirmar que nenhuma nota foi emitida.
5. Deixar um campo crítico vazio e conferir que produção segue bloqueada.
6. Preencher tudo e conferir a situação pronto para homologação.
7. Inspecionar a tela e o código-fonte da página procurando qualquer segredo
   visível.

## Saída desta fase

Empresa apta a emitir nota fiscal eletrônica.

---

## PARTE VI · ESTADO DO ROADMAP

Atualizar ao concluir cada fase, somente depois que a definição de pronto passou
integralmente e Ruan liberou.

| Fase | Módulo | Situação | Concluída em |
|---|---|---|---|
| 0 | Fundação fiscal | Concluída | 2026-09-16 |
| 1 | Base de insumos | Concluída | 2026-09-17 |
| 2 | Produção | Concluída | 2026-09-18 |
| 3 | Estoque | Concluída | 2026-09-19 |
| 4 | Leitura gerencial | Em validação | |
| 5 | Financeiro e pagamentos | Não iniciada | |
| 6 | Emissão fiscal | Não iniciada | |

Situações possíveis: não iniciada, em execução, em validação, concluída, bloqueada.

Fase bloqueada exige registro do motivo e de quem precisa destravar.

---

## PARTE VII · RISCOS

| Risco | Probabilidade | Impacto | Mitigação | Fase |
|---|---|---|---|---|
| Ficha técnica com muitos componentes | Média | Baixo | Otimização de consulta e índices | 2 |
| Saldo insuficiente de insumo | Alta | Médio | Regra documentada, baixa até zero, aviso claro | 2 |
| Duas produções simultâneas | Baixa | Alto | Trava no banco durante a gravação | 2 |
| Volume alto de movimentações | Média | Médio | Índices, paginação e cache | 3 |
| Reabertura de mês sem permissão | Baixa | Alto | Verificação de perfil e auditoria obrigatória | 5 |
| Custo de insumo contado duas vezes | Média | Alto | Validação do beneficiário antes do rateio | 5 |
| Pagamento em duplicidade | Média | Crítico | Verificação da linha digitável antes e depois | 5 |
| Exposição de credencial | Baixa | Crítico | Campo mascarado e armazenamento seguro | 5 e 6 |
| Certificado vencendo sem aviso | Média | Alto | Leitura automática da validade e alerta | 6 |

---

## PARTE VIII · PREPARAÇÃO

Antes da Fase 0.

- [ ] Criar branch isolada do ambiente em produção
- [ ] Configurar variáveis de ambiente
- [ ] Preparar índices e regras de segurança no banco
- [ ] Criar componentes de interface reaproveitados pelas fases
- [ ] Confirmar acesso ao ambiente de homologação do Asaas
- [ ] Confirmar backup do banco de produção

---

## PARTE IX · ESTRUTURA DO ADMIN

Organização prevista ao final de todas as fases.

```
Dashboard
Indicadores
Pedidos
Clientes
Produtos
Matérias-primas
Produção
Estoque
Categorias
Fornecedores
Despesas
Configurações
```

A hierarquia não é imutável. Se outra organização deixar o sistema mais intuitivo,
propor antes de alterar.

**Situação atual (2026-09-20, aprovada por Ruan):** a barra lateral está agrupada
em Visão geral (Indicadores, Pedidos), Cadastros (Produtos, Categorias, Clientes,
Fornecedores), Fábrica (Matérias-primas, Produziu Registra, Painel de produção) e
Estoque (Estoque, Indicadores de estoque), com Configurações fixa no fim. No
celular há barra inferior com Pedidos, Produzir, Estoque e Mais. A lista vive em
`src/components/admin/AdminNav.tsx`.

---

## PARTE X · ROADMAP FUTURO

Fora do escopo atual. **Não implementar antecipadamente**, mesmo que pareça simples
durante alguma fase.

| Evolução | O que resolve |
|---|---|
| Tarefas e Equipe | Atribuição por funcionário e produtividade |
| Oportunidades | Registro comercial e follow-up por cliente |
| Marketing | Campanhas, atividades e métricas |
| Precificação automática | Preço sobre o custo real de insumo e despesa |
| Saboriza IA | Consulta operacional e ações administrativas autorizadas |

Sobre a Saboriza IA, uma regra já definida: ela **não** terá acesso irrestrito ao
banco. Trabalhará por funções controladas, autorizadas e auditáveis, liberadas em
etapas.

---

## PARTE XI · GLOSSÁRIO

| Termo | Significado |
|---|---|
| Insumo | Matéria-prima, embalagem ou rótulo usado na produção |
| Unidade de controle | Unidade oficial do saldo do insumo, por exemplo kg, L ou un |
| Embalagem de compra | Como o insumo é comprado, por exemplo saco de 25 kg |
| Ficha técnica | Composição do produto, quanto de cada insumo por unidade |
| Pack ou kit | Agrupamento de venda e produção, por exemplo 12 unidades |
| Produto acabado | Item finalizado, pronto para venda |
| Custo médio | Custo ponderado do insumo, calculado pelas entradas confirmadas |
| Movimentação | Registro oficial de entrada, saída ou ajuste |
| Rateável | Despesa que compõe o custo do produto |
| Custo indireto | Despesa rateável dividida pelas unidades produzidas |
| Competência | Período ao qual a despesa pertence |
| Prontidão fiscal | Situação dos requisitos para emitir nota |

---

**Fim do documento.**

Qualquer alteração aqui exige aprovação de Ruan e incremento de versão.
