# Relatório das ondas (chefe de gabinete)

Branch de trabalho: `trabalho/ondas-chief-of-staff` (local, a partir de `trabalho/pendencias-versionadas` 9621b0a).

## Onda 0 — Reconciliação (2026-10-15)
- Homologação `dfynvpieyvvameftrent` confirmada por SELECT: 133 tabelas, 368 policies, 5 buckets, 3 cron ativos, 186 migrations (última 20261014230013), 3 pedidos, 8 usuários. Bate com o contexto.
- Migrations do Separa Confere (outra frente) existem em `origin/homolog/separa-confere-v3` (390dc65) e em `trabalho/homologacao-rebase` (c9d7a8e, contém a anterior). Arquivos: `20261014181000_apps_operacionais_reconciliacao_grants`, `20261014221500_separa_confere_v3_faltas_ciclo_de_vida`, `20261014224500_separa_confere_v3_inventario_escopo_de_app`, `20261014223000_separa_confere_v3_dados_minimos_e_tempo_real`. Nenhum está em `trabalho/pendencias-versionadas`.
- Nota: `181000` é "reconciliação de grants" (DEF-06), não "faltas".
- Nada aplicado em produção.

## Onda 1 — Homologação utilizável (2026-10-15/16)
- Migrations do Separa Confere (181000, 221500, 224500, 223000 fase A) aplicadas na homologação, que passou de 186 para 190 migrations. Fase B não aplicada.
- Roteiro `testes_homologacao.sql` com fixtures: 348 OK, 0 FALHOU, 0 INCONCLUSIVO (rollback). Snapshot do passo 0 perdido. Diff de políticas contra a trilha reconstruída: NÃO INICIADO.
- Estoque/inventário sintéticos: RESOLVIDA. `estoque-inventory-sync` com 58 execuções ok. Cron: manter sync e sweep; testar `monthly-close-rollover` antes de produção.
- Matriz ampliada: 135 tabelas x 9 perfis, zero vazamento A↔B. Achados: escopo de unidade sem RLS (21 tabelas), entregador lê todos os pedidos, anônimo lê `companies`/`products`/`settings`/`coupons`.
- API real: 114 casos, 98 PASSOU, 9 FALHOU, 7 BLOQUEADO. Falhas: perfis restritos alteram `products.unit_price` e `orders`; `separation_set_item` sem checagem de papel. Bloqueio: `create_order` com fixture B com `order_number=''` (UPDATE negado pelo classificador, não contornado).
- Navegador: BLOQUEADO (sem ferramenta de navegador na sessão).

## Onda 2 — Segurança e dados
- Salário/Pix fase 2: PREPARADA (condição em `docs/seguranca/SALARIO_PIX_FASE2_CONDICAO.md`).
- Higiene de grants: PREPARADA (`seguranca_higiene_grants.sql`, 16 OK em PGlite). Achado: 9 funções DEFINER sem checagem de empresa (DP-GRANTS-1).
- CPF/RG/telefone fase 1 e 2: PREPARADA (58 OK em PGlite); front não migrado.
- Horas extras: PREPARADA (44 OK); aplicar BLOQUEADO por decisão (muda mês no DRE).
- Webhook Asaas: PREPARADA (38 OK); defeitos da borda provados (`PAGO` viola CHECK, evento perdido em falha, `paid_at` sobrescrito). Edge Function não publicada.
- Migration 20260928152708: PREPARADA (script de preparo de banco vazio, 7 OK).
- LF/CRLF: RESOLVIDA (`.gitattributes`, 184 de 185 hashes batem).
- Estado: nada aplicado em produção; nada enviado ao remoto.
