-- Idempotent repair: ensure cancel_requests exists in case the prior migration
-- was interrupted, then reload the PostgREST schema cache.
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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'cancel_requests' and policyname = 'service_role_all'
  ) then
    create policy "service_role_all" on cancel_requests
      for all to service_role using (true) with check (true);
  end if;
end$$;

-- Ensure booking_requests RLS is tight: only service_role can read/write.
-- (anon can call get_booked_slots via SECURITY DEFINER — no direct table access needed)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'booking_requests' and policyname = 'deny_anon'
  ) then
    create policy "deny_anon" on booking_requests
      as restrictive
      for select to anon using (false);
  end if;
end$$;

-- Reload PostgREST schema cache so all tables are visible immediately.
notify pgrst, 'reload schema';
