-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20261002132528 · md5 normalizado 606d4d7e8f6e83ca4543f819b57184a4 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- REVOKE ... FROM anon não bastava: EXECUTE continuava concedido via PUBLIC (grant default do CREATE FUNCTION,
-- do qual anon é membro implícito). Revoga de PUBLIC e garante explicitamente que authenticated mantém acesso
-- (as RPCs já validam permissão/empresa internamente).
revoke execute on function public.block_expense(uuid, text, text) from public;
revoke execute on function public.create_expense_adjustment(uuid, text, numeric, text, text) from public;
revoke execute on function public.update_employee_salary(uuid, numeric, date) from public;
revoke execute on function public.resolve_salary_base(uuid, date) from public;
revoke execute on function public.get_formation_balance(uuid, text) from public;

grant execute on function public.block_expense(uuid, text, text) to authenticated;
grant execute on function public.create_expense_adjustment(uuid, text, numeric, text, text) to authenticated;
grant execute on function public.update_employee_salary(uuid, numeric, date) to authenticated;
grant execute on function public.resolve_salary_base(uuid, date) to authenticated;
grant execute on function public.get_formation_balance(uuid, text) to authenticated;
;
