-- ============================================================
-- JRS GPMS – Database Setup
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Inquiries table (replaces the old customers table for inquiry tracking)
create table if not exists inquiries (
  id               uuid primary key default gen_random_uuid(),
  customer         text,
  account_manager  text,
  status           text default 'Lead',
  date_added       date default current_date,
  sourcing_country text,
  product          text,
  ndc_ma_code      text,
  manufacturer     text,
  quantity         numeric,
  currency         text default 'USD',
  quote_price      numeric,
  purchase_price   numeric,
  supplier         text,
  company          text,
  created_at       timestamptz default now()
);

-- Customer Master
create table if not exists customers_master (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  company    text,
  created_at timestamptz default now()
);

-- Vendor Master
create table if not exists vendors_master (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  company    text,
  created_at timestamptz default now()
);

-- Product Master
create table if not exists products_master (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  ndc_ma_code  text,
  manufacturer text,
  company      text,
  created_at   timestamptz default now()
);

-- Storage Master
create table if not exists storage_master (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  location   text,
  company    text,
  created_at timestamptz default now()
);

-- ============================================================
-- IMPORTANT: Disable Row Level Security on all new tables
-- Supabase enables RLS by default on tables created via SQL,
-- which blocks all reads/writes with the anon key.
-- Run these if you see "permission denied" or data not saving.
-- ============================================================
alter table inquiries        disable row level security;
alter table customers_master disable row level security;
alter table vendors_master   disable row level security;
alter table products_master  disable row level security;
alter table storage_master   disable row level security;

-- Optional: drop the old customers table after confirming you don't need its data
-- drop table if exists customers;
