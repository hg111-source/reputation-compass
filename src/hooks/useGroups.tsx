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
     mutationFn: async (name: string) => {
       if (!user) throw new Error('Not authenticated');
       const { data, error } = await supabase
         .from('groups')
         .insert({ name, user_id: user.id })
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
     mutationFn: async ({ id, name }: { id: string; name: string }) => {
       const { data, error } = await supabase
         .from('groups')
         .update({ name })
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
 
   return {
     groups,
     isLoading,
     error,
     createGroup,
     updateGroup,
     deleteGroup,
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
 
   return {
     groupProperties,
     properties,
     isLoading,
     addPropertyToGroup,
     removePropertyFromGroup,
   };
 }