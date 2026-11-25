DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'Supabase Storage is unavailable; private messaging attachment uploads remain disabled.';
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('messaging-private', 'messaging-private', false, 10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  EXECUTE 'DROP POLICY IF EXISTS messaging_private_service_only_select ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS messaging_private_service_only_insert ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS messaging_private_service_only_delete ON storage.objects';
  EXECUTE 'CREATE POLICY messaging_private_service_only_select ON storage.objects FOR SELECT USING (bucket_id = ''messaging-private'' AND auth.role() = ''service_role'')';
  EXECUTE 'CREATE POLICY messaging_private_service_only_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''messaging-private'' AND auth.role() = ''service_role'')';
  EXECUTE 'CREATE POLICY messaging_private_service_only_delete ON storage.objects FOR DELETE USING (bucket_id = ''messaging-private'' AND auth.role() = ''service_role'')';
END
$$;
