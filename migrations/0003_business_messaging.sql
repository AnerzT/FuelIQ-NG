CREATE TABLE IF NOT EXISTS business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  business_name text,
  business_category text NOT NULL DEFAULT 'other',
  station_name text,
  terminal_name text,
  state text,
  lga text,
  city text,
  products text[] NOT NULL DEFAULT '{}',
  customer_verified boolean NOT NULL DEFAULT false,
  business_verified boolean NOT NULL DEFAULT false,
  business_contact_public boolean NOT NULL DEFAULT false,
  official_nnpc_authorisation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_profiles_discovery_idx
  ON business_profiles (state, lga, city, business_category);

CREATE TABLE IF NOT EXISTS business_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_low < user_high),
  UNIQUE (user_low, user_high)
);

CREATE TABLE IF NOT EXISTS connection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text CHECK (message IS NULL OR length(message) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_user_id <> recipient_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS connection_requests_one_pending_pair_idx
  ON connection_requests (LEAST(sender_user_id, recipient_user_id), GREATEST(sender_user_id, recipient_user_id))
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_key text NOT NULL UNIQUE,
  created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  archived_at timestamptz,
  muted_until timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS conversation_participants_user_idx
  ON conversation_participants (user_id, conversation_id);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reply_to_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'enquiry', 'system')),
  body text NOT NULL CHECK (length(body) <= 5000),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  uploader_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (length(file_name) <= 180),
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS message_reactions (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('👍', '✅', '🙏', '❓', '🤝')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, reaction)
);
CREATE TABLE IF NOT EXISTS message_read_receipts (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  PRIMARY KEY (message_id, user_id)
);
CREATE TABLE IF NOT EXISTS typing_status (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE IF NOT EXISTS blocked_users (
  blocker_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);
CREATE TABLE IF NOT EXISTS message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reported_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reporter_user_id <> reported_user_id)
);
CREATE INDEX IF NOT EXISTS message_reports_status_created_idx ON message_reports (status, created_at DESC);
CREATE TABLE IF NOT EXISTS business_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
  product_type text NOT NULL CHECK (product_type IN ('PMS', 'AGO', 'DPK', 'LPG')),
  quantity numeric(14, 2) CHECK (quantity IS NULL OR quantity > 0),
  proposed_price numeric(14, 2) CHECK (proposed_price IS NULL OR proposed_price > 0),
  delivery_location text CHECK (delivery_location IS NULL OR length(delivery_location) <= 300),
  preferred_delivery_date date,
  requirements text CHECK (requirements IS NULL OR length(requirements) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chat_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  connection_request_id uuid REFERENCES connection_requests(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  show_preview boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_notifications_user_created_idx ON chat_notifications (user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS chat_preferences (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notifications_enabled boolean NOT NULL DEFAULT true,
  show_message_previews boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS message_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS message_audit_logs_created_idx ON message_audit_logs (created_at DESC);
CREATE TABLE IF NOT EXISTS messaging_suspensions (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  suspended_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 1000),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.messaging_is_participant(target_conversation uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = target_conversation
      AND user_id = public.fuel_iq_current_user_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.messaging_has_blocked_peer(target_conversation uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM conversation_participants peer
    JOIN blocked_users block ON
      (block.blocker_user_id = public.fuel_iq_current_user_id() AND block.blocked_user_id = peer.user_id)
      OR (block.blocker_user_id = peer.user_id AND block.blocked_user_id = public.fuel_iq_current_user_id())
    WHERE peer.conversation_id = target_conversation
      AND peer.user_id <> public.fuel_iq_current_user_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.messaging_contact_is_blocked(target_user text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_user_id = public.fuel_iq_current_user_id() AND blocked_user_id = target_user)
      OR (blocker_user_id = target_user AND blocked_user_id = public.fuel_iq_current_user_id())
  )
$$;

CREATE OR REPLACE FUNCTION public.messaging_protect_business_profile() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  SELECT COALESCE(p.email_verified, false) OR COALESCE(p.phone_verified, false)
    INTO NEW.customer_verified
    FROM profiles p WHERE p.user_id = NEW.user_id;
  NEW.customer_verified := COALESCE(NEW.customer_verified, false);
  IF NOT public.fuel_iq_is_admin()
    AND (
      NEW.business_verified IS DISTINCT FROM CASE WHEN TG_OP = 'UPDATE' THEN OLD.business_verified ELSE false END
      OR NEW.official_nnpc_authorisation IS DISTINCT FROM CASE WHEN TG_OP = 'UPDATE' THEN OLD.official_nnpc_authorisation ELSE false END
    ) THEN
    RAISE EXCEPTION 'Only an administrator can change verified business or official authorisation status';
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS business_profiles_protect_verification ON business_profiles;
CREATE TRIGGER business_profiles_protect_verification BEFORE UPDATE ON business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.messaging_protect_business_profile();
DROP TRIGGER IF EXISTS business_profiles_set_verified ON business_profiles;
CREATE TRIGGER business_profiles_set_verified BEFORE INSERT ON business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.messaging_protect_business_profile();

CREATE OR REPLACE FUNCTION public.messaging_sync_customer_verification() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE business_profiles SET customer_verified = COALESCE(NEW.email_verified, false) OR COALESCE(NEW.phone_verified, false)
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS profiles_sync_business_verification ON profiles;
CREATE TRIGGER profiles_sync_business_verification
  AFTER UPDATE OF email_verified, phone_verified ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.messaging_sync_customer_verification();

CREATE OR REPLACE FUNCTION public.messaging_guard_connection_request() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.sender_user_id <> public.fuel_iq_current_user_id() THEN
      RAISE EXCEPTION 'Connection requests must be sent by the authenticated customer';
    END IF;
  ELSIF NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id
    OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id THEN
    RAISE EXCEPTION 'Connection request participants cannot be changed';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status <> 'pending'
      OR (NEW.status = 'cancelled' AND OLD.sender_user_id <> public.fuel_iq_current_user_id())
      OR (NEW.status IN ('accepted', 'rejected') AND OLD.recipient_user_id <> public.fuel_iq_current_user_id())
      OR NEW.status NOT IN ('accepted', 'rejected', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid connection request transition';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS connection_requests_guard ON connection_requests;
CREATE TRIGGER connection_requests_guard BEFORE INSERT OR UPDATE ON connection_requests
  FOR EACH ROW EXECUTE FUNCTION public.messaging_guard_connection_request();

CREATE OR REPLACE FUNCTION public.messaging_guard_message_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id
    OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
    OR NEW.reply_to_message_id IS DISTINCT FROM OLD.reply_to_message_id
    OR NEW.message_type IS DISTINCT FROM OLD.message_type
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Message identity fields cannot be changed';
  END IF;
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Deleted messages cannot be changed';
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    IF OLD.created_at < now() - interval '24 hours' OR NEW.body <> '[Message deleted]' THEN
      RAISE EXCEPTION 'Message deletion is outside the retention window';
    END IF;
  ELSIF NEW.body IS DISTINCT FROM OLD.body AND OLD.created_at < now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'Message edit is outside the edit window';
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS messages_guard_update ON messages;
CREATE TRIGGER messages_guard_update BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION public.messaging_guard_message_update();

CREATE OR REPLACE FUNCTION public.messaging_guard_conversation_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.conversation_key IS DISTINCT FROM OLD.conversation_key
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    RAISE EXCEPTION 'Conversation identity and archive state cannot be changed directly';
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS conversations_guard_update ON conversations;
CREATE TRIGGER conversations_guard_update BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION public.messaging_guard_conversation_update();

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'business_profiles', 'business_connections', 'connection_requests', 'conversations',
    'conversation_participants', 'messages', 'message_attachments', 'message_reactions',
    'message_read_receipts', 'typing_status', 'blocked_users', 'message_reports',
    'business_enquiries', 'chat_notifications', 'chat_preferences', 'message_audit_logs', 'messaging_suspensions'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

CREATE POLICY business_profiles_public_read ON business_profiles FOR SELECT
  USING (true);
CREATE POLICY business_profiles_self_insert ON business_profiles FOR INSERT
  WITH CHECK (user_id = public.fuel_iq_current_user_id() AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = public.fuel_iq_current_user_id()
      AND (p.email_verified OR p.phone_verified)
  ));
CREATE POLICY business_profiles_self_update ON business_profiles FOR UPDATE
  USING (user_id = public.fuel_iq_current_user_id())
  WITH CHECK (user_id = public.fuel_iq_current_user_id());
CREATE POLICY business_profiles_admin_update ON business_profiles FOR UPDATE
  USING (public.fuel_iq_is_admin()) WITH CHECK (public.fuel_iq_is_admin());
CREATE POLICY business_connections_participant_read ON business_connections FOR SELECT
  USING (public.fuel_iq_current_user_id() IN (user_low, user_high));
CREATE POLICY business_connections_accept_insert ON business_connections FOR INSERT
  WITH CHECK (
    public.fuel_iq_current_user_id() IN (user_low, user_high)
    AND EXISTS (
      SELECT 1 FROM connection_requests cr
      WHERE cr.status = 'accepted'
        AND LEAST(cr.sender_user_id, cr.recipient_user_id) = user_low
        AND GREATEST(cr.sender_user_id, cr.recipient_user_id) = user_high
    )
  );
CREATE POLICY connection_requests_participant_read ON connection_requests FOR SELECT
  USING (public.fuel_iq_current_user_id() IN (sender_user_id, recipient_user_id));
CREATE POLICY connection_requests_sender_insert ON connection_requests FOR INSERT
  WITH CHECK (
    sender_user_id = public.fuel_iq_current_user_id()
    AND EXISTS (SELECT 1 FROM business_profiles bp WHERE bp.user_id = sender_user_id AND bp.customer_verified)
    AND EXISTS (SELECT 1 FROM business_profiles bp WHERE bp.user_id = recipient_user_id AND bp.customer_verified)
    AND NOT public.messaging_contact_is_blocked(recipient_user_id)
  );
CREATE POLICY connection_requests_participant_update ON connection_requests FOR UPDATE
  USING (public.fuel_iq_current_user_id() IN (sender_user_id, recipient_user_id))
  WITH CHECK (public.fuel_iq_current_user_id() IN (sender_user_id, recipient_user_id));
CREATE POLICY conversations_participant_read ON conversations FOR SELECT
  USING (public.messaging_is_participant(id));
CREATE POLICY conversations_create ON conversations FOR INSERT
  WITH CHECK (created_by = public.fuel_iq_current_user_id());
CREATE POLICY conversations_participant_update ON conversations FOR UPDATE
  USING (public.messaging_is_participant(id))
  WITH CHECK (public.messaging_is_participant(id));
CREATE POLICY conversation_participants_read ON conversation_participants FOR SELECT
  USING (public.messaging_is_participant(conversation_id));
CREATE POLICY conversation_participants_join ON conversation_participants FOR INSERT
  WITH CHECK (
    user_id = public.fuel_iq_current_user_id()
    OR (
      public.messaging_is_participant(conversation_id)
      AND EXISTS (
        SELECT 1 FROM conversation_participants mine
        JOIN business_connections bc ON bc.user_low = LEAST(mine.user_id, user_id)
          AND bc.user_high = GREATEST(mine.user_id, user_id)
        WHERE mine.conversation_id = conversation_participants.conversation_id
          AND mine.user_id = public.fuel_iq_current_user_id()
      )
    )
  );
CREATE POLICY conversation_participants_self_update ON conversation_participants FOR UPDATE
  USING (user_id = public.fuel_iq_current_user_id())
  WITH CHECK (user_id = public.fuel_iq_current_user_id());
CREATE POLICY messages_participant_read ON messages FOR SELECT
  USING (public.messaging_is_participant(conversation_id));
CREATE POLICY messages_participant_send ON messages FOR INSERT
  WITH CHECK (
    sender_user_id = public.fuel_iq_current_user_id()
    AND public.messaging_is_participant(conversation_id)
    AND NOT public.messaging_has_blocked_peer(conversation_id)
    AND EXISTS (SELECT 1 FROM business_profiles bp WHERE bp.user_id = sender_user_id AND bp.customer_verified)
  );
CREATE POLICY messages_author_update ON messages FOR UPDATE
  USING (sender_user_id = public.fuel_iq_current_user_id() AND public.messaging_is_participant(conversation_id))
  WITH CHECK (sender_user_id = public.fuel_iq_current_user_id() AND public.messaging_is_participant(conversation_id));
CREATE POLICY message_attachments_participant_read ON message_attachments FOR SELECT
  USING (EXISTS (SELECT 1 FROM messages m WHERE m.id = message_id AND public.messaging_is_participant(m.conversation_id)));
CREATE POLICY message_attachments_uploader_insert ON message_attachments FOR INSERT
  WITH CHECK (uploader_user_id = public.fuel_iq_current_user_id()
    AND EXISTS (SELECT 1 FROM messages m WHERE m.id = message_id
      AND m.sender_user_id = public.fuel_iq_current_user_id()
      AND public.messaging_is_participant(m.conversation_id)));
CREATE POLICY message_reactions_participant_access ON message_reactions FOR ALL
  USING (EXISTS (SELECT 1 FROM messages m WHERE m.id = message_id AND public.messaging_is_participant(m.conversation_id)))
  WITH CHECK (user_id = public.fuel_iq_current_user_id()
    AND EXISTS (SELECT 1 FROM messages m WHERE m.id = message_id AND public.messaging_is_participant(m.conversation_id)));
CREATE POLICY message_receipts_participant_read ON message_read_receipts FOR SELECT
  USING (EXISTS (SELECT 1 FROM messages m WHERE m.id = message_id AND public.messaging_is_participant(m.conversation_id)));
CREATE POLICY message_receipts_self_write ON message_read_receipts FOR ALL
  USING (user_id = public.fuel_iq_current_user_id())
  WITH CHECK (user_id = public.fuel_iq_current_user_id()
    AND EXISTS (SELECT 1 FROM messages m WHERE m.id = message_id AND public.messaging_is_participant(m.conversation_id)));
CREATE POLICY typing_participant_access ON typing_status FOR ALL
  USING (user_id = public.fuel_iq_current_user_id() OR public.messaging_is_participant(conversation_id))
  WITH CHECK (user_id = public.fuel_iq_current_user_id() AND public.messaging_is_participant(conversation_id));
CREATE POLICY blocked_users_self_access ON blocked_users FOR ALL
  USING (blocker_user_id = public.fuel_iq_current_user_id())
  WITH CHECK (blocker_user_id = public.fuel_iq_current_user_id());
CREATE POLICY message_reports_reporter_read ON message_reports FOR SELECT
  USING (reporter_user_id = public.fuel_iq_current_user_id());
CREATE POLICY message_reports_admin_read ON message_reports FOR SELECT
  USING (public.fuel_iq_is_admin());
CREATE POLICY message_reports_reporter_insert ON message_reports FOR INSERT
  WITH CHECK (reporter_user_id = public.fuel_iq_current_user_id());
CREATE POLICY message_reports_admin_update ON message_reports FOR UPDATE
  USING (public.fuel_iq_is_admin()) WITH CHECK (public.fuel_iq_is_admin());
CREATE POLICY business_enquiries_participant_read ON business_enquiries FOR SELECT
  USING (EXISTS (SELECT 1 FROM messages m WHERE m.id = message_id AND public.messaging_is_participant(m.conversation_id)));
CREATE POLICY business_enquiries_sender_insert ON business_enquiries FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM messages m WHERE m.id = message_id AND m.sender_user_id = public.fuel_iq_current_user_id()
      AND m.message_type = 'enquiry' AND public.messaging_is_participant(m.conversation_id)
  ));
CREATE POLICY chat_notifications_self_access ON chat_notifications FOR ALL
  USING (user_id = public.fuel_iq_current_user_id())
  WITH CHECK (user_id = public.fuel_iq_current_user_id());
CREATE POLICY chat_notifications_related_insert ON chat_notifications FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM connection_requests
      WHERE id = connection_request_id AND sender_user_id = chat_notifications.user_id
        AND recipient_user_id = public.fuel_iq_current_user_id() AND status = 'accepted')
    OR EXISTS (
      SELECT 1 FROM connection_requests
      WHERE id = connection_request_id
        AND ((sender_user_id = public.fuel_iq_current_user_id() AND recipient_user_id = user_id)
          OR (recipient_user_id = public.fuel_iq_current_user_id() AND sender_user_id = user_id))
    )
    OR EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_id AND m.sender_user_id = public.fuel_iq_current_user_id()
        AND cp.user_id = chat_notifications.user_id
    )
  );
CREATE POLICY chat_preferences_self_access ON chat_preferences FOR ALL
  USING (user_id = public.fuel_iq_current_user_id())
  WITH CHECK (user_id = public.fuel_iq_current_user_id());
CREATE POLICY message_audit_admin_read ON message_audit_logs FOR SELECT
  USING (public.fuel_iq_is_admin());
CREATE POLICY message_audit_self_insert ON message_audit_logs FOR INSERT
  WITH CHECK (actor_user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());
CREATE POLICY messaging_suspensions_self_read ON messaging_suspensions FOR SELECT
  USING (user_id = public.fuel_iq_current_user_id() OR public.fuel_iq_is_admin());
CREATE POLICY messaging_suspensions_admin_write ON messaging_suspensions FOR ALL
  USING (public.fuel_iq_is_admin()) WITH CHECK (public.fuel_iq_is_admin());
