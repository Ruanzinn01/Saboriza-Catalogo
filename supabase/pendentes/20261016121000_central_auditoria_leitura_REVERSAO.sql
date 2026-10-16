-- REVERSÃO de 20261016121000_central_auditoria_leitura.sql. Só remove funções de leitura; audit_events não é tocada.
drop function if exists public.audit_central_detail(uuid);
drop function if exists public.audit_central_list(timestamptz, timestamptz, text, text, text, text, integer, integer);
drop function if exists public.audit_central_overview(timestamptz, timestamptz);
drop function if exists private.audit_central_company(boolean);
