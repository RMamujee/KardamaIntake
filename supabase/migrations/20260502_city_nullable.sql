-- city was populated from city_zip field which has been removed from the intake form.
-- Address now captures full location via Google Places autocomplete.
alter table booking_requests alter column city drop not null;
alter table booking_requests alter column city set default '';
