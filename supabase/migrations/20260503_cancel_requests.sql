create table if not exists cancel_requests (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  customer_name      text not null,
  customer_email     text not null,
  customer_phone     text not null,
  original_date      date not null,
  action             text not null check (action in ('cancel', 'reschedule')),
  preferred_new_date date,
  preferred_new_time text,
  notes              text not null default '',
  source             text not null default 'intake-form'
);

alter table cancel_requests enable row level security;

create policy "service_role_all" on cancel_requests
  for all to service_role using (true) with check (true);
