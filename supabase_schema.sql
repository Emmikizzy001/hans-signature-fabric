-- Drop tables if they exist to allow clean recreation
drop table if exists public.orders;
drop table if exists public.products;
drop table if exists public.settings;

-- Create products table
create table public.products (
  id text primary key,
  name text not null,
  category text not null,
  price integer not null default 0,
  stock integer not null default 0,
  min_yards integer not null default 3,
  image text not null,
  images jsonb not null default '[]'::jsonb,
  palette text not null default '',
  description text not null default '',
  tag text not null default 'New arrival'
);

-- Create orders table
create table public.orders (
  id text primary key,
  reference text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  customer jsonb not null,
  items jsonb not null,
  subtotal integer not null default 0,
  delivery_fee integer not null default 0,
  total integer not null default 0,
  status text not null default 'New'
);

-- Create settings table
create table public.settings (
  key text primary key,
  value text not null
);

-- Set default hero image
insert into public.settings (key, value)
values ('heroImage', '/images/hans-hero.jpg')
on conflict (key) do update set value = excluded.value;

-- Enable Row Level Security (optional but recommended for Supabase)
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.settings enable row level security;

-- Create policies to allow all access (since we are handling auth via JS)
create policy "Allow all access to products" on public.products for all using (true);
create policy "Allow all access to orders" on public.orders for all using (true);
create policy "Allow all access to settings" on public.settings for all using (true);
