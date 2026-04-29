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
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  customer_code   text,
  bill_to_address text,
  ship_to_address text,
  country         text,
  state           text,
  postal_code     text,
  website         text,
  contact1_name   text,
  contact1_email  text,
  contact1_phone  text,
  contact2_name   text,
  contact2_email  text,
  contact2_phone  text,
  contact3_name   text,
  contact3_email  text,
  contact3_phone  text,
  is_approved     boolean default false,
  approved_date   date,
  remarks         text,
  company         text,
  created_at      timestamptz default now()
);

-- Migration: add new columns to customers_master if table already exists
alter table customers_master add column if not exists customer_code    text;
alter table customers_master add column if not exists bill_to_address  text;
alter table customers_master add column if not exists ship_to_address  text;
alter table customers_master add column if not exists is_approved      boolean default false;
alter table customers_master add column if not exists pending_approval    boolean default false;
alter table customers_master add column if not exists submitted_by        text;
alter table customers_master add column if not exists bill_to_country     text;
alter table customers_master add column if not exists bill_to_state       text;
alter table customers_master add column if not exists bill_to_city        text;
alter table customers_master add column if not exists bill_to_postal_code text;
alter table customers_master add column if not exists ship_to_country     text;
alter table customers_master add column if not exists ship_to_state       text;
alter table customers_master add column if not exists ship_to_city        text;
alter table customers_master add column if not exists ship_to_postal_code text;
alter table customers_master add column if not exists license_number      text;
alter table customers_master add column if not exists license_validity    date;

-- Vendor / Supplier Master
create table if not exists vendors_master (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  supplier_code       text,
  vat_number          text,
  bill_to_address     text,
  bill_to_country     text,
  bill_to_state       text,
  bill_to_city        text,
  bill_to_postal_code text,
  ship_to_address     text,
  ship_to_country     text,
  ship_to_state       text,
  ship_to_city        text,
  ship_to_postal_code text,
  website             text,
  contact1_name       text,
  contact1_email      text,
  contact1_phone      text,
  contact2_name       text,
  contact2_email      text,
  contact2_phone      text,
  contact3_name       text,
  contact3_email      text,
  contact3_phone      text,
  approved_date       date,
  valid_through       date,
  license_number      text,
  license_validity    date,
  remarks             text,
  company             text,
  created_at          timestamptz default now()
);

-- Migration: add new columns if vendors_master already exists
alter table vendors_master add column if not exists supplier_code       text;
alter table vendors_master add column if not exists vat_number          text;
alter table vendors_master add column if not exists bill_to_address     text;
alter table vendors_master add column if not exists bill_to_country     text;
alter table vendors_master add column if not exists bill_to_state       text;
alter table vendors_master add column if not exists bill_to_city        text;
alter table vendors_master add column if not exists bill_to_postal_code text;
alter table vendors_master add column if not exists ship_to_address     text;
alter table vendors_master add column if not exists ship_to_country     text;
alter table vendors_master add column if not exists ship_to_state       text;
alter table vendors_master add column if not exists ship_to_city        text;
alter table vendors_master add column if not exists ship_to_postal_code text;
alter table vendors_master add column if not exists website             text;
alter table vendors_master add column if not exists contact1_name       text;
alter table vendors_master add column if not exists contact1_email      text;
alter table vendors_master add column if not exists contact1_phone      text;
alter table vendors_master add column if not exists contact2_name       text;
alter table vendors_master add column if not exists contact2_email      text;
alter table vendors_master add column if not exists contact2_phone      text;
alter table vendors_master add column if not exists contact3_name       text;
alter table vendors_master add column if not exists contact3_email      text;
alter table vendors_master add column if not exists contact3_phone      text;
alter table vendors_master add column if not exists approved_date       date;
alter table vendors_master add column if not exists valid_through       date;
alter table vendors_master add column if not exists license_number      text;
alter table vendors_master add column if not exists license_validity    date;
alter table vendors_master add column if not exists remarks             text;

-- Product Master
create table if not exists products_master (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  product_code      text,
  pack_size         text,
  ndc_ma_code       text,
  country_of_origin text,
  remarks           text,
  company           text,
  created_at        timestamptz default now()
);

-- Migration: add new columns if products_master already exists
alter table products_master add column if not exists product_code      text;
alter table products_master add column if not exists pack_size         text;
alter table products_master add column if not exists country_of_origin text;
alter table products_master add column if not exists remarks           text;
alter table products_master add column if not exists manufacturer        text;
alter table products_master add column if not exists material_type       text;
alter table products_master add column if not exists hsn_code            text;
alter table products_master add column if not exists unit_of_measurement text;
alter table products_master add column if not exists pack_dimension      text;
alter table products_master add column if not exists pack_weight         text;

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

-- ============================================================
-- Employee Activity Audit Log
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ============================================================
create table if not exists audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_name   text not null,
  actor_role   text default 'employee',
  company      text not null,
  module       text not null,
  action       text not null,
  record_id    text,
  record_label text,
  details      jsonb default '{}',
  created_at   timestamptz default now()
);
create index if not exists audit_logs_company_idx on audit_logs(company);
create index if not exists audit_logs_actor_idx   on audit_logs(actor_name);
create index if not exists audit_logs_created_idx on audit_logs(created_at desc);
alter table audit_logs disable row level security;

-- ============================================================
-- Notifications
-- ============================================================
create table if not exists notifications (
  id             uuid primary key default gen_random_uuid(),
  recipient_name text not null,
  message        text not null,
  company        text,
  is_read        boolean default false,
  created_at     timestamptz default now()
);
create index if not exists notifications_recipient_idx on notifications(recipient_name);
create index if not exists notifications_created_idx   on notifications(created_at desc);
alter table notifications disable row level security;

-- Enable realtime for notifications (required for live updates)
-- Run separately if the above already exists:
-- alter publication supabase_realtime add table notifications;

-- ============================================================
-- Company Master – add separate wire routing column
-- ============================================================
alter table company_master add column if not exists bank_routing_wire text;
