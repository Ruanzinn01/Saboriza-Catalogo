-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260922195533 · md5 normalizado 024c234d7e8a8477de9aab8a34c52f9e · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- Separa Confere: colunas de controle de separação em orders
alter table public.orders
  add column separation_queued_at timestamptz,
  add column separation_started_at timestamptz,
  add column separation_finished_at timestamptz,
  add column separation_responsible text,
  add column separation_started_by text,
  add column separation_completed_by text;

-- Marca automaticamente o início da fila de separação quando o pedido vira CONFIRMED
create or replace function public.set_separation_queued_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'CONFIRMED' and old.status is distinct from 'CONFIRMED' and new.separation_queued_at is null then
    new.separation_queued_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_set_separation_queued_at
  before update on public.orders
  for each row
  execute function public.set_separation_queued_at();

-- Separa Confere: confirmação de separação por item do pedido
alter table public.order_items
  add column separated_at timestamptz;

-- Separa Confere: solicitações de ajuste (divergência encontrada na separação)
create table public.order_adjustment_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete cascade,
  message text not null,
  status text not null default 'pending' check (status = any (array['pending', 'resolved'])),
  created_by text,
  resolved_by text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.order_adjustment_requests enable row level security;

create policy order_adjustment_requests_admin_select_all
  on public.order_adjustment_requests for select
  to authenticated
  using (true);

create policy order_adjustment_requests_admin_insert
  on public.order_adjustment_requests for insert
  to authenticated
  with check (true);

create policy order_adjustment_requests_admin_update
  on public.order_adjustment_requests for update
  to authenticated
  using (true)
  with check (true);
;
