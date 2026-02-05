 import { useState } from 'react';
 import { Navigate } from 'react-router-dom';
 import { useAuth } from '@/hooks/useAuth';
 import { useGroups, useGroupProperties } from '@/hooks/useGroups';
 import { useProperties } from '@/hooks/useProperties';
 import { DashboardLayout } from '@/components/layout/DashboardLayout';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
 } from '@/components/ui/dialog';
 import { Label } from '@/components/ui/label';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Plus, Trash2, FolderOpen, Settings } from 'lucide-react';
 import { useToast } from '@/hooks/use-toast';
 import { format } from 'date-fns';
 
 export default function Groups() {
   const { user, loading } = useAuth();
   const { groups, isLoading, createGroup, deleteGroup } = useGroups();
   const { properties } = useProperties();
   const { toast } = useToast();
   const [isCreateOpen, setIsCreateOpen] = useState(false);
   const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
 
   if (loading) {
     return (
       <div className="flex min-h-screen items-center justify-center">
         <div className="animate-pulse text-muted-foreground">Loading...</div>
       </div>
     );
   }
 
   if (!user) {
     return <Navigate to="/auth" replace />;
   }
 
   const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
     e.preventDefault();
     const formData = new FormData(e.currentTarget);
     const name = formData.get('name') as string;
 
     try {
       await createGroup.mutateAsync(name);
       toast({ title: 'Group created', description: `${name} has been created.` });
       setIsCreateOpen(false);
     } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Failed to create group.' });
     }
   };
 
   const handleDelete = async (id: string, name: string) => {
     try {
       await deleteGroup.mutateAsync(id);
       toast({ title: 'Group deleted', description: `${name} has been removed.` });
     } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete group.' });
     }
   };
 
   return (
     <DashboardLayout>
       <div className="space-y-6">
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-2xl font-semibold">Groups</h1>
             <p className="text-sm text-muted-foreground">
               Organize properties into groups for comparison
             </p>
           </div>
 
           <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
             <DialogTrigger asChild>
               <Button>
                 <Plus className="mr-2 h-4 w-4" />
                 Create Group
               </Button>
             </DialogTrigger>
             <DialogContent>
               <DialogHeader>
                 <DialogTitle>Create Group</DialogTitle>
               </DialogHeader>
               <form onSubmit={handleCreate} className="space-y-4">
                 <div className="space-y-2">
                   <Label htmlFor="name">Group Name</Label>
                   <Input
                     id="name"
                     name="name"
                     placeholder="e.g., NYC Competitive Set"
                     required
                   />
                 </div>
                 <Button type="submit" className="w-full" disabled={createGroup.isPending}>
                   {createGroup.isPending ? 'Creating...' : 'Create Group'}
                 </Button>
               </form>
             </DialogContent>
           </Dialog>
         </div>
 
         {isLoading ? (
           <div className="animate-pulse text-muted-foreground">Loading groups...</div>
         ) : groups.length === 0 ? (
           <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
             <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
             <h3 className="mt-4 text-lg font-medium">No groups yet</h3>
             <p className="mt-1 text-sm text-muted-foreground">
               Create groups to organize and compare properties.
             </p>
           </div>
         ) : (
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
             {groups.map(group => (
               <GroupCard
                 key={group.id}
                 group={group}
                 onDelete={() => handleDelete(group.id, group.name)}
                 onManage={() => setSelectedGroupId(group.id)}
                 isSelected={selectedGroupId === group.id}
               />
             ))}
           </div>
         )}
 
         {selectedGroupId && (
           <GroupPropertiesManager
             groupId={selectedGroupId}
             allProperties={properties}
             onClose={() => setSelectedGroupId(null)}
           />
         )}
       </div>
     </DashboardLayout>
   );
 }
 
 function GroupCard({
   group,
   onDelete,
   onManage,
   isSelected,
 }: {
   group: { id: string; name: string; created_at: string };
   onDelete: () => void;
   onManage: () => void;
   isSelected: boolean;
 }) {
   const { properties } = useGroupProperties(group.id);
 
   return (
     <Card className={isSelected ? 'ring-2 ring-primary' : ''}>
       <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
         <CardTitle className="text-base font-medium">{group.name}</CardTitle>
         <div className="flex gap-1">
           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onManage}>
             <Settings className="h-4 w-4" />
           </Button>
           <Button
             variant="ghost"
             size="icon"
             className="h-8 w-8 text-destructive hover:text-destructive"
             onClick={onDelete}
           >
             <Trash2 className="h-4 w-4" />
           </Button>
         </div>
       </CardHeader>
       <CardContent>
         <div className="text-2xl font-bold">{properties.length}</div>
         <p className="text-xs text-muted-foreground">
           {properties.length === 1 ? 'property' : 'properties'}
         </p>
         <p className="mt-2 text-xs text-muted-foreground">
           Created {format(new Date(group.created_at), 'MMM d, yyyy')}
         </p>
       </CardContent>
     </Card>
   );
 }
 
 function GroupPropertiesManager({
   groupId,
   allProperties,
   onClose,
 }: {
   groupId: string;
   allProperties: Array<{ id: string; name: string; city: string; state: string }>;
   onClose: () => void;
 }) {
   const { properties: groupProperties, addPropertyToGroup, removePropertyFromGroup } =
     useGroupProperties(groupId);
   const { toast } = useToast();
 
   const groupPropertyIds = new Set(groupProperties.map(p => p.id));
 
   const handleToggle = async (propertyId: string, isInGroup: boolean) => {
     try {
       if (isInGroup) {
         await removePropertyFromGroup.mutateAsync({ groupId, propertyId });
         toast({ title: 'Removed', description: 'Property removed from group.' });
       } else {
         await addPropertyToGroup.mutateAsync({ groupId, propertyId });
         toast({ title: 'Added', description: 'Property added to group.' });
       }
     } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Failed to update group.' });
     }
   };
 
   return (
     <Card>
       <CardHeader className="flex flex-row items-center justify-between">
         <CardTitle className="text-base">Manage Properties</CardTitle>
         <Button variant="ghost" size="sm" onClick={onClose}>
           Done
         </Button>
       </CardHeader>
       <CardContent>
         {allProperties.length === 0 ? (
           <p className="text-sm text-muted-foreground">
             No properties available. Upload or add properties first.
           </p>
         ) : (
           <div className="max-h-64 space-y-2 overflow-y-auto">
             {allProperties.map(property => {
               const isInGroup = groupPropertyIds.has(property.id);
               return (
                 <div
                   key={property.id}
                   className="flex items-center space-x-3 rounded-lg border border-border p-3"
                 >
                   <Checkbox
                     id={property.id}
                     checked={isInGroup}
                     onCheckedChange={() => handleToggle(property.id, isInGroup)}
                   />
                   <label htmlFor={property.id} className="flex-1 cursor-pointer">
                     <div className="font-medium">{property.name}</div>
                     <div className="text-sm text-muted-foreground">
                       {property.city}, {property.state}
                     </div>
                   </label>
                 </div>
               );
             })}
           </div>
         )}
       </CardContent>
     </Card>
   );
 }