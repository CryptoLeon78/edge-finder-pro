
-- Table for access requests
CREATE TABLE public.access_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  approval_token UUID NOT NULL DEFAULT gen_random_uuid(),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_access_requests_email ON public.access_requests (email);
CREATE INDEX idx_access_requests_token ON public.access_requests (approval_token);
CREATE UNIQUE INDEX idx_access_requests_email_active ON public.access_requests (email) WHERE status IN ('pending', 'approved');

-- Enable RLS
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a request (unauthenticated users)
CREATE POLICY "Anyone can request access"
  ON public.access_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Anyone can read their own request by email
CREATE POLICY "Anyone can check their own access status"
  ON public.access_requests
  FOR SELECT
  TO anon
  USING (true);

-- Service role handles updates (via edge functions)

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_access_requests_updated_at
  BEFORE UPDATE ON public.access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
