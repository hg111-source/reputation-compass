 import { useState, useCallback } from 'react';
 import { Navigate } from 'react-router-dom';
 import { useAuth } from '@/hooks/useAuth';
 import { useProperties } from '@/hooks/useProperties';
 import { DashboardLayout } from '@/components/layout/DashboardLayout';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { parseCSVFile, parseExcelFile } from '@/lib/csv';
 import { Upload as UploadIcon, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
 import { useToast } from '@/hooks/use-toast';
 
 export default function Upload() {
   const { user, loading } = useAuth();
   const { createManyProperties } = useProperties();
   const { toast } = useToast();
   const [isDragging, setIsDragging] = useState(false);
   const [isProcessing, setIsProcessing] = useState(false);
   const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
 
   const processFile = useCallback(async (file: File) => {
     setIsProcessing(true);
     setResult(null);
 
     try {
       let properties;
       if (file.name.endsWith('.csv')) {
         properties = await parseCSVFile(file);
       } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
         properties = await parseExcelFile(file);
       } else {
         throw new Error('Unsupported file format. Please use CSV or Excel files.');
       }
 
       if (properties.length === 0) {
         throw new Error('No valid properties found. Ensure columns: Hotel Name, City, State');
       }
 
       await createManyProperties.mutateAsync(properties);
       setResult({ success: properties.length, errors: [] });
       toast({
         title: 'Upload successful',
         description: `${properties.length} properties have been imported.`,
       });
     } catch (error: any) {
       setResult({ success: 0, errors: [error.message] });
       toast({
         variant: 'destructive',
         title: 'Upload failed',
         description: error.message,
       });
     }
 
     setIsProcessing(false);
   }, [createManyProperties, toast]);
 
   const handleDrop = useCallback((e: React.DragEvent) => {
     e.preventDefault();
     setIsDragging(false);
     const file = e.dataTransfer.files[0];
     if (file) processFile(file);
   }, [processFile]);
 
   const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) processFile(file);
   };
 
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
 
   return (
     <DashboardLayout>
       <div className="space-y-6">
         <div>
           <h1 className="text-2xl font-semibold">Upload Properties</h1>
           <p className="text-sm text-muted-foreground">
             Import properties from a CSV or Excel file
           </p>
         </div>
 
         <Card>
           <CardHeader>
             <CardTitle>File Requirements</CardTitle>
             <CardDescription>
               Your file must include these columns: <strong>Hotel Name</strong>, <strong>City</strong>, <strong>State</strong>
             </CardDescription>
           </CardHeader>
           <CardContent>
             <div
               className={`relative rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
                 isDragging
                   ? 'border-primary bg-primary/5'
                   : 'border-border hover:border-primary/50'
               }`}
               onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
               onDragLeave={() => setIsDragging(false)}
               onDrop={handleDrop}
             >
               <input
                 type="file"
                 accept=".csv,.xlsx,.xls"
                 onChange={handleFileSelect}
                 className="absolute inset-0 cursor-pointer opacity-0"
                 disabled={isProcessing}
               />
               
               {isProcessing ? (
                 <>
                   <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                   <p className="mt-4 text-lg font-medium">Processing...</p>
                 </>
               ) : (
                 <>
                   <UploadIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                   <p className="mt-4 text-lg font-medium">
                     Drop your file here or click to browse
                   </p>
                   <p className="mt-1 text-sm text-muted-foreground">
                     Supports CSV and Excel files
                   </p>
                 </>
               )}
             </div>
 
             {result && (
               <div className={`mt-4 rounded-lg p-4 ${
                 result.success > 0 ? 'bg-success/10' : 'bg-destructive/10'
               }`}>
                 {result.success > 0 ? (
                   <div className="flex items-center gap-2 text-success">
                     <Check className="h-5 w-5" />
                     <span className="font-medium">
                       Successfully imported {result.success} properties
                     </span>
                   </div>
                 ) : (
                   <div className="flex items-start gap-2 text-destructive">
                     <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                     <div>
                       <p className="font-medium">Import failed</p>
                       {result.errors.map((error, i) => (
                         <p key={i} className="text-sm">{error}</p>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
             )}
           </CardContent>
         </Card>
 
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <FileSpreadsheet className="h-5 w-5" />
               Example Format
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="overflow-x-auto rounded-lg border border-border">
               <table className="w-full text-sm">
                 <thead className="bg-muted">
                   <tr>
                     <th className="px-4 py-2 text-left font-medium">Hotel Name</th>
                     <th className="px-4 py-2 text-left font-medium">City</th>
                     <th className="px-4 py-2 text-left font-medium">State</th>
                   </tr>
                 </thead>
                 <tbody>
                   <tr className="border-t border-border">
                     <td className="px-4 py-2">The Grand Hotel</td>
                     <td className="px-4 py-2">New York</td>
                     <td className="px-4 py-2">NY</td>
                   </tr>
                   <tr className="border-t border-border">
                     <td className="px-4 py-2">Seaside Resort</td>
                     <td className="px-4 py-2">Miami</td>
                     <td className="px-4 py-2">FL</td>
                   </tr>
                   <tr className="border-t border-border">
                     <td className="px-4 py-2">Mountain Lodge</td>
                     <td className="px-4 py-2">Denver</td>
                     <td className="px-4 py-2">CO</td>
                   </tr>
                 </tbody>
               </table>
             </div>
           </CardContent>
         </Card>
       </div>
     </DashboardLayout>
   );
 }