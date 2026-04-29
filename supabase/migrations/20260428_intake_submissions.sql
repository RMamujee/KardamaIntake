create table booking_requests (
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
