-- Add is_public column to groups table for optional sharing
ALTER TABLE public.groups 
ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own groups" ON public.groups;

-- Create new SELECT policy: users can see their own groups OR public groups
CREATE POLICY "Users can view own or public groups"
ON public.groups
FOR SELECT
USING (
  auth.uid() = user_id OR is_public = true
);

-- Update the owns_group function to check ownership (not just visibility)
CREATE OR REPLACE FUNCTION public.owns_group(group_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = group_uuid AND user_id = auth.uid()
  )
$$;