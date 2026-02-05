-- Update group_properties SELECT policy to allow viewing properties of public groups
DROP POLICY IF EXISTS "Users can view their group properties" ON public.group_properties;

CREATE POLICY "Users can view group properties of owned or public groups"
ON public.group_properties
FOR SELECT
USING (
  owns_group(group_id) OR 
  EXISTS (
    SELECT 1 FROM public.groups 
    WHERE id = group_id AND is_public = true
  )
);