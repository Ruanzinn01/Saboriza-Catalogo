-- REVERSÃO DA FASE 1 (só depois de reverter a Fase 2, se ela tiver sido aplicada).
drop function if exists public.get_employee_compensation(uuid);
drop function if exists public.list_employee_compensation();
drop function if exists public.set_employee_compensation(uuid, jsonb, text);
drop function if exists public.set_employee_commission_rate(uuid, numeric);
drop function if exists public.list_commission_rates();
drop function if exists private.can_read_compensation(uuid);

delete from public.role_permissions where permission_key in ('colaboradores.remuneracao.read', 'colaboradores.remuneracao.manage');
delete from public.permissions where key in ('colaboradores.remuneracao.read', 'colaboradores.remuneracao.manage');
