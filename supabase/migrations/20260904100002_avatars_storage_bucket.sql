-- Migration: create avatars storage bucket with user-scoped RLS policies

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to INSERT objects under their own uid prefix
CREATE POLICY "avatars: user insert own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to UPDATE objects under their own uid prefix
CREATE POLICY "avatars: user update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to DELETE objects under their own uid prefix
CREATE POLICY "avatars: user delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public SELECT (bucket is public, no auth required)
CREATE POLICY "avatars: public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');
