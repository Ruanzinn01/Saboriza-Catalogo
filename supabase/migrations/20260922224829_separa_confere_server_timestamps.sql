-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260922224829 · md5 normalizado 0b6b60a6cc6100639a87f9e8f0743bdd · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- Garante que os horários de separação vêm sempre do servidor, nunca do relógio do cliente
create or replace function public.set_separation_server_timestamps()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.separation_started_at is not null and old.separation_started_at is null then
    new.separation_started_at := now();
  end if;
  if new.separation_finished_at is not null and old.separation_finished_at is null then
    new.separation_finished_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_set_separation_server_timestamps
  before update on public.orders
  for each row
  execute function public.set_separation_server_timestamps();

create or replace function public.set_separated_at_server_time()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.separated_at is not null and old.separated_at is null then
    new.separated_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_set_separated_at_server_time
  before update on public.order_items
  for each row
  execute function public.set_separated_at_server_time();

create or replace function public.set_adjustment_resolved_at_server_time()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.resolved_at is not null and old.resolved_at is null then
    new.resolved_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_set_adjustment_resolved_at
  before update on public.order_adjustment_requests
  for each row
  execute function public.set_adjustment_resolved_at_server_time();
;
