
-- Replace overly permissive insert policy with a restrictive one
DROP POLICY "Anyone can request access" ON public.access_requests;

CREATE POLICY "Anyone can request access with defaults only"
  ON public.access_requests
  FOR INSERT
  TO anon
  WITH CHECK (status = 'pending');
