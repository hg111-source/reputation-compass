 import { useState } from 'react';
 import { Navigate } from 'react-router-dom';
 import { useAuth } from '@/hooks/useAuth';
 import { useProperties } from '@/hooks/useProperties';
 import { DashboardLayout } from '@/components/layout/DashboardLayout';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from '@/components/ui/table';
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
 } from '@/components/ui/dialog';
 import { Label } from '@/components/ui/label';
 import { Plus, Trash2, Building2 } from 'lucide-react';
 import { useToast } from '@/hooks/use-toast';
 import { format } from 'date-fns';
 
 export default function Properties() {
   const { user, loading } = useAuth();
   const { properties, isLoading, createProperty, deleteProperty } = useProperties();
   const { toast } = useToast();
   const [isDialogOpen, setIsDialogOpen] = useState(false);
 
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
     const city = formData.get('city') as string;
     const state = formData.get('state') as string;
 
     try {
       await createProperty.mutateAsync({ name, city, state });
       toast({ title: 'Property created', description: `${name} has been added.` });
       setIsDialogOpen(false);
     } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Failed to create property.' });
     }
   };
 
   const handleDelete = async (id: string, name: string) => {
     try {
       await deleteProperty.mutateAsync(id);
       toast({ title: 'Property deleted', description: `${name} has been removed.` });
     } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete property.' });
     }
   };
 
   return (
     <DashboardLayout>
       <div className="space-y-6">
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-2xl font-semibold">Properties</h1>
             <p className="text-sm text-muted-foreground">
               Manage your hotel and property listings
             </p>
           </div>
 
           <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
             <DialogTrigger asChild>
               <Button>
                 <Plus className="mr-2 h-4 w-4" />
                 Add Property
               </Button>
             </DialogTrigger>
             <DialogContent>
               <DialogHeader>
                 <DialogTitle>Add Property</DialogTitle>
               </DialogHeader>
               <form onSubmit={handleCreate} className="space-y-4">
                 <div className="space-y-2">
                   <Label htmlFor="name">Hotel Name</Label>
                   <Input id="name" name="name" placeholder="The Grand Hotel" required />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label htmlFor="city">City</Label>
                     <Input id="city" name="city" placeholder="New York" required />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="state">State</Label>
                     <Input id="state" name="state" placeholder="NY" required />
                   </div>
                 </div>
                 <Button type="submit" className="w-full" disabled={createProperty.isPending}>
                   {createProperty.isPending ? 'Adding...' : 'Add Property'}
                 </Button>
               </form>
             </DialogContent>
           </Dialog>
         </div>
 
         {isLoading ? (
           <div className="animate-pulse text-muted-foreground">Loading properties...</div>
         ) : properties.length === 0 ? (
           <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
             <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
             <h3 className="mt-4 text-lg font-medium">No properties yet</h3>
             <p className="mt-1 text-sm text-muted-foreground">
               Add properties manually or upload a CSV file.
             </p>
           </div>
         ) : (
           <div className="rounded-lg border border-border bg-card">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Name</TableHead>
                   <TableHead>City</TableHead>
                   <TableHead>State</TableHead>
                   <TableHead>Added</TableHead>
                   <TableHead className="w-[80px]"></TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {properties.map(property => (
                   <TableRow key={property.id}>
                     <TableCell className="font-medium">{property.name}</TableCell>
                     <TableCell>{property.city}</TableCell>
                     <TableCell>{property.state}</TableCell>
                     <TableCell className="text-muted-foreground">
                       {format(new Date(property.created_at), 'MMM d, yyyy')}
                     </TableCell>
                     <TableCell>
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-8 w-8 text-destructive hover:text-destructive"
                         onClick={() => handleDelete(property.id, property.name)}
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </div>
         )}
       </div>
     </DashboardLayout>
   );
 }