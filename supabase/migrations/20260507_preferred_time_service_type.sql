-- Add columns used by the kardama-ai /api/intake route.
-- preferred_time: single 24h arrival time (e.g. '08:00') written by the Next.js backend.
-- service_type: cleaning type (standard, deep, move-out, airbnb).
alter table booking_requests add column if not exists preferred_time text;
alter table booking_requests add column if not exists service_type   text;
