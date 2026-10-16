-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260929154449 · md5 normalizado ffac00bbb80dd41beaf4fa77e50ad950 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

-- Ao logar pela primeira vez, o convidado transiciona sua propria membership INVITED -> ACTIVE.
create or replace function public.oris360_accept_invite()
returns void
language sql
security definer
set search_path to ''
as $$
  update public.memberships
  set status = 'ACTIVE'
  where user_id = (select auth.uid())
    and status = 'INVITED';
$$;
;
