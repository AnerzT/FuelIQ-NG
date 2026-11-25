-- Community reporting, customer verification, operator registration and price intelligence.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamp;

ALTER TABLE terminals ADD COLUMN IF NOT EXISTS lga text;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS physical_address text;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS owner_user_id text;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS operator_name text;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS business_email text;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS products_sold jsonb;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS business_registration_details text;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'not_applicable';
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS registration_submitted_at timestamp;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS approved_at timestamp;
ALTER TABLE terminals ADD COLUMN IF NOT EXISTS approved_by text;

ALTER TABLE fuel_finder_prices DROP CONSTRAINT IF EXISTS fuel_finder_prices_product_type_check;
ALTER TABLE fuel_finder_prices ADD CONSTRAINT fuel_finder_prices_product_type_check
  CHECK (product_type IN ('PMS', 'AGO', 'DPK', 'LPG'));
ALTER TABLE fuel_finder_reports DROP CONSTRAINT IF EXISTS fuel_finder_reports_product_type_check;
ALTER TABLE fuel_finder_reports ADD CONSTRAINT fuel_finder_reports_product_type_check
  CHECK (product_type IN ('PMS', 'AGO', 'DPK', 'LPG'));

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  customer_id text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  phone_verified boolean NOT NULL DEFAULT false,
  account_status text NOT NULL DEFAULT 'pending_approval'
    CHECK (account_status IN ('pending_approval', 'approved', 'rejected', 'suspended')),
  notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  last_login_at timestamp
);

CREATE TABLE IF NOT EXISTS customer_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  purpose text NOT NULL CHECK (purpose IN ('registration', 'password_reset', 'contact_change')),
  target text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamp NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_verifications_user_purpose_idx
  ON customer_verifications (user_id, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text NOT NULL,
  business_category text NOT NULL DEFAULT 'retail_filling_station'
    CHECK (business_category IN ('retail_filling_station', 'petroleum_depot', 'terminal', 'other')),
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  operator_name text NOT NULL,
  contact_phone text NOT NULL,
  business_email text NOT NULL,
  state text NOT NULL,
  lga text NOT NULL,
  city text NOT NULL,
  physical_address text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  products_sold jsonb NOT NULL CHECK (jsonb_typeof(products_sold) = 'array'),
  operating_status text NOT NULL DEFAULT 'unknown'
    CHECK (operating_status IN ('operating', 'temporarily_closed', 'closed', 'unknown')),
  business_registration_details text,
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended')),
  official_nnpc boolean NOT NULL DEFAULT false,
  official_source text,
  submitted_at timestamp NOT NULL DEFAULT now(),
  approved_at timestamp,
  approved_by text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CHECK (NOT official_nnpc OR official_source IN ('nnpc_api', 'nnpc_signed_feed'))
);
CREATE INDEX IF NOT EXISTS stations_owner_user_idx ON stations (owner_user_id, approval_status);
CREATE INDEX IF NOT EXISTS stations_location_idx ON stations (state, lga, city);

-- This table complements the legacy forecast-terminal table; public registrations remain UUID keyed.
CREATE TABLE IF NOT EXISTS registered_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text NOT NULL,
  business_category text NOT NULL DEFAULT 'petroleum_depot'
    CHECK (business_category IN ('retail_filling_station', 'petroleum_depot', 'terminal', 'other')),
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  operator_name text NOT NULL,
  contact_phone text NOT NULL,
  business_email text NOT NULL,
  state text NOT NULL,
  lga text NOT NULL,
  city text NOT NULL,
  physical_address text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  products_sold jsonb NOT NULL CHECK (jsonb_typeof(products_sold) = 'array'),
  operating_status text NOT NULL DEFAULT 'unknown'
    CHECK (operating_status IN ('operating', 'temporarily_closed', 'closed', 'unknown')),
  business_registration_details text,
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended')),
  submitted_at timestamp NOT NULL DEFAULT now(),
  approved_at timestamp,
  approved_by text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS registered_terminals_owner_user_idx
  ON registered_terminals (owner_user_id, approval_status);
CREATE INDEX IF NOT EXISTS registered_terminals_location_idx
  ON registered_terminals (state, lga, city);

CREATE TABLE IF NOT EXISTS station_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operator_role text NOT NULL DEFAULT 'manager' CHECK (operator_role IN ('owner', 'manager', 'staff')),
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  created_at timestamp NOT NULL DEFAULT now(),
  approved_at timestamp,
  UNIQUE (station_id, user_id)
);
CREATE INDEX IF NOT EXISTS station_operators_user_idx ON station_operators (user_id, approval_status);

CREATE TABLE IF NOT EXISTS fuel_types (
  code text PRIMARY KEY CHECK (code IN ('PMS', 'AGO', 'DPK', 'LPG')),
  label text NOT NULL,
  unit text NOT NULL CHECK (unit IN ('litre', 'kg')),
  active boolean NOT NULL DEFAULT true
);
INSERT INTO fuel_types (code, label, unit) VALUES
  ('PMS', 'Petrol', 'litre'),
  ('AGO', 'Diesel', 'litre'),
  ('DPK', 'Kerosene', 'litre'),
  ('LPG', 'Cooking gas', 'kg')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, unit = EXCLUDED.unit;

CREATE TABLE IF NOT EXISTS price_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  station_id uuid REFERENCES stations(id) ON DELETE SET NULL,
  terminal_id uuid REFERENCES registered_terminals(id) ON DELETE SET NULL,
  location_key text NOT NULL,
  location_name text NOT NULL,
  brand text NOT NULL,
  category text NOT NULL CHECK (category IN ('filling_station', 'terminal')),
  fuel_type text NOT NULL REFERENCES fuel_types(code),
  price_naira numeric(12, 2) NOT NULL CHECK (price_naira > 0 AND price_naira <= 1000000),
  unit text NOT NULL CHECK (unit IN ('litre', 'kg')),
  state text NOT NULL,
  lga text NOT NULL,
  city text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  observed_at timestamp NOT NULL,
  submitted_at timestamp NOT NULL DEFAULT now(),
  last_confirmed_at timestamp,
  availability text NOT NULL CHECK (availability IN ('available', 'limited', 'unavailable')),
  comments text,
  source_type text NOT NULL DEFAULT 'community'
    CHECK (source_type IN ('community', 'operator', 'admin', 'nnpc_authorized')),
  validation_status text NOT NULL DEFAULT 'eligible'
    CHECK (validation_status IN ('eligible', 'under_review', 'duplicate', 'rejected')),
  moderation_status text NOT NULL DEFAULT 'published'
    CHECK (moderation_status IN ('published', 'under_review', 'rejected', 'deleted')),
  validation_reasons jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(validation_reasons) = 'array'),
  reporting_period date NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CHECK (station_id IS NULL OR terminal_id IS NULL),
  UNIQUE (customer_user_id, location_key, fuel_type, reporting_period, source_type)
);
CREATE INDEX IF NOT EXISTS price_submissions_customer_period_idx
  ON price_submissions (customer_user_id, reporting_period DESC);
CREATE INDEX IF NOT EXISTS price_submissions_location_fuel_period_idx
  ON price_submissions (location_key, fuel_type, reporting_period DESC);
CREATE INDEX IF NOT EXISTS price_submissions_station_fuel_observed_idx
  ON price_submissions (station_id, fuel_type, observed_at DESC);
CREATE INDEX IF NOT EXISTS price_submissions_terminal_fuel_observed_idx
  ON price_submissions (terminal_id, fuel_type, observed_at DESC);

CREATE TABLE IF NOT EXISTS community_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES price_submissions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  confirmation text NOT NULL CHECK (confirmation IN ('accurate', 'inaccurate')),
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (submission_id, user_id)
);

CREATE TABLE IF NOT EXISTS customer_trust_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 50 CHECK (score BETWEEN 0 AND 100),
  accepted_reports integer NOT NULL DEFAULT 0 CHECK (accepted_reports >= 0),
  confirmed_reports integer NOT NULL DEFAULT 0 CHECK (confirmed_reports >= 0),
  disputed_reports integer NOT NULL DEFAULT 0 CHECK (disputed_reports >= 0),
  admin_decisions integer NOT NULL DEFAULT 0 CHECK (admin_decisions >= 0),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES price_submissions(id) ON DELETE CASCADE,
  reporter_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolution text,
  resolved_by text,
  created_at timestamp NOT NULL DEFAULT now(),
  resolved_at timestamp
);
CREATE INDEX IF NOT EXISTS price_disputes_submission_status_idx ON price_disputes (submission_id, status);

CREATE TABLE IF NOT EXISTS location_price_averages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('station', 'terminal', 'city', 'lga', 'state', 'national', 'brand', 'location')),
  aggregation_key text NOT NULL,
  fuel_type text NOT NULL REFERENCES fuel_types(code),
  source_type text NOT NULL DEFAULT 'community' CHECK (source_type = 'community'),
  reporting_period date NOT NULL,
  average_price numeric(12, 2) NOT NULL CHECK (average_price > 0),
  observation_count integer NOT NULL CHECK (observation_count > 0),
  independent_report_count integer NOT NULL CHECK (independent_report_count > 0),
  freshness_status text NOT NULL CHECK (freshness_status IN ('fresh', 'recent', 'stale', 'unconfirmed', 'under_review')),
  calculated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (scope, aggregation_key, fuel_type, source_type, reporting_period)
);
CREATE INDEX IF NOT EXISTS location_price_averages_scope_period_idx
  ON location_price_averages (scope, reporting_period DESC, fuel_type);

CREATE TABLE IF NOT EXISTS community_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES price_submissions(id) ON DELETE RESTRICT,
  price_naira numeric(12, 2) NOT NULL,
  source_type text NOT NULL,
  validation_status text NOT NULL,
  changed_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  changed_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_price_history_submission_changed_idx
  ON community_price_history (submission_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS customer_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_activity_logs_user_created_idx
  ON customer_activity_logs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_entity_created_idx
  ON admin_audit_logs (entity_type, entity_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.fuel_iq_current_user_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')
$$;
CREATE OR REPLACE FUNCTION public.fuel_iq_is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('request.jwt.claim.role', true) IN ('admin', 'service_role'), false)
$$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY profiles_read_self_or_admin ON profiles FOR SELECT
  USING (user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());
CREATE POLICY profiles_insert_self ON profiles FOR INSERT
  WITH CHECK (
    user_id = public.fuel_iq_current_user_id()
    AND account_status = 'pending_approval'
    AND email_verified = false
    AND phone_verified = false
  );
CREATE POLICY profiles_update_self_or_admin ON profiles FOR UPDATE
  USING (user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin())
  WITH CHECK (user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());

CREATE OR REPLACE FUNCTION public.protect_customer_profile() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.fuel_iq_is_admin() AND public.fuel_iq_current_user_id() = OLD.user_id THEN
    NEW.customer_id := OLD.customer_id;
    NEW.email_verified := OLD.email_verified;
    NEW.phone_verified := OLD.phone_verified;
    NEW.account_status := OLD.account_status;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_protect_privileged_fields ON profiles;
CREATE TRIGGER profiles_protect_privileged_fields
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_customer_profile();

CREATE OR REPLACE FUNCTION public.protect_registered_business() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.fuel_iq_is_admin() THEN
    NEW.owner_user_id := OLD.owner_user_id;
    NEW.approval_status := OLD.approval_status;
    NEW.approved_at := OLD.approved_at;
    NEW.approved_by := OLD.approved_by;
    IF TG_TABLE_NAME = 'stations' THEN
      NEW.official_nnpc := OLD.official_nnpc;
      NEW.official_source := OLD.official_source;
    END IF;
    NEW.submitted_at := OLD.submitted_at;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS stations_protect_verification ON stations;
CREATE TRIGGER stations_protect_verification BEFORE UPDATE ON stations
  FOR EACH ROW EXECUTE FUNCTION public.protect_registered_business();
DROP TRIGGER IF EXISTS registered_terminals_protect_verification ON registered_terminals;
CREATE TRIGGER registered_terminals_protect_verification BEFORE UPDATE ON registered_terminals
  FOR EACH ROW EXECUTE FUNCTION public.protect_registered_business();

ALTER TABLE customer_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_verifications FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_verifications_service_only ON customer_verifications FOR ALL
  USING (public.fuel_iq_is_admin()) WITH CHECK (public.fuel_iq_is_admin());

ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations FORCE ROW LEVEL SECURITY;
CREATE POLICY stations_public_or_owner_read ON stations FOR SELECT
  USING (approval_status = 'approved' OR owner_user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());
CREATE POLICY stations_verified_customer_insert ON stations FOR INSERT
  WITH CHECK (
    owner_user_id = public.fuel_iq_current_user_id()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = public.fuel_iq_current_user_id()
        AND (p.email_verified = true OR p.phone_verified = true) AND p.account_status = 'approved'
    )
  );
CREATE POLICY stations_owner_update ON stations FOR UPDATE
  USING (owner_user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin())
  WITH CHECK (owner_user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());

ALTER TABLE registered_terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE registered_terminals FORCE ROW LEVEL SECURITY;
CREATE POLICY registered_terminals_public_or_owner_read ON registered_terminals FOR SELECT
  USING (approval_status = 'approved' OR owner_user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());
CREATE POLICY registered_terminals_verified_customer_insert ON registered_terminals FOR INSERT
  WITH CHECK (
    owner_user_id = public.fuel_iq_current_user_id()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = public.fuel_iq_current_user_id()
        AND (p.email_verified = true OR p.phone_verified = true) AND p.account_status = 'approved'
    )
  );
CREATE POLICY registered_terminals_owner_update ON registered_terminals FOR UPDATE
  USING (owner_user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin())
  WITH CHECK (owner_user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());

ALTER TABLE station_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_operators FORCE ROW LEVEL SECURITY;
CREATE POLICY station_operators_self_or_admin_read ON station_operators FOR SELECT
  USING (user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());
CREATE POLICY station_operators_self_insert ON station_operators FOR INSERT
  WITH CHECK (user_id = public.fuel_iq_current_user_id());
CREATE POLICY station_operators_admin_update ON station_operators FOR UPDATE
  USING (public.fuel_iq_is_admin()) WITH CHECK (public.fuel_iq_is_admin());

ALTER TABLE price_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_submissions FORCE ROW LEVEL SECURITY;
CREATE POLICY price_submissions_public_or_owner_read ON price_submissions FOR SELECT
  USING (
    (validation_status = 'eligible' AND moderation_status = 'published')
    OR customer_user_id = public.fuel_iq_current_user_id()
    OR public.fuel_iq_is_admin()
  );
CREATE POLICY price_submissions_verified_customer_insert ON price_submissions FOR INSERT
  WITH CHECK (
    customer_user_id = public.fuel_iq_current_user_id()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = public.fuel_iq_current_user_id()
        AND (p.email_verified = true OR p.phone_verified = true) AND p.account_status = 'approved'
    )
  );
CREATE POLICY price_submissions_admin_update ON price_submissions FOR UPDATE
  USING (public.fuel_iq_is_admin()) WITH CHECK (public.fuel_iq_is_admin());
CREATE POLICY price_submissions_location_owner_read ON price_submissions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM stations st WHERE st.id = station_id AND st.owner_user_id = public.fuel_iq_current_user_id())
    OR EXISTS (SELECT 1 FROM registered_terminals rt WHERE rt.id = terminal_id AND rt.owner_user_id = public.fuel_iq_current_user_id())
  );

ALTER TABLE community_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_confirmations FORCE ROW LEVEL SECURITY;
CREATE POLICY community_confirmations_self_read ON community_confirmations FOR SELECT
  USING (user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());
CREATE POLICY community_confirmations_verified_insert ON community_confirmations FOR INSERT
  WITH CHECK (
    user_id = public.fuel_iq_current_user_id()
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = public.fuel_iq_current_user_id()
        AND (p.email_verified = true OR p.phone_verified = true) AND p.account_status = 'approved'
    )
  );
CREATE POLICY community_confirmations_self_update ON community_confirmations FOR UPDATE
  USING (user_id = public.fuel_iq_current_user_id())
  WITH CHECK (user_id = public.fuel_iq_current_user_id());

ALTER TABLE customer_trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_trust_scores FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_trust_scores_self_read ON customer_trust_scores FOR SELECT
  USING (user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());
CREATE POLICY customer_trust_scores_admin_write ON customer_trust_scores FOR ALL
  USING (public.fuel_iq_is_admin()) WITH CHECK (public.fuel_iq_is_admin());

ALTER TABLE price_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_disputes FORCE ROW LEVEL SECURITY;
CREATE POLICY price_disputes_reporter_or_admin_read ON price_disputes FOR SELECT
  USING (reporter_user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());
CREATE POLICY price_disputes_verified_insert ON price_disputes FOR INSERT
  WITH CHECK (
    reporter_user_id = public.fuel_iq_current_user_id()
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.user_id = public.fuel_iq_current_user_id()
        AND (p.email_verified = true OR p.phone_verified = true) AND p.account_status = 'approved'
    )
  );
CREATE POLICY price_disputes_admin_update ON price_disputes FOR UPDATE
  USING (public.fuel_iq_is_admin()) WITH CHECK (public.fuel_iq_is_admin());

ALTER TABLE location_price_averages ENABLE ROW LEVEL SECURITY;
CREATE POLICY location_price_averages_public_read ON location_price_averages FOR SELECT USING (true);

ALTER TABLE community_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_price_history FORCE ROW LEVEL SECURITY;
CREATE POLICY community_price_history_owner_or_admin_read ON community_price_history FOR SELECT
  USING (
    public.fuel_iq_is_admin()
    OR EXISTS (
      SELECT 1 FROM price_submissions s
      WHERE s.id = submission_id AND s.customer_user_id = public.fuel_iq_current_user_id()
    )
  );

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY notifications_self_read ON notifications FOR SELECT
  USING (user_id = public.fuel_iq_current_user_id());
CREATE POLICY notifications_self_update ON notifications FOR UPDATE
  USING (user_id = public.fuel_iq_current_user_id())
  WITH CHECK (user_id = public.fuel_iq_current_user_id());
CREATE POLICY notifications_admin_insert ON notifications FOR INSERT
  WITH CHECK (public.fuel_iq_is_admin());

ALTER TABLE customer_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_activity_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_activity_logs_self_read ON customer_activity_logs FOR SELECT
  USING (user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());
CREATE POLICY customer_activity_logs_admin_insert ON customer_activity_logs FOR INSERT
  WITH CHECK (public.fuel_iq_is_admin());

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_audit_logs_admin_read ON admin_audit_logs FOR SELECT
  USING (public.fuel_iq_is_admin());
CREATE POLICY admin_audit_logs_admin_insert ON admin_audit_logs FOR INSERT
  WITH CHECK (public.fuel_iq_is_admin());

CREATE OR REPLACE FUNCTION public.refresh_location_price_averages(p_fuel_type text, p_period date)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_fuel_type || ':' || p_period::text));
  DELETE FROM location_price_averages
  WHERE fuel_type = p_fuel_type AND reporting_period = p_period;

  INSERT INTO location_price_averages
    (scope, aggregation_key, fuel_type, source_type, reporting_period, average_price, observation_count, independent_report_count, freshness_status, calculated_at)
  WITH eligible AS (
    SELECT s.*, COALESCE(s.last_confirmed_at, s.submitted_at) AS freshness_at
    FROM price_submissions s
    WHERE s.fuel_type = p_fuel_type
      AND s.reporting_period = p_period
      AND s.validation_status = 'eligible'
      AND s.moderation_status = 'published'
      AND s.source_type = 'community'
  ), grouped AS (
    SELECT 'station'::text AS scope, COALESCE('station:' || station_id::text, 'location:' || location_key) AS aggregation_key,
      AVG(price_naira) AS average_price, COUNT(*)::integer AS observation_count,
      COUNT(DISTINCT customer_user_id)::integer AS independent_report_count, MAX(freshness_at) AS latest_at
      FROM eligible WHERE category = 'filling_station'
      GROUP BY COALESCE('station:' || station_id::text, 'location:' || location_key)
    UNION ALL
    SELECT 'terminal', COALESCE('terminal:' || terminal_id::text, 'location:' || location_key), AVG(price_naira), COUNT(*)::integer,
      COUNT(DISTINCT customer_user_id)::integer, MAX(freshness_at)
      FROM eligible WHERE category = 'terminal'
      GROUP BY COALESCE('terminal:' || terminal_id::text, 'location:' || location_key)
    UNION ALL
    SELECT 'city', 'city:' || category || '|' || lower(state) || '|' || lower(lga) || '|' || lower(city), AVG(price_naira), COUNT(*)::integer,
      COUNT(DISTINCT customer_user_id)::integer, MAX(freshness_at)
      FROM eligible GROUP BY category, lower(state), lower(lga), lower(city)
    UNION ALL
    SELECT 'lga', 'lga:' || category || '|' || lower(state) || '|' || lower(lga), AVG(price_naira), COUNT(*)::integer,
      COUNT(DISTINCT customer_user_id)::integer, MAX(freshness_at)
      FROM eligible GROUP BY category, lower(state), lower(lga)
    UNION ALL
    SELECT 'state', 'state:' || category || '|' || lower(state), AVG(price_naira), COUNT(*)::integer,
      COUNT(DISTINCT customer_user_id)::integer, MAX(freshness_at)
      FROM eligible GROUP BY category, lower(state)
    UNION ALL
    SELECT 'national', 'national:' || category, AVG(price_naira), COUNT(*)::integer,
      COUNT(DISTINCT customer_user_id)::integer, MAX(freshness_at)
      FROM eligible GROUP BY category
    UNION ALL
    SELECT 'brand', 'brand:' || category || '|' || lower(brand), AVG(price_naira), COUNT(*)::integer,
      COUNT(DISTINCT customer_user_id)::integer, MAX(freshness_at)
      FROM eligible GROUP BY category, lower(brand)
  )
  SELECT scope, aggregation_key, p_fuel_type, 'community', p_period, ROUND(average_price, 2), observation_count,
    independent_report_count,
    CASE
      WHEN independent_report_count < 2 THEN 'unconfirmed'
      WHEN now() - latest_at <= interval '24 hours' THEN 'fresh'
      WHEN now() - latest_at <= interval '72 hours' THEN 'recent'
      ELSE 'stale'
    END,
    now()
  FROM grouped
  WHERE observation_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_price_averages_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.fuel_type IS DISTINCT FROM NEW.fuel_type
    OR OLD.reporting_period IS DISTINCT FROM NEW.reporting_period
  ) THEN
    PERFORM public.refresh_location_price_averages(OLD.fuel_type, OLD.reporting_period);
  END IF;
  PERFORM public.refresh_location_price_averages(NEW.fuel_type, NEW.reporting_period);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS price_submissions_refresh_averages ON price_submissions;
CREATE TRIGGER price_submissions_refresh_averages
AFTER INSERT OR UPDATE OF validation_status, moderation_status, fuel_type, reporting_period, price_naira, last_confirmed_at
ON price_submissions
FOR EACH ROW EXECUTE FUNCTION public.refresh_price_averages_trigger();
