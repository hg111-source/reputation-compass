 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { Group, GroupProperty, Property } from '@/lib/types';
 import { useAuth } from './useAuth';
 
 export function useGroups() {
   const { user } = useAuth();
   const queryClient = useQueryClient();
 
   const { data: groups = [], isLoading, error } = useQuery({
     queryKey: ['groups', user?.id],
     queryFn: async () => {
       if (!user) return [];
       const { data, error } = await supabase
         .from('groups')
         .select('*')
         .order('created_at', { ascending: false });
       if (error) throw error;
       return data as Group[];
     },
     enabled: !!user,
   });
 
  const createGroup = useMutation({
    mutationFn: async ({ name, isPublic = false }: { name: string; isPublic?: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('groups')
        .insert({ name, user_id: user.id, is_public: isPublic })
        .select()
        .single();
      if (error) throw error;
      return data as Group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
 
  const updateGroup = useMutation({
    mutationFn: async ({ id, name, isPublic }: { id: string; name?: string; isPublic?: boolean }) => {
      const updates: { name?: string; is_public?: boolean } = {};
      if (name !== undefined) updates.name = name;
      if (isPublic !== undefined) updates.is_public = isPublic;
      
      const { data, error } = await supabase
        .from('groups')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
 
   const deleteGroup = useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase.from('groups').delete().eq('id', id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['groups'] });
     },
  });

  // Copy a public group to user's own groups
  const copyGroup = useMutation({
    mutationFn: async ({ sourceGroupId, newName }: { sourceGroupId: string; newName: string }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Create the new group
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({ name: newName, user_id: user.id, is_public: false })
        .select()
        .single();
      if (groupError) throw groupError;
      
      // Get properties from source group
      const { data: sourceProperties, error: propsError } = await supabase
        .from('group_properties')
        .select('property_id')
        .eq('group_id', sourceGroupId);
      if (propsError) throw propsError;
      
      // Copy properties (only those the user owns)
      if (sourceProperties && sourceProperties.length > 0) {
        const propertyIds = sourceProperties.map(p => p.property_id);
        
        // Check which properties belong to the user
        const { data: userProperties } = await supabase
          .from('properties')
          .select('id')
          .in('id', propertyIds);
        
        if (userProperties && userProperties.length > 0) {
          await supabase.from('group_properties').insert(
            userProperties.map(p => ({ group_id: newGroup.id, property_id: p.id }))
          );
        }
      }
      
      return newGroup as Group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  // Separate user's own groups from public groups by others
  const myGroups = groups.filter(g => g.user_id === user?.id);
  const publicGroups = groups.filter(g => g.is_public && g.user_id !== user?.id);

  return {
    groups,
    myGroups,
    publicGroups,
    isLoading,
    error,
    createGroup,
    updateGroup,
    deleteGroup,
    copyGroup,
  };
}
 
 export function useGroupProperties(groupId: string | null) {
   const queryClient = useQueryClient();
 
   const { data: groupProperties = [], isLoading } = useQuery({
     queryKey: ['group-properties', groupId],
     queryFn: async () => {
       if (!groupId) return [];
       const { data, error } = await supabase
         .from('group_properties')
         .select(`
           *,
           properties:property_id (*)
         `)
         .eq('group_id', groupId);
       if (error) throw error;
       return data as (GroupProperty & { properties: Property })[];
     },
     enabled: !!groupId,
   });
 
   const addPropertyToGroup = useMutation({
     mutationFn: async ({ groupId, propertyId }: { groupId: string; propertyId: string }) => {
       const { data, error } = await supabase
         .from('group_properties')
         .insert({ group_id: groupId, property_id: propertyId })
         .select()
         .single();
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['group-properties'] });
     },
   });
 
   const removePropertyFromGroup = useMutation({
     mutationFn: async ({ groupId, propertyId }: { groupId: string; propertyId: string }) => {
       const { error } = await supabase
         .from('group_properties')
         .delete()
         .eq('group_id', groupId)
         .eq('property_id', propertyId);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['group-properties'] });
     },
   });
 
   const properties = groupProperties.map(gp => gp.properties);
 
   const bulkAddAllProperties = useMutation({
     mutationFn: async ({ groupId, propertyIds }: { groupId: string; propertyIds: string[] }) => {
       if (propertyIds.length === 0) return { count: 0 };
       const { error } = await supabase
         .from('group_properties')
         .insert(propertyIds.map(propertyId => ({ group_id: groupId, property_id: propertyId })));
       if (error) throw error;
       return { count: propertyIds.length };
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['group-properties'] });
     },
   });
 
   const bulkRemoveAllProperties = useMutation({
     mutationFn: async (groupId: string) => {
       // First get the count
       const { data: existing } = await supabase
         .from('group_properties')
         .select('id')
         .eq('group_id', groupId);
       const count = existing?.length || 0;
       
       const { error } = await supabase
         .from('group_properties')
         .delete()
         .eq('group_id', groupId);
       if (error) throw error;
       return { count };
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['group-properties'] });
     },
   });
 
   return {
     groupProperties,
     properties,
     isLoading,
     addPropertyToGroup,
     removePropertyFromGroup,
     bulkAddAllProperties,
     bulkRemoveAllProperties,
   };
 }