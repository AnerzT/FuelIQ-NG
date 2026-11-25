CREATE TABLE IF NOT EXISTS marketplace_categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO marketplace_categories (id, name, description) VALUES
  ('fuel_supply', 'Fuel supply', 'Retail, wholesale and bulk fuel offers'),
  ('distribution', 'Distribution', 'Fuel distribution opportunities'),
  ('station_partnership', 'Station partnership', 'Filling station partnership opportunities'),
  ('transport_logistics', 'Transport & logistics', 'Fuel transportation and logistics services'),
  ('storage_terminal', 'Storage & terminals', 'Storage, depot and terminal services'),
  ('procurement', 'Procurement request', 'Buyer requests for fuel and related services'),
  ('business_enquiry', 'Business enquiry', 'Wholesale, retail and other business enquiries')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS business_preferences (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  roles text[] NOT NULL DEFAULT '{}',
  products_supply text[] NOT NULL DEFAULT '{}',
  products_need text[] NOT NULL DEFAULT '{}',
  preferred_states text[] NOT NULL DEFAULT '{}',
  min_quantity numeric(16, 2) CHECK (min_quantity IS NULL OR min_quantity >= 0),
  max_quantity numeric(16, 2) CHECK (max_quantity IS NULL OR max_quantity >= 0),
  min_price numeric(14, 2) CHECK (min_price IS NULL OR min_price >= 0),
  max_price numeric(14, 2) CHECK (max_price IS NULL OR max_price >= 0),
  delivery_required boolean NOT NULL DEFAULT false,
  marketplace_notifications_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (max_quantity IS NULL OR min_quantity IS NULL OR max_quantity >= min_quantity),
  CHECK (max_price IS NULL OR min_price IS NULL OR max_price >= min_price)
);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 5 AND 180),
  description text NOT NULL CHECK (length(description) BETWEEN 10 AND 5000),
  category_id text NOT NULL REFERENCES marketplace_categories(id),
  listing_type text NOT NULL DEFAULT 'supply' CHECK (listing_type IN ('supply', 'service')),
  product_type text CHECK (product_type IS NULL OR product_type IN ('PMS', 'AGO', 'DPK', 'LPG')),
  quantity numeric(16, 2) CHECK (quantity IS NULL OR quantity > 0),
  unit text NOT NULL DEFAULT 'litres' CHECK (length(unit) <= 40),
  price numeric(14, 2) CHECK (price IS NULL OR price > 0),
  minimum_order numeric(16, 2) CHECK (minimum_order IS NULL OR minimum_order > 0),
  state text,
  lga text,
  city text,
  delivery_available boolean NOT NULL DEFAULT false,
  collection_available boolean NOT NULL DEFAULT false,
  availability text NOT NULL DEFAULT 'available' CHECK (availability IN ('available', 'limited', 'unavailable')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'sold', 'archived', 'pending_review', 'rejected')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (listing_type <> 'supply' OR product_type IS NOT NULL),
  CHECK (minimum_order IS NULL OR quantity IS NULL OR minimum_order <= quantity)
);
CREATE INDEX IF NOT EXISTS marketplace_listings_search_idx
  ON marketplace_listings (status, product_type, state, price, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_listings_owner_idx
  ON marketplace_listings (owner_user_id, status, expires_at);

CREATE OR REPLACE FUNCTION public.marketplace_guard_listing_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.fuel_iq_is_admin()
    AND (OLD.status IN ('rejected', 'pending_review') OR NEW.status IN ('rejected', 'pending_review')) THEN
    RAISE EXCEPTION 'Only an administrator can review a listing';
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS marketplace_listing_status_guard ON marketplace_listings;
CREATE TRIGGER marketplace_listing_status_guard BEFORE UPDATE OF status ON marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_guard_listing_status();

CREATE OR REPLACE FUNCTION public.marketplace_guard_offer_update() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE request_owner text;
BEGIN
  IF NEW.request_id IS DISTINCT FROM OLD.request_id
    OR NEW.listing_id IS DISTINCT FROM OLD.listing_id
    OR NEW.supplier_user_id IS DISTINCT FROM OLD.supplier_user_id
    OR NEW.offered_product IS DISTINCT FROM OLD.offered_product
    OR NEW.quantity IS DISTINCT FROM OLD.quantity
    OR NEW.price IS DISTINCT FROM OLD.price
    OR NEW.delivery_terms IS DISTINCT FROM OLD.delivery_terms
    OR NEW.location IS DISTINCT FROM OLD.location
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR NEW.conditions IS DISTINCT FROM OLD.conditions
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Supplier offer terms cannot be changed after submission';
  END IF;
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending offers can be changed';
  END IF;
  SELECT buyer_user_id INTO request_owner FROM buyer_requests WHERE id = OLD.request_id;
  IF public.fuel_iq_is_admin() THEN
    RETURN NEW;
  ELSIF public.fuel_iq_current_user_id() = OLD.supplier_user_id AND NEW.status = 'withdrawn' THEN
    RETURN NEW;
  ELSIF public.fuel_iq_current_user_id() = request_owner AND NEW.status IN ('accepted', 'declined') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Invalid supplier offer transition';
END
$$;
DROP TRIGGER IF EXISTS supplier_offers_guard_update ON supplier_offers;
CREATE TRIGGER supplier_offers_guard_update BEFORE UPDATE ON supplier_offers
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_guard_offer_update();

CREATE TABLE IF NOT EXISTS buyer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 5 AND 180),
  product_type text NOT NULL CHECK (product_type IN ('PMS', 'AGO', 'DPK', 'LPG')),
  quantity numeric(16, 2) NOT NULL CHECK (quantity > 0),
  target_price_min numeric(14, 2) CHECK (target_price_min IS NULL OR target_price_min > 0),
  target_price_max numeric(14, 2) CHECK (target_price_max IS NULL OR target_price_max > 0),
  state text NOT NULL,
  lga text,
  city text,
  delivery_required boolean NOT NULL DEFAULT false,
  required_delivery_date date,
  requirements text CHECK (requirements IS NULL OR length(requirements) <= 3000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paused', 'filled', 'closed', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (target_price_max IS NULL OR target_price_min IS NULL OR target_price_max >= target_price_min)
);
CREATE INDEX IF NOT EXISTS buyer_requests_search_idx
  ON buyer_requests (status, product_type, state, created_at DESC);
CREATE INDEX IF NOT EXISTS buyer_requests_owner_idx ON buyer_requests (buyer_user_id, status, expires_at);

CREATE TABLE IF NOT EXISTS supplier_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES buyer_requests(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  supplier_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offered_product text NOT NULL CHECK (offered_product IN ('PMS', 'AGO', 'DPK', 'LPG')),
  quantity numeric(16, 2) NOT NULL CHECK (quantity > 0),
  price numeric(14, 2) NOT NULL CHECK (price > 0),
  delivery_terms text NOT NULL CHECK (length(delivery_terms) BETWEEN 2 AND 1000),
  location text NOT NULL CHECK (length(location) <= 300),
  expires_at timestamptz NOT NULL,
  conditions text CHECK (conditions IS NULL OR length(conditions) <= 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS supplier_offers_request_idx ON supplier_offers (request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS supplier_offers_supplier_idx ON supplier_offers (supplier_user_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS supplier_offers_one_pending_per_request_supplier_idx
  ON supplier_offers (request_id, supplier_user_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS business_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplier_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id uuid REFERENCES buyer_requests(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  score numeric(6, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
  reasons text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_user_id <> supplier_user_id),
  CHECK (request_id IS NOT NULL OR listing_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS business_matches_request_supplier_idx
  ON business_matches (request_id, supplier_user_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS business_matches_buyer_listing_idx
  ON business_matches (buyer_user_id, listing_id) WHERE listing_id IS NOT NULL AND request_id IS NULL;

CREATE TABLE IF NOT EXISTS marketplace_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  request_id uuid REFERENCES buyer_requests(id) ON DELETE SET NULL,
  sender_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (length(message) BETWEEN 2 AND 3000),
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'responded', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_user_id <> recipient_user_id),
  CHECK (listing_id IS NOT NULL OR request_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS marketplace_enquiries_recipient_idx
  ON marketplace_enquiries (recipient_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL UNIQUE REFERENCES supplier_offers(id) ON DELETE RESTRICT,
  buyer_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  supplier_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'offer_accepted' CHECK (status IN ('offer_accepted', 'completed', 'cancelled', 'disputed')),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_user_id <> supplier_user_id)
);

CREATE TABLE IF NOT EXISTS listing_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  reporter_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by text REFERENCES users(id) ON DELETE SET NULL,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (listing_id, reporter_user_id)
);
CREATE INDEX IF NOT EXISTS listing_reports_status_idx ON listing_reports (status, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  listing_id uuid REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  request_id uuid REFERENCES buyer_requests(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES supplier_offers(id) ON DELETE CASCADE,
  enquiry_id uuid REFERENCES marketplace_enquiries(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_notifications_user_idx
  ON marketplace_notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_listing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  uploader_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  storage_bucket text NOT NULL DEFAULT 'messaging-private',
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 180),
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketplace_listing_documents_listing_idx
  ON marketplace_listing_documents (listing_id, created_at DESC);

CREATE TABLE IF NOT EXISTS business_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES marketplace_transactions(id) ON DELETE CASCADE,
  author_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR length(comment) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, author_user_id),
  CHECK (author_user_id <> subject_user_id)
);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'marketplace_categories', 'business_preferences', 'marketplace_listings', 'buyer_requests',
    'supplier_offers', 'business_matches', 'marketplace_enquiries', 'marketplace_transactions',
    'listing_reports', 'marketplace_notifications', 'marketplace_listing_documents', 'business_reviews'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

CREATE POLICY marketplace_categories_read ON marketplace_categories FOR SELECT USING (active OR public.fuel_iq_is_admin());
CREATE POLICY marketplace_categories_admin_write ON marketplace_categories FOR ALL
  USING (public.fuel_iq_is_admin()) WITH CHECK (public.fuel_iq_is_admin());
CREATE POLICY marketplace_activity_self_insert ON customer_activity_logs FOR INSERT
  WITH CHECK (user_id = public.fuel_iq_current_user_id() AND action LIKE 'marketplace_%');
CREATE POLICY marketplace_conversation_participant_join ON conversation_participants FOR INSERT
  WITH CHECK (
    user_id = public.fuel_iq_current_user_id()
    OR (
      public.messaging_is_participant(conversation_id)
      AND (
        EXISTS (SELECT 1 FROM marketplace_enquiries e
          WHERE (e.sender_user_id = public.fuel_iq_current_user_id() AND e.recipient_user_id = conversation_participants.user_id)
            OR (e.recipient_user_id = public.fuel_iq_current_user_id() AND e.sender_user_id = conversation_participants.user_id))
        OR EXISTS (SELECT 1 FROM supplier_offers o JOIN buyer_requests r ON r.id = o.request_id
          WHERE (o.supplier_user_id = public.fuel_iq_current_user_id() AND r.buyer_user_id = conversation_participants.user_id)
            OR (r.buyer_user_id = public.fuel_iq_current_user_id() AND o.supplier_user_id = conversation_participants.user_id))
      )
    )
  );
CREATE POLICY business_preferences_self_access ON business_preferences FOR ALL
  USING (user_id = public.fuel_iq_current_user_id())
  WITH CHECK (user_id = public.fuel_iq_current_user_id());
CREATE POLICY business_preferences_admin_read ON business_preferences FOR SELECT
  USING (public.fuel_iq_is_admin());

CREATE POLICY marketplace_listings_public_read ON marketplace_listings FOR SELECT
  USING (
    (status = 'active' AND expires_at > now()
      AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = owner_user_id
        AND (p.email_verified OR p.phone_verified) AND p.account_status = 'approved'))
    OR owner_user_id = public.fuel_iq_current_user_id()
    OR public.fuel_iq_is_admin()
  );
CREATE POLICY marketplace_listings_owner_insert ON marketplace_listings FOR INSERT
  WITH CHECK (
    owner_user_id = public.fuel_iq_current_user_id()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = owner_user_id
      AND (p.email_verified OR p.phone_verified) AND p.account_status = 'approved')
  );
CREATE POLICY marketplace_listings_owner_update ON marketplace_listings FOR UPDATE
  USING (owner_user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin())
  WITH CHECK (owner_user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());
CREATE POLICY marketplace_listings_owner_delete ON marketplace_listings FOR DELETE
  USING (owner_user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());

CREATE POLICY buyer_requests_participant_read ON buyer_requests FOR SELECT
  USING (
    buyer_user_id = public.fuel_iq_current_user_id()
    OR public.fuel_iq_is_admin()
    OR EXISTS (SELECT 1 FROM business_matches m
      WHERE m.request_id = buyer_requests.id AND m.supplier_user_id = public.fuel_iq_current_user_id())
    OR EXISTS (SELECT 1 FROM marketplace_listings l
      WHERE l.owner_user_id = public.fuel_iq_current_user_id() AND l.status = 'active'
        AND l.expires_at > now() AND l.product_type = buyer_requests.product_type
        AND COALESCE(l.quantity, 0) >= buyer_requests.quantity
        AND (l.minimum_order IS NULL OR l.minimum_order <= buyer_requests.quantity)
        AND (lower(COALESCE(l.state, '')) = lower(buyer_requests.state) OR l.delivery_available)
        AND (NOT buyer_requests.delivery_required OR l.delivery_available)
        AND (buyer_requests.target_price_min IS NULL OR l.price IS NULL OR l.price >= buyer_requests.target_price_min)
        AND (buyer_requests.target_price_max IS NULL OR l.price IS NULL OR l.price <= buyer_requests.target_price_max))
    OR EXISTS (SELECT 1 FROM supplier_offers o
      WHERE o.request_id = buyer_requests.id AND o.supplier_user_id = public.fuel_iq_current_user_id())
  );
CREATE POLICY buyer_requests_owner_insert ON buyer_requests FOR INSERT
  WITH CHECK (buyer_user_id = public.fuel_iq_current_user_id()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = buyer_user_id
      AND (p.email_verified OR p.phone_verified) AND p.account_status = 'approved'));
CREATE POLICY buyer_requests_owner_update ON buyer_requests FOR UPDATE
  USING (buyer_user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin())
  WITH CHECK (buyer_user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());
CREATE POLICY buyer_requests_owner_delete ON buyer_requests FOR DELETE
  USING (buyer_user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());

CREATE POLICY supplier_offers_participant_read ON supplier_offers FOR SELECT
  USING (supplier_user_id = public.fuel_iq_current_user_id()
    OR EXISTS (SELECT 1 FROM buyer_requests r WHERE r.id = request_id AND r.buyer_user_id = public.fuel_iq_current_user_id())
    OR public.fuel_iq_is_admin());
CREATE POLICY supplier_offers_supplier_insert ON supplier_offers FOR INSERT
  WITH CHECK (supplier_user_id = public.fuel_iq_current_user_id()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = supplier_user_id
      AND (p.email_verified OR p.phone_verified) AND p.account_status = 'approved')
    AND EXISTS (SELECT 1 FROM business_matches m JOIN marketplace_listings l
      ON l.id = COALESCE(supplier_offers.listing_id, m.listing_id)
      WHERE m.request_id = supplier_offers.request_id AND m.supplier_user_id = supplier_offers.supplier_user_id
        AND l.owner_user_id = supplier_offers.supplier_user_id AND l.status = 'active'
        AND l.expires_at > now() AND l.product_type = supplier_offers.offered_product
        AND COALESCE(l.quantity, 0) >= supplier_offers.quantity
        AND (l.minimum_order IS NULL OR l.minimum_order <= supplier_offers.quantity)
        AND EXISTS (SELECT 1 FROM buyer_requests r WHERE r.id = supplier_offers.request_id
          AND (lower(COALESCE(l.state, '')) = lower(r.state) OR l.delivery_available)
          AND (NOT r.delivery_required OR l.delivery_available)))
    AND EXISTS (SELECT 1 FROM buyer_requests r WHERE r.id = request_id AND r.status = 'open'
      AND r.expires_at > now() AND r.product_type = offered_product
      AND r.quantity <= supplier_offers.quantity
      AND (r.target_price_min IS NULL OR supplier_offers.price >= r.target_price_min)
      AND (r.target_price_max IS NULL OR supplier_offers.price <= r.target_price_max)));
CREATE POLICY supplier_offers_participant_update ON supplier_offers FOR UPDATE
  USING (supplier_user_id = public.fuel_iq_current_user_id()
    OR EXISTS (SELECT 1 FROM buyer_requests r WHERE r.id = request_id AND r.buyer_user_id = public.fuel_iq_current_user_id())
    OR public.fuel_iq_is_admin())
  WITH CHECK (supplier_user_id = public.fuel_iq_current_user_id()
    OR EXISTS (SELECT 1 FROM buyer_requests r WHERE r.id = request_id AND r.buyer_user_id = public.fuel_iq_current_user_id())
    OR public.fuel_iq_is_admin());

CREATE POLICY business_matches_participant_read ON business_matches FOR SELECT
  USING (buyer_user_id = public.fuel_iq_current_user_id() OR supplier_user_id = public.fuel_iq_current_user_id()
    OR public.fuel_iq_is_admin());
CREATE POLICY business_matches_system_write ON business_matches FOR ALL
  USING (public.fuel_iq_is_admin()) WITH CHECK (public.fuel_iq_is_admin());

CREATE POLICY marketplace_enquiries_participant_read ON marketplace_enquiries FOR SELECT
  USING (sender_user_id = public.fuel_iq_current_user_id() OR recipient_user_id = public.fuel_iq_current_user_id()
    OR public.fuel_iq_is_admin());
CREATE POLICY marketplace_enquiries_sender_insert ON marketplace_enquiries FOR INSERT
  WITH CHECK (sender_user_id = public.fuel_iq_current_user_id()
    AND NOT public.messaging_contact_is_blocked(recipient_user_id)
    AND (
      EXISTS (SELECT 1 FROM marketplace_listings l WHERE l.id = listing_id
        AND l.owner_user_id = recipient_user_id AND l.status = 'active')
      OR EXISTS (SELECT 1 FROM buyer_requests r WHERE r.id = request_id
        AND r.buyer_user_id = recipient_user_id AND r.status = 'open')
    ));
CREATE POLICY marketplace_enquiries_participant_update ON marketplace_enquiries FOR UPDATE
  USING (sender_user_id = public.fuel_iq_current_user_id() OR recipient_user_id = public.fuel_iq_current_user_id()
    OR public.fuel_iq_is_admin())
  WITH CHECK (sender_user_id = public.fuel_iq_current_user_id() OR recipient_user_id = public.fuel_iq_current_user_id()
    OR public.fuel_iq_is_admin());

CREATE POLICY marketplace_transactions_participant_read ON marketplace_transactions FOR SELECT
  USING (buyer_user_id = public.fuel_iq_current_user_id() OR supplier_user_id = public.fuel_iq_current_user_id()
    OR public.fuel_iq_is_admin());
CREATE POLICY marketplace_transactions_buyer_insert ON marketplace_transactions FOR INSERT
  WITH CHECK (buyer_user_id = public.fuel_iq_current_user_id()
    AND EXISTS (SELECT 1 FROM supplier_offers o WHERE o.id = offer_id
      AND o.supplier_user_id = supplier_user_id AND o.status = 'accepted'));
CREATE POLICY marketplace_transactions_participant_update ON marketplace_transactions FOR UPDATE
  USING (buyer_user_id = public.fuel_iq_current_user_id() OR supplier_user_id = public.fuel_iq_current_user_id()
    OR public.fuel_iq_is_admin())
  WITH CHECK (buyer_user_id = public.fuel_iq_current_user_id() OR supplier_user_id = public.fuel_iq_current_user_id()
    OR public.fuel_iq_is_admin());

CREATE POLICY listing_reports_self_read ON listing_reports FOR SELECT
  USING (reporter_user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());
CREATE POLICY listing_reports_self_insert ON listing_reports FOR INSERT
  WITH CHECK (reporter_user_id = public.fuel_iq_current_user_id());
CREATE POLICY listing_reports_admin_update ON listing_reports FOR UPDATE
  USING (public.fuel_iq_is_admin()) WITH CHECK (public.fuel_iq_is_admin());

CREATE POLICY marketplace_notifications_self_access ON marketplace_notifications FOR ALL
  USING (user_id = public.fuel_iq_current_user_id())
  WITH CHECK (user_id = public.fuel_iq_current_user_id());
CREATE POLICY marketplace_notifications_related_insert ON marketplace_notifications FOR INSERT
  WITH CHECK (
    public.fuel_iq_is_admin()
    OR
    (notification_type = 'matching_listing' AND EXISTS (
      SELECT 1 FROM business_preferences p JOIN marketplace_listings l ON l.id = listing_id
      WHERE p.user_id = marketplace_notifications.user_id AND l.owner_user_id = public.fuel_iq_current_user_id()
        AND p.user_id <> l.owner_user_id
        AND l.product_type = ANY(p.products_need)
    ))
    OR (notification_type = 'matching_request' AND EXISTS (
      SELECT 1 FROM buyer_requests r JOIN marketplace_listings l
        ON l.owner_user_id = marketplace_notifications.user_id
      WHERE r.id = marketplace_notifications.request_id
        AND r.buyer_user_id = public.fuel_iq_current_user_id()
        AND l.status = 'active' AND l.expires_at > now()
        AND l.product_type = r.product_type AND COALESCE(l.quantity, 0) >= r.quantity
        AND (l.minimum_order IS NULL OR l.minimum_order <= r.quantity)
        AND (lower(COALESCE(l.state, '')) = lower(r.state) OR l.delivery_available)
        AND (NOT r.delivery_required OR l.delivery_available)
        AND (r.target_price_min IS NULL OR l.price IS NULL OR l.price >= r.target_price_min)
        AND (r.target_price_max IS NULL OR l.price IS NULL OR l.price <= r.target_price_max)
    ))
    OR (notification_type IN ('offer_received', 'offer_accepted', 'offer_declined') AND EXISTS (
      SELECT 1 FROM supplier_offers o JOIN buyer_requests r ON r.id = o.request_id
      WHERE o.id = marketplace_notifications.offer_id
        AND ((notification_type = 'offer_received' AND r.buyer_user_id = marketplace_notifications.user_id
          AND o.supplier_user_id = public.fuel_iq_current_user_id())
          OR (notification_type IN ('offer_accepted', 'offer_declined')
            AND o.supplier_user_id = marketplace_notifications.user_id
            AND r.buyer_user_id = public.fuel_iq_current_user_id()))
    ))
    OR (notification_type = 'enquiry_received' AND EXISTS (
      SELECT 1 FROM marketplace_enquiries e WHERE e.id = marketplace_notifications.enquiry_id
        AND e.recipient_user_id = marketplace_notifications.user_id
        AND e.sender_user_id = public.fuel_iq_current_user_id()
    ))
  );

CREATE POLICY marketplace_listing_documents_owner_access ON marketplace_listing_documents FOR SELECT
  USING (uploader_user_id = public.fuel_iq_current_user_id()
    OR EXISTS (SELECT 1 FROM marketplace_listings l WHERE l.id = listing_id
      AND l.owner_user_id = public.fuel_iq_current_user_id())
    OR public.fuel_iq_is_admin());
CREATE POLICY marketplace_listing_documents_owner_insert ON marketplace_listing_documents FOR INSERT
  WITH CHECK (uploader_user_id = public.fuel_iq_current_user_id()
    AND EXISTS (SELECT 1 FROM marketplace_listings l WHERE l.id = listing_id
      AND l.owner_user_id = public.fuel_iq_current_user_id()));
CREATE POLICY marketplace_listing_documents_owner_delete ON marketplace_listing_documents FOR DELETE
  USING (uploader_user_id = public.fuel_iq_current_user_id()
    OR EXISTS (SELECT 1 FROM marketplace_listings l WHERE l.id = listing_id
      AND l.owner_user_id = public.fuel_iq_current_user_id())
    OR public.fuel_iq_is_admin());

CREATE POLICY business_reviews_participant_read ON business_reviews FOR SELECT
  USING (author_user_id = public.fuel_iq_current_user_id() OR subject_user_id = public.fuel_iq_current_user_id()
    OR public.fuel_iq_is_admin());
CREATE POLICY business_reviews_author_insert ON business_reviews FOR INSERT
  WITH CHECK (
    author_user_id = public.fuel_iq_current_user_id()
    AND EXISTS (SELECT 1 FROM marketplace_transactions t WHERE t.id = transaction_id
      AND t.status = 'completed' AND author_user_id IN (t.buyer_user_id, t.supplier_user_id)
      AND subject_user_id IN (t.buyer_user_id, t.supplier_user_id))
  );
