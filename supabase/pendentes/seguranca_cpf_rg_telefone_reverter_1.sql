-- REVERSÃO DA FASE 1 de CPF/RG/telefone (só depois de reverter a Fase 2, se ela tiver sido aplicada).
drop function if exists public.get_employee_personal_data(uuid);
drop function if exists public.list_employee_personal_data();
drop function if exists public.set_employee_personal_data(uuid, jsonb, text);
drop function if exists private.can_read_personal_data(uuid);

delete from public.role_permissions where permission_key in ('colaboradores.documentos.read', 'colaboradores.documentos.manage');
delete from public.permissions where key in ('colaboradores.documentos.read', 'colaboradores.documentos.manage');
