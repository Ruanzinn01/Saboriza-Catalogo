-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260923171210 · md5 normalizado 3539febf0ddc4fd15059a938da027062 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- Carrega Entrega: colunas de controle de carregamento (mesmo padrão de separation_*)
alter table public.orders
  add column loading_queued_at timestamptz,
  add column loading_started_at timestamptz,
  add column loading_finished_at timestamptz,
  add column loading_responsible text,
  add column loading_started_by text,
  add column loading_completed_by text,
  add column delivery_confirmed_at timestamptz,
  add column delivery_confirmed_by text,
  add column delivery_signature_url text;

-- Marca automaticamente a entrada na fila de carregamento quando o pedido vira COMPLETED (Faturado)
create or replace function public.set_loading_queued_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED' and new.loading_queued_at is null then
    new.loading_queued_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_set_loading_queued_at
  before update on public.orders
  for each row
  execute function public.set_loading_queued_at();

-- Garante que os horários de carregamento/entrega vêm sempre do servidor
create or replace function public.set_fulfillment_server_timestamps()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.loading_started_at is not null and old.loading_started_at is null then
    new.loading_started_at := now();
  end if;
  if new.loading_finished_at is not null and old.loading_finished_at is null then
    new.loading_finished_at := now();
  end if;
  if new.delivery_confirmed_at is not null and old.delivery_confirmed_at is null then
    new.delivery_confirmed_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_set_fulfillment_server_timestamps
  before update on public.orders
  for each row
  execute function public.set_fulfillment_server_timestamps();

-- Bucket privado pra assinatura de comprovante de entrega
insert into storage.buckets (id, name, public)
values ('delivery-signatures', 'delivery-signatures', false);

create policy delivery_signatures_admin_select
  on storage.objects for select
  to authenticated
  using (bucket_id = 'delivery-signatures');

create policy delivery_signatures_admin_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'delivery-signatures');

create policy delivery_signatures_admin_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'delivery-signatures');
;
