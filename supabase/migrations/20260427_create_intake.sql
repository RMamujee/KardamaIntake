CREATE TABLE IF NOT EXISTS intake_submissions (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  type                TEXT        NOT NULL CHECK (type IN ('cleaner', 'customer')),
  full_name           TEXT        NOT NULL,
  email               TEXT        NOT NULL,
  phone               TEXT        NOT NULL,
  city_zip            TEXT        NOT NULL,
  preferred_days      TEXT[]      NOT NULL,
  preferred_times     TEXT[]      NOT NULL,
  -- cleaner fields
  has_transportation  BOOLEAN,
  years_experience    TEXT,
  -- customer fields
  service_address     TEXT,
  home_size           TEXT,
  cleaning_frequency  TEXT,
  has_pets_allergies  TEXT,
  -- shared
  additional_notes    TEXT,
  calendar_event_id   TEXT,
  submitted_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE intake_submissions ENABLE ROW LEVEL SECURITY;

-- Only the edge function (service_role) can read/write
CREATE POLICY "service_role_all" ON intake_submissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
