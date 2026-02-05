-- Create enum for review sources
CREATE TYPE review_source AS ENUM ('google', 'tripadvisor', 'expedia', 'booking');

-- Properties table
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Groups table
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Group properties junction table
CREATE TABLE public.group_properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, property_id)
);

-- Source snapshots table (per-property, per-channel scores)
CREATE TABLE public.source_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  source review_source NOT NULL,
  score_raw DECIMAL(4,2) NOT NULL,
  score_scale INTEGER NOT NULL CHECK (score_scale IN (5, 10)),
  review_count INTEGER NOT NULL DEFAULT 0,
  normalized_score_0_10 DECIMAL(4,2) NOT NULL,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Group snapshots table (aggregated weighted scores per group)
CREATE TABLE public.group_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  weighted_score_0_10 DECIMAL(4,2) NOT NULL,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policies for properties
CREATE POLICY "Users can view their own properties" ON public.properties
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own properties" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own properties" ON public.properties
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own properties" ON public.properties
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for groups
CREATE POLICY "Users can view their own groups" ON public.groups
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own groups" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own groups" ON public.groups
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own groups" ON public.groups
  FOR DELETE USING (auth.uid() = user_id);

-- Helper function to check group ownership
CREATE OR REPLACE FUNCTION public.owns_group(group_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = group_uuid AND user_id = auth.uid()
  )
$$;

-- Helper function to check property ownership
CREATE OR REPLACE FUNCTION public.owns_property(property_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = property_uuid AND user_id = auth.uid()
  )
$$;

-- RLS policies for group_properties
CREATE POLICY "Users can view their group properties" ON public.group_properties
  FOR SELECT USING (public.owns_group(group_id));
CREATE POLICY "Users can insert their group properties" ON public.group_properties
  FOR INSERT WITH CHECK (public.owns_group(group_id) AND public.owns_property(property_id));
CREATE POLICY "Users can delete their group properties" ON public.group_properties
  FOR DELETE USING (public.owns_group(group_id));

-- RLS policies for source_snapshots
CREATE POLICY "Users can view their property snapshots" ON public.source_snapshots
  FOR SELECT USING (public.owns_property(property_id));
CREATE POLICY "Users can insert their property snapshots" ON public.source_snapshots
  FOR INSERT WITH CHECK (public.owns_property(property_id));

-- RLS policies for group_snapshots
CREATE POLICY "Users can view their group snapshots" ON public.group_snapshots
  FOR SELECT USING (public.owns_group(group_id));
CREATE POLICY "Users can insert their group snapshots" ON public.group_snapshots
  FOR INSERT WITH CHECK (public.owns_group(group_id));

-- Create indexes for better performance
CREATE INDEX idx_properties_user_id ON public.properties(user_id);
CREATE INDEX idx_groups_user_id ON public.groups(user_id);
CREATE INDEX idx_group_properties_group_id ON public.group_properties(group_id);
CREATE INDEX idx_group_properties_property_id ON public.group_properties(property_id);
CREATE INDEX idx_source_snapshots_property_id ON public.source_snapshots(property_id);
CREATE INDEX idx_source_snapshots_collected_at ON public.source_snapshots(collected_at DESC);
CREATE INDEX idx_group_snapshots_group_id ON public.group_snapshots(group_id);
CREATE INDEX idx_group_snapshots_collected_at ON public.group_snapshots(collected_at DESC);