 import { useState } from 'react';
 import { Navigate } from 'react-router-dom';
 import { useAuth } from '@/hooks/useAuth';
 import { useGroups } from '@/hooks/useGroups';
 import { DashboardLayout } from '@/components/layout/DashboardLayout';
 import { GroupDashboard } from '@/components/dashboard/GroupDashboard';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { FolderOpen } from 'lucide-react';
 import { Link } from 'react-router-dom';
 import { Button } from '@/components/ui/button';
 
 export default function Dashboard() {
   const { user, loading } = useAuth();
   const { groups, isLoading: groupsLoading } = useGroups();
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
 
   const selectedGroup = groups.find(g => g.id === selectedGroupId);
 
   return (
     <DashboardLayout>
       <div className="space-y-6">
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-2xl font-semibold">Dashboard</h1>
             <p className="text-sm text-muted-foreground">
               View and track reputation scores across your property groups
             </p>
           </div>
 
           {groups.length > 0 && (
             <Select
               value={selectedGroupId || ''}
               onValueChange={(value) => setSelectedGroupId(value || null)}
             >
               <SelectTrigger className="w-[240px]">
                 <SelectValue placeholder="Select a group" />
               </SelectTrigger>
               <SelectContent>
                 {groups.map(group => (
                   <SelectItem key={group.id} value={group.id}>
                     {group.name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           )}
         </div>
 
         {groupsLoading ? (
           <div className="animate-pulse text-muted-foreground">Loading groups...</div>
         ) : groups.length === 0 ? (
           <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
             <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
             <h3 className="mt-4 text-lg font-medium">No groups yet</h3>
             <p className="mt-1 text-sm text-muted-foreground">
               Create a group and add properties to start tracking scores.
             </p>
             <div className="mt-6 flex justify-center gap-4">
               <Button asChild>
                 <Link to="/groups">Create Group</Link>
               </Button>
               <Button variant="outline" asChild>
                 <Link to="/upload">Upload Properties</Link>
               </Button>
             </div>
           </div>
         ) : !selectedGroupId ? (
           <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
             <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
             <h3 className="mt-4 text-lg font-medium">Select a group</h3>
             <p className="mt-1 text-sm text-muted-foreground">
               Choose a group from the dropdown to view scores.
             </p>
           </div>
         ) : (
           <GroupDashboard group={selectedGroup!} />
         )}
       </div>
     </DashboardLayout>
   );
 }