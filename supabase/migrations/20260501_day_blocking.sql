-- Since all jobs are 8 hours and arrivals are 7am–10am, every job overlaps with
-- every other job on the same day. Capacity is per-day, not per-slot.
-- When total bookings for a date >= max_teams, all slots are returned as blocked.
create or replace function get_booked_slots(check_date date)
returns text[]
language sql
security definer
stable
as $$
  select
    case
      when (
        select count(*)
        from booking_requests
        where preferred_date = check_date
      ) >= (select value::int from settings where key = 'max_teams')
      then array['7:00am', '8:00am', '9:00am', '10:00am']
      else array[]::text[]
    end
$$;
