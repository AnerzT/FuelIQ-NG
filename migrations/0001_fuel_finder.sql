CREATE TABLE IF NOT EXISTS fuel_finder_stations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  external_id text UNIQUE,
  name text NOT NULL,
  brand text NOT NULL,
  state text NOT NULL,
  city text NOT NULL,
  address text,
  latitude double precision,
  longitude double precision,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fuel_finder_prices (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  station_id text NOT NULL REFERENCES fuel_finder_stations(id) ON DELETE CASCADE,
  product_type text NOT NULL CHECK (product_type IN ('PMS', 'AGO', 'LPG')),
  price_naira double precision,
  availability text NOT NULL DEFAULT 'unknown'
    CHECK (availability IN ('available', 'limited', 'unavailable', 'unknown')),
  source text NOT NULL CHECK (source IN ('nnpc_api', 'admin_manual', 'community_report')),
  verification_status text NOT NULL DEFAULT 'manual'
    CHECK (verification_status IN ('verified', 'manual', 'reported')),
  observed_at timestamp NOT NULL,
  created_by text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fuel_finder_prices_station_product_observed_idx
  ON fuel_finder_prices (station_id, product_type, observed_at DESC);

CREATE TABLE IF NOT EXISTS fuel_finder_reports (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  station_id text NOT NULL REFERENCES fuel_finder_stations(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  product_type text NOT NULL CHECK (product_type IN ('PMS', 'AGO', 'LPG')),
  availability text NOT NULL CHECK (availability IN ('available', 'limited', 'unavailable')),
  price_naira double precision,
  comment text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamp NOT NULL DEFAULT now(),
  reviewed_at timestamp,
  reviewed_by text
);

CREATE INDEX IF NOT EXISTS fuel_finder_reports_status_submitted_idx
  ON fuel_finder_reports (status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS fuel_finder_alerts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  product_type text NOT NULL CHECK (product_type IN ('PMS', 'AGO', 'LPG')),
  state text NOT NULL,
  condition text NOT NULL CHECK (condition IN ('at_or_below', 'at_or_above')),
  threshold_naira double precision NOT NULL CHECK (threshold_naira > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  triggered_at timestamp
);

CREATE TABLE IF NOT EXISTS fuel_finder_alert_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  alert_id text NOT NULL REFERENCES fuel_finder_alerts(id) ON DELETE CASCADE,
  station_id text NOT NULL REFERENCES fuel_finder_stations(id) ON DELETE CASCADE,
  price_id text NOT NULL REFERENCES fuel_finder_prices(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  message text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  read_at timestamp
);

CREATE INDEX IF NOT EXISTS fuel_finder_alert_events_user_created_idx
  ON fuel_finder_alert_events (user_id, created_at DESC);
