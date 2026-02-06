-- Add index for efficient Kasa snapshot queries
CREATE INDEX IF NOT EXISTS idx_source_snapshots_kasa 
ON public.source_snapshots (property_id, collected_at DESC) 
WHERE source = 'kasa';