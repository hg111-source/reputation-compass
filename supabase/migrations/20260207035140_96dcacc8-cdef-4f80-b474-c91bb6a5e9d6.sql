
-- Add unique constraint for upsert support on debug_logs
CREATE UNIQUE INDEX idx_debug_logs_unique_prop_platform ON public.debug_logs(property_id, platform);
