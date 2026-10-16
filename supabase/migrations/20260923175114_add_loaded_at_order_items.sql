-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260923175114 · md5 normalizado 07cd8580f78850574b42960d42b49c60 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
alter table public.order_items add column loaded_at timestamptz;

-- Mesmo princípio do separated_at: servidor é sempre a fonte do horário
create or replace function public.set_loaded_at_server_time()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.loaded_at is not null and old.loaded_at is null then
    new.loaded_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_set_loaded_at_server_time
  before update on public.order_items
  for each row
  execute function public.set_loaded_at_server_time();
