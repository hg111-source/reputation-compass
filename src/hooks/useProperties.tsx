 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { Property } from '@/lib/types';
 import { useAuth } from './useAuth';
 
 export function useProperties() {
   const { user } = useAuth();
   const queryClient = useQueryClient();
 
   const { data: properties = [], isLoading, error } = useQuery({
     queryKey: ['properties', user?.id],
     queryFn: async () => {
       if (!user) return [];
       const { data, error } = await supabase
         .from('properties')
         .select('*')
         .order('created_at', { ascending: false });
       if (error) throw error;
       return data as Property[];
     },
     enabled: !!user,
   });
 
   const createProperty = useMutation({
     mutationFn: async (property: { name: string; city: string; state: string }) => {
       if (!user) throw new Error('Not authenticated');
       const { data, error } = await supabase
         .from('properties')
         .insert({ ...property, user_id: user.id })
         .select()
         .single();
       if (error) throw error;
       return data as Property;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['properties'] });
     },
   });
 
   const createManyProperties = useMutation({
     mutationFn: async (props: Array<{ name: string; city: string; state: string }>) => {
       if (!user) throw new Error('Not authenticated');
       const { data, error } = await supabase
         .from('properties')
         .insert(props.map(p => ({ ...p, user_id: user.id })))
         .select();
       if (error) throw error;
       return data as Property[];
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['properties'] });
     },
   });
 
   const deleteProperty = useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase.from('properties').delete().eq('id', id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['properties'] });
       queryClient.invalidateQueries({ queryKey: ['groups'] });
     },
   });
 
   return {
     properties,
     isLoading,
     error,
     createProperty,
     createManyProperties,
     deleteProperty,
   };
 }