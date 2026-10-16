-- SEGURANÇA DE CPF, RG E TELEFONE DE COLABORADORES — FASE 2 (restritiva). NÃO APLICADA EM PRODUÇÃO NEM EM HOMOLOGAÇÃO.
-- Pré-requisitos, nesta ordem: (a) seguranca_cpf_rg_telefone_1_aditiva.sql; (b) seguranca_salario_pix_1 e _2 (a fase 2 de salário
-- troca o privilégio de tabela de employees por privilégio por coluna; sem isso um revoke por coluna não tem efeito);
-- (c) front publicado lendo/gravando estes campos pelas funções (o front antigo usa select(*) e grava direto: passa a falhar com
-- "permission denied for column"). Reversão: seguranca_cpf_rg_telefone_reverter_2.sql
-- O service_role (funções de borda) e funções SECURITY DEFINER não são afetados.

do $$
begin
  if has_table_privilege('authenticated', 'public.employees', 'SELECT') then
    raise exception 'PRE_REQUISITO: aplique seguranca_salario_pix_2_restritiva.sql antes (employees ainda tem privilégio de tabela para authenticated)';
  end if;
  if to_regprocedure('public.set_employee_personal_data(uuid, jsonb, text)') is null then
    raise exception 'PRE_REQUISITO: aplique seguranca_cpf_rg_telefone_1_aditiva.sql antes';
  end if;
end;
$$;

revoke select (cpf, rg, rg_issuer, phone, emergency_phone) on public.employees from authenticated;
revoke insert (cpf, rg, rg_issuer, phone, emergency_phone) on public.employees from authenticated;
revoke update (cpf, rg, rg_issuer, phone, emergency_phone) on public.employees from authenticated;
revoke all (cpf, rg, rg_issuer, phone, emergency_phone) on public.employees from anon;
