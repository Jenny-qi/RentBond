-- Run once in a Supabase project as its migration administrator.
-- Browser clients never access this bucket directly; the server proxies all downloads.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('rentbond-private','rentbond-private',false,157286400,
  ARRAY['image/jpeg','image/png','application/pdf','application/zip'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS rentbond_private_deny ON storage.objects;
CREATE POLICY rentbond_private_deny ON storage.objects AS RESTRICTIVE
FOR ALL TO anon,authenticated
USING (bucket_id <> 'rentbond-private')
WITH CHECK (bucket_id <> 'rentbond-private');
