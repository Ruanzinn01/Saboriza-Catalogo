-- Reconstruída do histórico real do banco (supabase_migrations.schema_migrations).
-- versão 20260909232045 · md5 normalizado ee2132cf43d83a2d01a067d88b898ef3 · 1 instrução(ões)
-- Preserva o SQL exatamente como foi aplicado; não editar. Correções entram em migração nova.
-- 001_initial_schema.sql
create extension if not exists pgcrypto;

create type public.order_status as enum ('NEW', 'IN_REVIEW', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

create sequence public.order_number_seq start 1;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ categories ============
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tagline text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create index categories_is_active_idx on public.categories (is_active);
create index categories_sort_order_idx on public.categories (sort_order);

-- ============ products ============
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  description text not null default '',
  image_url text not null default '',
  presentation text not null,
  weight_volume text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  pack_quantity integer not null check (pack_quantity > 0),
  packaging_type text not null check (packaging_type in ('Fardo','Caixa','Pacote','Kit','Outro')),
  badge text check (badge in ('mais-pedido','novidade','destaque')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create index products_category_id_idx on public.products (category_id);
create index products_is_active_idx on public.products (is_active);

-- ============ orders ============
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique
    default ('#' || lpad(nextval('public.order_number_seq')::text, 4, '0')),
  customer_name text not null,
  company_name text not null default '',
  phone text not null,
  total_amount numeric(10,2) not null default 0 check (total_amount >= 0),
  total_units integer not null default 0 check (total_units >= 0),
  status public.order_status not null default 'NEW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create index orders_status_idx on public.orders (status);
create index orders_created_at_idx on public.orders (created_at desc);

-- ============ order_items (snapshot imutável) ============
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  presentation text not null,
  weight_volume text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  pack_quantity integer not null check (pack_quantity > 0),
  packs_quantity integer not null check (packs_quantity > 0),
  total_units integer not null check (total_units > 0),
  total_price numeric(10,2) not null check (total_price >= 0),
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);
;
