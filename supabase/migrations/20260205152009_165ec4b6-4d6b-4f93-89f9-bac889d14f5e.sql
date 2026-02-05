-- Create enum for review platforms
-- Note: Using existing review_source enum

-- Create table for storing review texts
CREATE TABLE public.review_texts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  platform public.review_source NOT NULL,
  review_text TEXT NOT NULL,
  review_rating NUMERIC,
  review_date TIMESTAMP WITH TIME ZONE,
  reviewer_name TEXT,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.review_texts ENABLE ROW LEVEL SECURITY;

-- RLS policies using existing owns_property function
CREATE POLICY "Users can view their property reviews"
ON public.review_texts
FOR SELECT
USING (owns_property(property_id));

CREATE POLICY "Users can insert their property reviews"
ON public.review_texts
FOR INSERT
WITH CHECK (owns_property(property_id));

CREATE POLICY "Users can delete their property reviews"
ON public.review_texts
FOR DELETE
USING (owns_property(property_id));

-- Index for efficient queries
CREATE INDEX idx_review_texts_property_platform ON public.review_texts(property_id, platform);

-- Create table for AI analysis results
CREATE TABLE public.review_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  positive_themes JSONB NOT NULL DEFAULT '[]',
  negative_themes JSONB NOT NULL DEFAULT '[]',
  summary TEXT,
  review_count INTEGER NOT NULL DEFAULT 0,
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(property_id)
);

-- Enable RLS
ALTER TABLE public.review_analysis ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their property analysis"
ON public.review_analysis
FOR SELECT
USING (owns_property(property_id));

CREATE POLICY "Users can insert their property analysis"
ON public.review_analysis
FOR INSERT
WITH CHECK (owns_property(property_id));

CREATE POLICY "Users can update their property analysis"
ON public.review_analysis
FOR UPDATE
USING (owns_property(property_id));

CREATE POLICY "Users can delete their property analysis"
ON public.review_analysis
FOR DELETE
USING (owns_property(property_id));

-- Index for lookups
CREATE INDEX idx_review_analysis_property ON public.review_analysis(property_id);