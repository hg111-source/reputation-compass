-- Rename columns in hotel_aliases for clarity
ALTER TABLE public.hotel_aliases 
  ADD COLUMN IF NOT EXISTS source_id_or_url text;

-- Migrate existing data: prefer platform_url, fallback to platform_id
UPDATE public.hotel_aliases 
SET source_id_or_url = COALESCE(platform_url, platform_id)
WHERE source_id_or_url IS NULL;

-- Add source_name_raw if not exists (renamed from platform_name for clarity)
ALTER TABLE public.hotel_aliases 
  RENAME COLUMN platform_name TO source_name_raw;

-- Add last_verified_at column
ALTER TABLE public.hotel_aliases 
  ADD COLUMN IF NOT EXISTS last_verified_at timestamp with time zone;

-- Update resolution_status to use proper enum-like constraint
-- Valid values: pending, resolved, needs_review, not_listed, scrape_failed, timeout, ambiguous_match
COMMENT ON COLUMN public.hotel_aliases.resolution_status IS 'Status: pending, resolved, needs_review, not_listed, scrape_failed, timeout, ambiguous_match';

-- Rename source_snapshots columns for clarity (maps to reviews_snapshot)
-- Already has: property_id (hotel_master_id), source, score_raw (rating), review_count, score_scale (scale), collected_at (fetched_at)
COMMENT ON TABLE public.source_snapshots IS 'Time-series review data (reviews_snapshot in spec)';
COMMENT ON TABLE public.hotel_aliases IS 'Stable mapping per source for identity resolution';
COMMENT ON TABLE public.properties IS 'Canonical hotel record (hotel_master in spec)';