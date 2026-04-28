create table intake_submissions (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  full_name          text not null,
  email              text not null,
  phone              text not null,
  city_zip           text not null,
  start_date         date not null,
  preferred_days     text[] not null,
  preferred_times    text[] not null,
  service_address    text not null,
  unit               text,
  home_size          text not null,
  cleaning_frequency text not null,
  has_pets_allergies text,
  additional_notes   text,
  calendar_event_id  text
);
