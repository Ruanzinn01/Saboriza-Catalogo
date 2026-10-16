-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260909232153 · md5 normalizado 17dd5982cbc5d2779d9a816df8ced8b1 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
;
