create table if not exists booking_requests (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),

  -- Contact
  customer_name           text not null,
  customer_email          text not null,
  customer_phone          text not null,
  city                    text not null,

  -- Scheduling
  preferred_date          date not null,
  preferred_days          text[] not null default '{}',
  preferred_arrival_times text[] not null default '{}',
  preferred_exit_times    text[] not null default '{}',

  -- Property
  address                 text not null,
  unit                    text,
  home_size               text not null,
  cleaning_frequency      text not null,

  -- Payment
  payment_method          text,

  -- Extra
  has_pets_allergies      text,
  notes                   text not null default '',
  source                  text not null default 'intake-form',
  calendar_event_id       text
);

-- Add any columns that may not yet exist (safe to re-run)
alter table booking_requests add column if not exists payment_method          text;
alter table booking_requests add column if not exists preferred_arrival_times text[];
alter table booking_requests add column if not exists preferred_exit_times    text[];
alter table booking_requests add column if not exists calendar_event_id       text;
alter table booking_requests add column if not exists source                  text;

alter table booking_requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'booking_requests' and policyname = 'service_role_all'
  ) then
    create policy "service_role_all" on booking_requests
      for all to service_role using (true) with check (true);
  end if;
end$$;
