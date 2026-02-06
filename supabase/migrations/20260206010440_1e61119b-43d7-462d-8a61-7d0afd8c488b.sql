-- Add Kasa aggregated score columns to properties table
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS kasa_aggregated_score DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS kasa_review_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS kasa_url TEXT;