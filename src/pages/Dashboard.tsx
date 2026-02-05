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
import { FolderOpen, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { groups, isLoading: groupsLoading } = useGroups();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              View and track reputation scores across your property groups
            </p>
          </div>

          {groups.length > 0 && (
            <Select
              value={selectedGroupId || ''}
              onValueChange={(value) => setSelectedGroupId(value || null)}
            >
              <SelectTrigger className="w-[240px] bg-card shadow-sm">
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent className="bg-card">
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
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Loading groups...</span>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">No groups yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
              Create a group and add properties to start tracking your reputation scores.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button asChild className="bg-accent hover:bg-accent/90">
                <Link to="/groups">Create Group</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/upload">Upload Properties</Link>
              </Button>
            </div>
          </div>
        ) : !selectedGroupId ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">Select a group</h3>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
              Choose a group from the dropdown above to view reputation scores.
            </p>
          </div>
        ) : (
          <GroupDashboard group={selectedGroup!} />
        )}
      </div>
    </DashboardLayout>
  );
}
