-- Create refresh_logs table for tracking daily refresh runs
CREATE TABLE public.refresh_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  total_properties INTEGER NOT NULL DEFAULT 0,
  successes INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (logs are system-generated, read-only for admins)
ALTER TABLE public.refresh_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view logs (could restrict further if needed)
CREATE POLICY "Authenticated users can view refresh logs"
ON public.refresh_logs
FOR SELECT
TO authenticated
USING (true);

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage on cron schema
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;