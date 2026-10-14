-- Correção aplicada em produção logo após 20261014150418_separa_confere_v3.
-- As políticas RESTRICTIVE chamam esta função como o papel `authenticated`; sem EXECUTE toda consulta
-- às 42 tabelas protegidas falharia com 42501. Conteúdo idêntico ao registrado em schema_migrations.
grant execute on function private.is_restricted_operator(uuid) to authenticated;
