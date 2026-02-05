import { useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProperties } from '@/hooks/useProperties';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { parseCSVFile, parseExcelFile } from '@/lib/csv';
import { Upload as UploadIcon, FileSpreadsheet, Check, AlertCircle, CloudUpload } from 'lucide-react';
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-10">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Upload Properties</h1>
          <p className="mt-2 text-muted-foreground">
            Import properties from a CSV or Excel file
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Upload Card */}
          <Card className="shadow-kasa">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <CloudUpload className="h-6 w-6 text-accent" />
                Upload File
              </CardTitle>
              <CardDescription>
                Drag and drop your file or click to browse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`relative rounded-xl border-2 border-dashed p-16 text-center transition-all duration-200 ${
                  isDragging
                    ? 'border-accent bg-accent/5'
                    : 'border-border hover:border-accent/50 hover:bg-muted/30'
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
                  <div className="space-y-5">
                    <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-accent border-t-transparent" />
                    <p className="text-lg font-medium">Processing...</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
                      <UploadIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xl font-medium">
                        Drop your file here
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        or click to browse • CSV and Excel supported
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {result && (
                <div className={`mt-6 rounded-xl p-5 ${
                  result.success > 0 ? 'bg-success/10' : 'bg-destructive/10'
                }`}>
                  {result.success > 0 ? (
                    <div className="flex items-center gap-4 text-success">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20">
                        <Check className="h-5 w-5" />
                      </div>
                      <span className="font-medium">
                        Successfully imported {result.success} properties
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4 text-destructive">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-destructive/20">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Import failed</p>
                        {result.errors.map((error, i) => (
                          <p key={i} className="mt-1 text-sm">{error}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Format Guide Card */}
          <Card className="shadow-kasa">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <FileSpreadsheet className="h-6 w-6 text-accent" />
                File Format
              </CardTitle>
              <CardDescription>
                Required columns: <strong>Hotel Name</strong>, <strong>City</strong>, <strong>State</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-5 py-4 text-left font-semibold">Hotel Name</th>
                      <th className="px-5 py-4 text-left font-semibold">City</th>
                      <th className="px-5 py-4 text-left font-semibold">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border">
                      <td className="px-5 py-4">The Grand Hotel</td>
                      <td className="px-5 py-4">New York</td>
                      <td className="px-5 py-4">NY</td>
                    </tr>
                    <tr className="border-t border-border bg-muted/30">
                      <td className="px-5 py-4">Seaside Resort</td>
                      <td className="px-5 py-4">Miami</td>
                      <td className="px-5 py-4">FL</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-5 py-4">Mountain Lodge</td>
                      <td className="px-5 py-4">Denver</td>
                      <td className="px-5 py-4">CO</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                Column headers must match exactly. Additional columns will be ignored.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
