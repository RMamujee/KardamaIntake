-- Store enriched property data fetched from RentCast at intake time.
-- Used for cleaning estimations and future property-aware features.
alter table booking_requests
  add column if not exists property_data jsonb;

-- Cache table so we don't re-hit RentCast for repeat addresses.
create table if not exists property_lookups (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  address    text not null unique,
  data       jsonb not null,
  source     text not null default 'rentcast'
);

create index if not exists idx_property_lookups_address on property_lookups (address);

alter table property_lookups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'property_lookups' and policyname = 'service_role_all'
  ) then
    create policy "service_role_all" on property_lookups
      for all to service_role using (true) with check (true);
  end if;
end$$;

notify pgrst, 'reload schema';
