
-- Create debug_logs table for auto-healing tracking
CREATE TABLE public.debug_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  platform text NOT NULL,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'pending', -- pending, retrying, resolved, failed
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own debug logs
CREATE POLICY "Users can view their debug logs"
  ON public.debug_logs FOR SELECT
  USING (owns_property(property_id));

CREATE POLICY "Users can insert their debug logs"
  ON public.debug_logs FOR INSERT
  WITH CHECK (owns_property(property_id));

CREATE POLICY "Users can update their debug logs"
  ON public.debug_logs FOR UPDATE
  USING (owns_property(property_id));

CREATE POLICY "Users can delete their debug logs"
  ON public.debug_logs FOR DELETE
  USING (owns_property(property_id));

-- Index for efficient lookups
CREATE INDEX idx_debug_logs_property_platform ON public.debug_logs(property_id, platform);
CREATE INDEX idx_debug_logs_status ON public.debug_logs(status);

-- Trigger for updated_at
CREATE TRIGGER update_debug_logs_updated_at
  BEFORE UPDATE ON public.debug_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
