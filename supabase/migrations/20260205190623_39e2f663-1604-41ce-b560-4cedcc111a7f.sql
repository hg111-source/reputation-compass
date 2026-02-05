-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create hotel_aliases table for storing resolved platform identifiers
CREATE TABLE public.hotel_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  source public.review_source NOT NULL,
  platform_id TEXT, -- Platform-specific ID (e.g., Google place_id, Booking hotel_id)
  platform_url TEXT, -- Resolved URL for the property on this platform
  platform_name TEXT, -- Name as it appears on the platform
  resolution_status TEXT NOT NULL DEFAULT 'pending', -- pending, resolved, needs_review, not_listed
  confidence_score NUMERIC, -- 0-1 confidence in the match
  candidate_options JSONB DEFAULT '[]'::jsonb, -- Top candidates when needs_review
  last_resolved_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint: one alias per property per source
  UNIQUE(property_id, source)
);

-- Enable RLS
ALTER TABLE public.hotel_aliases ENABLE ROW LEVEL SECURITY;

-- RLS policies using the existing owns_property function
CREATE POLICY "Users can view their property aliases"
ON public.hotel_aliases FOR SELECT
USING (owns_property(property_id));

CREATE POLICY "Users can insert their property aliases"
ON public.hotel_aliases FOR INSERT
WITH CHECK (owns_property(property_id));

CREATE POLICY "Users can update their property aliases"
ON public.hotel_aliases FOR UPDATE
USING (owns_property(property_id));

CREATE POLICY "Users can delete their property aliases"
ON public.hotel_aliases FOR DELETE
USING (owns_property(property_id));

-- Index for efficient lookups
CREATE INDEX idx_hotel_aliases_property_source ON public.hotel_aliases(property_id, source);
CREATE INDEX idx_hotel_aliases_status ON public.hotel_aliases(resolution_status);

-- Trigger for updated_at
CREATE TRIGGER update_hotel_aliases_updated_at
BEFORE UPDATE ON public.hotel_aliases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();