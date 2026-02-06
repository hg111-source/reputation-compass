import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGroups } from '@/hooks/useGroups';
import { useProperties } from '@/hooks/useProperties';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GroupDashboard } from '@/components/dashboard/GroupDashboard';
import { AllPropertiesDashboard } from '@/components/dashboard/AllPropertiesDashboard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FolderOpen, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { groups, isLoading: groupsLoading } = useGroups();
  const { properties } = useProperties();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  // Default to "all" once we know there are properties
  useEffect(() => {
    if (!groupsLoading && properties.length > 0) {
      setSelectedGroupId('all');
    }
  }, [groupsLoading, properties.length]);

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

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <DashboardLayout>
      <div className="space-y-10">
        {/* Header */}
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
            {(groups.length > 0 || properties.length > 0) && (
              <Select
                value={selectedGroupId}
                onValueChange={(value) => setSelectedGroupId(value)}
              >
                <SelectTrigger className="h-11 min-w-[220px] rounded-lg border-2 border-primary/20 bg-card font-semibold shadow-kasa hover:border-primary/40 transition-colors">
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-border bg-card shadow-kasa-hover">
                  <SelectItem value="all" className="font-medium">
                    All Properties ({properties.length})
                  </SelectItem>
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id} className="font-medium">
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <p className="mt-2 text-muted-foreground">
            View and track reputation scores across your property groups
          </p>
        </div>

        {groupsLoading ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span>Loading groups...</span>
          </div>
        ) : properties.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-20 text-center shadow-kasa">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-8 text-2xl font-semibold">No properties yet</h3>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Add properties to start tracking your reputation scores.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Button asChild variant="secondary">
                <Link to="/properties">Add Properties</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/upload">Upload CSV</Link>
              </Button>
            </div>
          </div>
        ) : selectedGroupId === 'all' ? (
          <AllPropertiesDashboard />
        ) : selectedGroup ? (
          <GroupDashboard group={selectedGroup} />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card p-20 text-center shadow-kasa">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-8 text-2xl font-semibold">Select a group</h3>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Choose a group from the dropdown above to view reputation scores.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
