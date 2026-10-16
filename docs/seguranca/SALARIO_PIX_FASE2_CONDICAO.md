# Salário/Pix fase 2: condição para aplicar (NÃO APLICAR sem ordem)

Status: PREPARADA. Nada foi aplicado em banco algum. Verificado em 2026-10-15 (produção só com SELECT).

## Estado em produção (somente leitura)
- Fase 1 NÃO aplicada: 0 funções `list_employee_compensation`/`set_employee_compensation`, 0 permissões `colaboradores.remuneracao.*`.
- `authenticated` ainda lê `employees.salary_base` (`has_column_privilege` = true); `anon` não lê `pix_key`.
- `update_employee_salary` em produção só exige ser membro ativo da empresa (`private.is_active_company_member`): qualquer membro altera salário de qualquer colaborador da própria empresa, sem auditoria. Entre empresas já é barrado (testado).

## Telas/stores afetados no front desta branch (grep em `src/`)
Nenhuma tela lê/grava coluna sensível direto na tabela no caminho normal. Tudo passa por `src/lib/employee-compensation.ts` (RPC `list_employee_compensation`, `set_employee_compensation`, `list_commission_rates`), consumido por `src/store/employees-store.ts` e `src/store/vendas-store.ts`. Telas que dependem desses stores: `EmployeeProfilePage`, `DespesasPessoalPage`, `LaunchModals`, `NovaDespesaPage`, `ForcaDeVendasPage`.

Caminhos diretos que SÓ existem como fallback "legacy" (ativados quando a função da fase 1 não existe, erro PGRST202) e que quebram com "permission denied" na fase 2 se a fase 1 faltar:
- `src/lib/employee-compensation.ts`: `fetchCompensation` (select de `salary_*`, `pix_key` em `employees`), `saveCompensation` (update direto), `fetchCommissionRates` (select `commission_rate_percent`).
- `src/store/vendas-store.ts` `updateCommissionRate` (update direto de `commission_rate_percent`).
Leituras listadas: `EMPLOYEE_PUBLIC_COLUMNS` (sem colunas sensíveis) e `toRow` (não envia colunas sensíveis). Único `select("*")` do front em `employee_documents`, não em `employees`. Embeds `employees(name)` em despesas/tarefas usam coluna liberada. Edge Functions (`meu360-terminal`, `ponto-oris-terminal`) usam service_role, não afetadas.
Banco: funções que liam as colunas como invoker são `oris360_resolver_banco_horas` (a fase 2 a converte para DEFINER) e `resolve_salary_base`/`update_employee_salary` (idem). Não há views nem políticas que referenciem as colunas (inventário em PGlite).

## Condição exata para aplicar a fase 2
1. Fase 1 (`seguranca_salario_pix_1_aditiva.sql`) aplicada e confirmada: as 5 RPCs existem e as 2 permissões existem.
2. Front desta branch (ou posterior, com `employee-compensation.ts`) publicado em produção, e o front antigo (select(*) em employees) fora de circulação, inclusive abas abertas/cache.
3. Papéis que devem ver/alterar remuneração já têm `colaboradores.remuneracao.read/manage` (a fase 1 copia só de quem tinha `despesas.manage` na hora; papéis criados depois não herdam).
4. Aprovação explícita do dono; reversão pronta: `seguranca_salario_pix_reverter_2.sql`.
Mudança de comportamento intencional: quem tem só `despesas.manage` criado depois da fase 1 passa a ser negado em `update_employee_salary`.

## Cobertura `update_employee_salary` (PGlite)
- Já existia em `testes_seguranca_salario_pix.mjs` (membro comum negado, RH atendido e auditado).
- Novo: `supabase/pendentes/testes_update_employee_salary.mjs` (19 verificações, todas OK): estado atual (lacuna do membro comum documentada, outra empresa negada, anon negado, negativo, inexistente) e fases 1+2 (membro comum, papel de despesas criado depois, outra empresa, anon negados sem alterar dado; RH altera + histórico + auditoria; retroativo não sobrescreve vigente; RH da empresa A não toca empresa B; reversão da fase 2 restaura o comportamento antigo).

Comandos: `PGLITE_DIR=<pasta> node supabase/pendentes/testes_update_employee_salary.mjs` e `.../testes_seguranca_salario_pix.mjs` (86 OK, 0 falhas).
