-- Per-slot capacity: replaces the day-blocking model with realistic durations.
-- Duration is now caller-supplied (varies by home size + 30-min commute buffer),
-- so jobs no longer all overlap. A slot is blocked only when the count of
-- existing bookings whose [arrival, exit) overlaps the candidate window
-- [slot, slot+duration) reaches max_teams.

create or replace function slot_to_minutes(s text)
returns int
language plpgsql
immutable
as $$
declare
  parts text[];
  hour int;
  minute int;
  is_pm boolean;
begin
  if s is null then return null; end if;
  parts := regexp_match(lower(s), '^(\d+):(\d+)(am|pm)$');
  if parts is null then return null; end if;
  hour := parts[1]::int;
  minute := parts[2]::int;
  is_pm := parts[3] = 'pm';
  if is_pm and hour <> 12 then hour := hour + 12; end if;
  if not is_pm and hour = 12 then hour := 0; end if;
  return hour * 60 + minute;
end;
$$;

drop function if exists get_booked_slots(date);
drop function if exists get_booked_slots(date, int);

-- Returns the arrival slots that would exceed team capacity for a new booking
-- of the given duration on the given date.
create or replace function get_booked_slots(check_date date, duration_minutes int)
returns text[]
language plpgsql
security definer
stable
as $$
declare
  max_teams int;
  candidate text;
  candidates text[] := array['7:00am', '8:00am', '9:00am', '10:00am'];
  result text[] := array[]::text[];
  cand_start int;
  cand_end int;
  busy_count int;
begin
  select value::int into max_teams from settings where key = 'max_teams';
  if max_teams is null then max_teams := 5; end if;

  foreach candidate in array candidates loop
    cand_start := slot_to_minutes(candidate);
    cand_end := cand_start + duration_minutes;

    -- Each booking_requests row represents one team-day. The form writes
    -- single-element arrays for arrival/exit; we read element 1.
    select count(*) into busy_count
    from booking_requests br
    where br.preferred_date = check_date
      and array_length(br.preferred_arrival_times, 1) >= 1
      and array_length(br.preferred_exit_times, 1) >= 1
      and slot_to_minutes(br.preferred_arrival_times[1]) < cand_end
      and slot_to_minutes(br.preferred_exit_times[1]) > cand_start;

    if busy_count >= max_teams then
      result := array_append(result, candidate);
    end if;
  end loop;

  return result;
end;
$$;

grant execute on function get_booked_slots(date, int) to anon, authenticated;
