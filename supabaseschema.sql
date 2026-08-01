-- ============================================================
-- RENI Tech Services — Supabase schema setup
-- Run this once in Supabase Dashboard > SQL Editor > New query
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- CONTACTS (from the site's contact form) ----------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text,
  status text not null default 'new', -- new | contacted | closed
  created_at timestamptz not null default now()
);

-- ---------- ORDERS (from the "Request Exact Quote" flow) ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  services jsonb not null,       -- e.g. ["Website / Desktop App", "SEO"]
  estimate_low integer not null,
  estimate_high integer not null,
  notes text,
  status text not null default 'new', -- new | reviewing | quoted | closed
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table public.contacts enable row level security;
alter table public.orders enable row level security;

-- Anyone (site visitors, via the anon key) can submit a contact/order
create policy "Public can insert contacts"
  on public.contacts for insert
  to anon
  with check (true);

create policy "Public can insert orders"
  on public.orders for insert
  to anon
  with check (true);

-- Only logged-in admin users (Supabase Auth) can read/update/delete
create policy "Authenticated can read contacts"
  on public.contacts for select
  to authenticated
  using (true);

create policy "Authenticated can update contacts"
  on public.contacts for update
  to authenticated
  using (true);

create policy "Authenticated can delete contacts"
  on public.contacts for delete
  to authenticated
  using (true);

create policy "Authenticated can read orders"
  on public.orders for select
  to authenticated
  using (true);

create policy "Authenticated can update orders"
  on public.orders for update
  to authenticated
  using (true);

create policy "Authenticated can delete orders"
  on public.orders for delete
  to authenticated
  using (true);

-- ---------- Helpful indexes ----------
create index if not exists contacts_created_at_idx on public.contacts (created_at desc);
create index if not exists orders_created_at_idx on public.orders (created_at desc);