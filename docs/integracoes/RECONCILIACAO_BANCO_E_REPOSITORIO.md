# Reconciliação: banco de produção × repositório × implantação

Levantamento em 15/10/2026, somente leitura. Nada foi reaplicado.

## 1. Qual repositório e revisão correspondem à produção

| Camada | Identificação | Revisão |
|---|---|---|
| Front (Vercel, projeto `saboriza-catalogo`, alvo production) | repositório `Ruanzinn01/Saboriza-Catalogo`, branch `main` | **`d1d73de`** (deploy em produção mais recente, estado READY) |
| Repositório local | mesmo remoto (`origin`) | HEAD local à frente do `origin/main` por vários commits **não enviados** (ver `git log origin/main..HEAD`) |
| Banco (Supabase, projeto `saboriza`, `opeietrhbqlhrhljcdtx`) | 185 migrações registradas (`20260909232045` … `20261014174752`) | à frente do front em produção (ver §3) |
| Funções de borda (Supabase) | ponto-oris-terminal v5, meu360-terminal v2, iam-manage-members v3, asaas-webhook v3, asaas-create-charge v4, asaas-test-connection v2, asaas-emit-invoice v2 | `ponto-oris-terminal` publicado = código anterior às correções locais (conferido por leitura) |

O pacote de Integrações cita dois outros commits (`dbe8b95…` e `e9d8181…`). Nenhum deles é a revisão em produção: a produção está em `d1d73de` do mesmo repositório `Ruanzinn01/Saboriza-Catalogo`.

## 2. Migrações: banco × repositório

- **No banco:** 185 migrações.
- **No repositório:** 22 arquivos. As 163 restantes (toda a fundação, RH, Ponto, Finanças e as migrações até 06/10) existem **somente no banco**.
- **Versões:** o banco grava a versão com o horário da aplicação; os arquivos do repositório tinham versões inventadas. Em 15/10 os 18 arquivos foram **renomeados para a versão real registrada no banco** (só nome de arquivo, sem efeito no banco), mantendo o nome da migração:

| Arquivo no repositório | Versão registrada no banco |
|---|---|
| `20261006202300_central_integracoes` | 20261006202300 |
| `20261007144623_revoke_public_truncate` | 20261007144623 |
| `20261008121633_base_nfe_produto` | 20261008121633 |
| `20261013185605_separa_confere_inventario` | 20261013185605 |
| `20261013233320_estoque_onda1_razao_posicao_ajuste` | 20261013233320 |
| `20261014000531_estoque_onda2_compras` | 20261014000531 |
| `20261014001140_products_target_margin_optional` | 20261014001140 |
| `20261014015217_estoque_onda3_cobertura_politicas` | 20261014015217 |
| `20261014020434_estoque_onda4a_retornos_perdas` | 20261014020434 |
| `20261014021021_estoque_onda4b_lotes_validade` | 20261014021021 |
| `20261014022143_estoque_onda5_fechamento_saldo_inicial` | 20261014022143 |
| `20261014023835_stock_ledger_initial_balance_label` | 20261014023835 |
| `20261014033522_estoque_endurecimento_correcao_compra` | 20261014033522 |
| `20261014033650_compra_abatimento_todas_despesas_abertas` | 20261014033650 |
| `20261014150418_separa_confere_v3` | 20261014150418 |
| `20261014150319_colaboradores_v41_vencimento_salarial` | 20261014150319 |
| `20261014164335_folha_nos_totais_financeiros` | 20261014164335 |
| `20261014164932_integracoes_pacote0_eventos` | 20261014164932 |
| `20261014173037_etapa1_historico_de_contratacao` | 20261014173037 |
| `20261014173502_etapa2_revisao_ponto_espelho` | 20261014173502 |
| `20261014173931_etapa5_worker_outbox` | 20261014173931 |
| `20261014174752_etapa2_guarda_saldo_banco_horas` | 20261014174752 |

### Possível deriva (aplicadas no banco, sem arquivo no repositório, posteriores a 06/10)
`base_webhook_events_rpc`, `drop_old_list_integration_events_overload`, `fix_record_audit_event_actor_type_case`, `add_active_flag_to_expense_categories`, `drop_legacy_confirm_production_release_overload`, `expense_catalog_items_active_and_unique`, `expense_subcategory_and_item_description`, `salary_obligations_due_date_and_stop_expense_duplication`, `expenses_installment_identification_and_payment_method`, `estoque_onda4a_retorno_somente_quando_volta`, `separa_confere_v3_grant_operator_fn`.

Consequência: o arquivo `estoque_onda4a_retornos_perdas` do repositório **não reflete o estado final** do banco (falta a correção `..._retorno_somente_quando_volta`). Recriar o schema a partir dos arquivos do repositório produziria um banco diferente do de produção. Os nomes batem; o **conteúdo** dos 18 arquivos não foi comparado linha a linha com o que está aplicado.

## 3. Compatibilidade do front em produção com o banco atual

O banco está à frente do front publicado (`d1d73de`). Conferido por leitura do código antigo:
- `generateObligation` antigo insere obrigação com vencimento dia 5: continua válido (vencimento obrigatório satisfeito) e fica marcado `competence_closing`, embora a data seja a convenção antiga. Corrige-se ao publicar o front novo.
- `payAdvance` e `reverseAdvance` antigos escrevem direto nas tabelas: continuam funcionando; o estorno duplicado agora é barrado pelo índice único e os gatilhos emitem os eventos.
- Funções do Financeiro Geral/Painel/DRE agora somam a folha (efeito imediato, independente do front).

## 4. Regra daqui para frente

1. **Nada é reaplicado.** Toda mudança de banco entra como migração nova, aditiva, e é salva no repositório com a **versão que o banco registrar** (renomear o arquivo depois de aplicar).
2. Antes de qualquer migração: consultar `supabase_migrations.schema_migrations` e confirmar que o nome não existe.
3. Pendência que exige credencial do banco: gerar um **baseline** (`supabase db pull` ou `pg_dump --schema-only`) e versioná-lo, para que o repositório volte a recriar o schema. Não foi possível aqui (sem a senha do banco).
4. Homologação: **não existe ambiente de homologação**. Só há o projeto `saboriza` (produção). Opções: ramificação do Supabase (gera custo, depende de confirmação) ou projeto separado. Até lá, cada mudança de banco é testada em transação com `rollback` forçado, e as funções de borda **não** são publicadas.
