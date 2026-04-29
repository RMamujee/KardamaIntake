-- Team capacity: change max_teams value to match your actual team count
create table if not exists settings (
  key   text primary key,
  value text not null
);
insert into settings (key, value) values ('max_teams', '3')
on conflict (key) do nothing;

-- Returns the time slots that are fully booked for a given date.
-- Uses SECURITY DEFINER so the anon role can call it without direct
-- access to booking_requests (which is protected by RLS).
create or replace function get_booked_slots(check_date date)
returns text[]
language sql
security definer
stable
as $$
  select coalesce(
    array_agg(slot order by slot),
    array[]::text[]
  )
  from (
    select
      unnest(preferred_arrival_times) as slot,
      count(*)                        as cnt
    from booking_requests
    where preferred_date = check_date
    group by slot
    having count(*) >= (
      select value::int from settings where key = 'max_teams'
    )
  ) t
$$;

grant execute on function get_booked_slots(date) to anon, authenticated;
