-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260923194740 · md5 normalizado 72f841a408c692f25cad7de37be95d98 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.

create sequence public.delivery_er_seq;

create table public.delivery_er_reservations (
  er_code text primary key,
  order_id uuid not null references public.orders(id),
  reserved_at timestamptz not null default now(),
  reserved_by text not null,
  used_at timestamptz
);
create unique index delivery_er_one_open_per_order on public.delivery_er_reservations(order_id) where used_at is null;

create table public.order_deliveries (
  id uuid primary key default gen_random_uuid(),
  er_code text not null unique references public.delivery_er_reservations(er_code),
  order_id uuid not null references public.orders(id),
  result text not null check (result in ('COMPLETE','PARTIAL')),
  receiver_name text not null,
  receiver_doc_type text not null check (receiver_doc_type in ('CPF','RG')),
  receiver_doc text not null,
  receiver_role text,
  notes text,
  delivered_by text not null,
  delivered_at timestamptz not null,
  signature_path text not null,
  pdf_path text not null,
  total_not_delivered numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create unique index order_deliveries_one_per_order on public.order_deliveries(order_id);

create table public.order_delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.order_deliveries(id),
  order_item_id uuid not null references public.order_items(id),
  product_name text not null,
  presentation text not null default '',
  pack_quantity integer not null,
  packs_ordered integer not null,
  packs_not_delivered integer not null check (packs_not_delivered > 0),
  pack_price numeric(12,2) not null,
  value_not_delivered numeric(12,2) not null,
  value_delivered numeric(12,2) not null,
  reason text not null check (reason in ('missing','damaged','refused','quantity_mismatch','delivered_by_mistake','other')),
  reason_detail text,
  unique (delivery_id, order_item_id)
);

alter table public.orders add column delivery_result text check (delivery_result in ('COMPLETE','PARTIAL'));

alter table public.delivery_er_reservations enable row level security;
alter table public.order_deliveries enable row level security;
alter table public.order_delivery_items enable row level security;
create policy delivery_er_reservations_select on public.delivery_er_reservations for select to authenticated using (true);
create policy order_deliveries_select on public.order_deliveries for select to authenticated using (true);
create policy order_delivery_items_select on public.order_delivery_items for select to authenticated using (true);

create or replace function public.is_valid_cpf(p_cpf text)
returns boolean
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  d text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  s int; r int; i int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  s := 0;
  for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d, 10, 1)::int then return false; end if;
  s := 0;
  for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = substr(d, 11, 1)::int;
end;
$$;

create or replace function public.reserve_delivery_er(p_order_id uuid)
returns table (er_code text, reserved_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order public.orders;
  v_operator text;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v_order.status <> 'COMPLETED' or v_order.loading_finished_at is null or v_order.delivery_confirmed_at is not null then
    raise exception 'Pedido não está disponível para entrega';
  end if;

  return query select r.er_code, r.reserved_at from public.delivery_er_reservations r
    where r.order_id = p_order_id and r.used_at is null;
  if found then return; end if;

  v_operator := coalesce(auth.jwt() -> 'user_metadata' ->> 'name', auth.jwt() ->> 'email', 'Operador');
  v_code := 'ER-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.delivery_er_seq')::text, 6, '0');
  return query insert into public.delivery_er_reservations (er_code, order_id, reserved_by)
    values (v_code, p_order_id, v_operator) returning delivery_er_reservations.er_code, delivery_er_reservations.reserved_at;
end;
$$;

create or replace function public.finalize_delivery(
  p_order_id uuid,
  p_er_code text,
  p_result text,
  p_receiver_name text,
  p_doc_type text,
  p_doc text,
  p_role text,
  p_notes text,
  p_signature_path text,
  p_pdf_path text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order public.orders;
  v_res public.delivery_er_reservations;
  v_operator text;
  v_delivery_id uuid;
  v_item jsonb;
  v_row public.order_items;
  v_pack_price numeric(12,2);
  v_not_delivered int;
  v_line_total numeric(12,2);
  v_total_not numeric(12,2) := 0;
  v_seen uuid[] := '{}';
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if p_result not in ('COMPLETE','PARTIAL') then raise exception 'Resultado inválido'; end if;
  if p_doc_type not in ('CPF','RG') then raise exception 'Tipo de documento inválido'; end if;
  if length(trim(coalesce(p_receiver_name, ''))) < 3 then raise exception 'Informe o nome completo do recebedor'; end if;
  if p_doc_type = 'CPF' and not public.is_valid_cpf(p_doc) then raise exception 'CPF inválido'; end if;
  if p_doc_type = 'RG' and length(trim(coalesce(p_doc, ''))) < 4 then raise exception 'RG inválido'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v_order.status <> 'COMPLETED' or v_order.loading_finished_at is null or v_order.delivery_confirmed_at is not null then
    raise exception 'Pedido não está disponível para entrega';
  end if;

  select * into v_res from public.delivery_er_reservations where er_code = p_er_code for update;
  if not found or v_res.order_id <> p_order_id or v_res.used_at is not null then
    raise exception 'ER inválido ou já utilizado';
  end if;

  if p_pdf_path <> p_order_id::text || '/' || p_er_code || '.pdf' then raise exception 'Caminho do comprovante inválido'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'delivery-signatures' and name = p_signature_path) then
    raise exception 'Assinatura não encontrada no armazenamento';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'delivery-receipts' and name = p_pdf_path) then
    raise exception 'Comprovante PDF não encontrado no armazenamento';
  end if;

  if p_result = 'COMPLETE' and jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 0 then
    raise exception 'Entrega completa não admite divergências';
  end if;
  if p_result = 'PARTIAL' and jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Informe ao menos um produto divergente';
  end if;

  v_operator := coalesce(auth.jwt() -> 'user_metadata' ->> 'name', auth.jwt() ->> 'email', 'Operador');

  insert into public.order_deliveries (er_code, order_id, result, receiver_name, receiver_doc_type, receiver_doc, receiver_role, notes,
    delivered_by, delivered_at, signature_path, pdf_path)
  values (p_er_code, p_order_id, p_result, trim(p_receiver_name), p_doc_type, trim(p_doc), nullif(trim(coalesce(p_role, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''), v_operator, v_res.reserved_at, p_signature_path, p_pdf_path)
  returning id into v_delivery_id;

  if p_result = 'PARTIAL' then
    for v_item in select * from jsonb_array_elements(p_items) loop
      select * into v_row from public.order_items
        where id = (v_item ->> 'order_item_id')::uuid and order_id = p_order_id;
      if not found then raise exception 'Produto não pertence ao pedido'; end if;
      if v_row.id = any(v_seen) then raise exception 'Produto informado em duplicidade'; end if;
      v_seen := v_seen || v_row.id;
      v_not_delivered := (v_item ->> 'packs_not_delivered')::int;
      if v_not_delivered < 1 or v_not_delivered > v_row.packs_quantity then
        raise exception 'Quantidade divergente inválida para %', v_row.product_name;
      end if;
      if (v_item ->> 'reason') not in ('missing','damaged','refused','quantity_mismatch','delivered_by_mistake','other') then
        raise exception 'Motivo inválido';
      end if;
      if (v_item ->> 'reason') = 'other' and length(trim(coalesce(v_item ->> 'reason_detail', ''))) = 0 then
        raise exception 'Descreva o motivo para %', v_row.product_name;
      end if;
      v_pack_price := round(v_row.total_price / nullif(v_row.packs_quantity, 0), 2);
      v_line_total := v_pack_price * v_not_delivered;
      v_total_not := v_total_not + v_line_total;
      insert into public.order_delivery_items (delivery_id, order_item_id, product_name, presentation, pack_quantity, packs_ordered,
        packs_not_delivered, pack_price, value_not_delivered, value_delivered, reason, reason_detail)
      values (v_delivery_id, v_row.id, v_row.product_name, v_row.presentation, v_row.pack_quantity, v_row.packs_quantity,
        v_not_delivered, v_pack_price, v_line_total, v_pack_price * (v_row.packs_quantity - v_not_delivered),
        v_item ->> 'reason', nullif(trim(coalesce(v_item ->> 'reason_detail', '')), ''));
    end loop;
    update public.order_deliveries set total_not_delivered = v_total_not where id = v_delivery_id;
  end if;

  update public.delivery_er_reservations set used_at = now() where er_code = p_er_code;

  update public.orders set
    status = case when p_result = 'COMPLETE' then 'FINALIZADO'::public.order_status else status end,
    delivery_result = p_result,
    delivery_confirmed_at = now(),
    delivery_confirmed_by = v_operator,
    delivery_signature_url = p_signature_path
  where id = p_order_id;

  return v_delivery_id;
end;
$$;

revoke all on function public.reserve_delivery_er(uuid) from public, anon;
revoke all on function public.finalize_delivery(uuid, text, text, text, text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.reserve_delivery_er(uuid) to authenticated;
grant execute on function public.finalize_delivery(uuid, text, text, text, text, text, text, text, text, text, jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delivery-receipts', 'delivery-receipts', false, 5242880, array['application/pdf']);
create policy delivery_receipts_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'delivery-receipts');
create policy delivery_receipts_admin_select on storage.objects for select to authenticated using (bucket_id = 'delivery-receipts');
;
