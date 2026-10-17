# Plano de pendências (ordem de resolução)

Atualizado em 2026-10-17. Estado base: produção com 192 migrations; `main` publicada em `7c67b93`. Detalhes de cada decisão em `DECISOES_PENDENTES.md`.

Legenda de responsável: **VOCÊ** decide ou fornece algo; **EU** executo sozinho (local ou homologação); **EU + ordem** escrita em produção, só com sua ordem direta.

## Bloco A. Produção ao vivo (primeiro)
| # | Pendência | Responsável | Estado |
|---|-----------|-------------|--------|
| A1 | Limites de crédito dos clientes que compram a prazo (faturar a prazo está bloqueado para todos) | VOCÊ passa os valores; EU + ordem aplico, ou o Proprietário define na ficha | aberta |
| A2 | Fumaça de 10 passos em produção (`PACOTE_PRODUCAO_CLIENTES_FORNECEDORES.md` §8) | VOCÊ | aberta |
| A3 | Vendedor, separador e entregador perderam a leitura de fornecedores (DP-FORN-6) | VOCÊ confirma se algum fluxo deles precisa | aberta |
| A4 | Logs de produção sem erro novo das RPCs (2026-10-17) | EU | feito |

## Bloco B. Segurança (risco real em produção hoje)
| # | Pendência | Responsável | Estado |
|---|-----------|-------------|--------|
| B1 | `update_employee_salary` aceita qualquer membro ativo, sem auditoria: aplicar salário/Pix fase 1 | EU prepara pacote; EU + ordem aplica | preparada |
| B2 | 9 funções DEFINER de estoque/produção sem checagem de empresa (DP-GRANTS-1): migration corrigindo corpo + teste multiempresa | EU escrevo; VOCÊ autoriza; EU + ordem aplico | bloqueada por decisão |
| B3 | Perfis restritos alteram `products.unit_price` e `orders`; `separation_set_item` sem checagem de papel | EU escrevo correção; VOCÊ autoriza | achado da API real |
| B4 | Higiene de grants (`seguranca_higiene_grants.sql`) | EU + ordem | preparada |
| B5 | Escrita direta em `customers` por vendedor e produção (DP-HCF-1) | VOCÊ decide; EU corrijo | aberta |
| B6 | Anônimo lê `companies`, `products`, `settings`, `coupons` (decisão 11) | VOCÊ decide | aberta |
| B7 | Escopo por unidade sem RLS (21 tabelas) e entregador vê todos os pedidos (decisões 9 e 10) | VOCÊ decide | aberta |
| B8 | CPF/RG/telefone fases 1 e 2; storage multiempresa; salário/Pix fase 2 (só após front novo) | EU prepara; EU + ordem | preparada |

## Bloco C. Financeiro
| # | Pendência | Responsável | Estado |
|---|-----------|-------------|--------|
| C1 | RPCs atômicas de pagar/receber/estornar/aporte: aplicar e trocar as stores do front | EU + ordem | preparada |
| C2 | Webhook Asaas: 4 defeitos provados na Edge Function (publicar função corrigida exige sua ordem) | EU + ordem | preparada |
| C3 | DRE por competência, CMV, caixa, setor/rateio, anexos, recorrência, unificar jobs de fechamento | VOCÊ decide (DP-FIN-*) | bloqueada por decisão |
| C4 | Regras do DP-FIN-9 a 12 (recusar pagamento acima do saldo; estorno de despesa) | VOCÊ decide | aberta |
| C5 | Horas extras convergindo para obrigação (muda mês no DRE) | VOCÊ decide | preparada |

## Bloco D. Separa Confere e apps operacionais
| # | Pendência | Responsável | Estado |
|---|-----------|-------------|--------|
| D1 | Aplicar em produção `180000, 181000, 221500, 224500, 223000 fase A` (já aplicadas na homologação) | EU + ordem | pronta para decisão |
| D2 | Fase B (bloqueio direto do operador só-Separa), depois do front no ar | VOCÊ + EU | aguardando D1 |
| D3 | Papéis com `producao.operar`, `entrega.operar`, `admin.acessar`; separador conta inventário? | VOCÊ | aberta |
| D4 | Comprovantes de entrega só para o app Entrega | VOCÊ | aberta |

## Bloco E. Produto (pacotes mestre)
| # | Pendência | Responsável | Estado |
|---|-----------|-------------|--------|
| E1 | Clientes: prospecção, visitas, tarefas, roteiros, importação (CL11); regra de compra faturada (CL9); permissões de inativar e propor (CL7/CL8) | VOCÊ decide; EU implemento | aberta |
| E2 | Fornecedores: data-base de "comprado" (DP-FORN-1), mapa categoria→fornecedor, importação CSV, código FOR-0001 | VOCÊ decide | aberta |
| E3 | Central de Auditoria: exportar, usuários, casos, políticas (DP-AUD-3) | EU | não iniciada |
| E4 | Missões/Roteiros, Central de Apuração, consumidores da outbox, participações do chão de fábrica | EU levanta e implemento por etapa | não iniciada |

## Bloco F. Ambiente e verificação
| # | Pendência | Responsável | Estado |
|---|-----------|-------------|--------|
| F1 | Teste de navegador das telas (nunca feito; sessão sem navegador) | VOCÊ abre sessão com Claude in Chrome ou roda o roteiro | aberta |
| F2 | Concorrência real do crédito: `HOMOLOG_DB_URL` fora do repositório para script com 2 conexões | VOCÊ fornece | aberta |
| F3 | Fixture B com `order_number=''` bloqueia `create_order` na homologação | VOCÊ autoriza o UPDATE sintético | aberta |
| F4 | Senhas dos usuários `rot-*` em `homolog-credenciais.txt` | VOCÊ | aberta |
| F5 | Aparelho real (`docs/apps-operacionais/ROTEIRO_APARELHO_REAL.md`) | VOCÊ | aberta |
| F6 | Cron jobs da homologação: manter sync e sweep, testar `monthly-close-rollover` | VOCÊ | aberta |
| F7 | Limpar worktrees e branches de subagentes e a `main` local (backup antes) | EU, com sua confirmação | aberta |

## Ordem sugerida
1. A1 e A2: o cliente já está usando o sistema.
2. B1 e B2/B3: segurança com risco real.
3. F1: abrir as telas num navegador, pois valida tudo que subiu.
4. C1 e D1.
5. Decisões de produto e Financeiro (E e C3 a C5).
