-- Add platform URL columns to properties table
ALTER TABLE public.properties 
  ADD COLUMN IF NOT EXISTS booking_url text,
  ADD COLUMN IF NOT EXISTS tripadvisor_url text,
  ADD COLUMN IF NOT EXISTS expedia_url text,
  ADD COLUMN IF NOT EXISTS google_place_id text;