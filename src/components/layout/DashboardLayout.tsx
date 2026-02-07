import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Building2, LayoutDashboard, Upload, FolderOpen, LogOut, ChevronRight, Star, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HelpModal } from '@/components/layout/HelpModal';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/insights', label: 'So What?', icon: BarChart3 },
  { href: '/groups', label: 'Groups', icon: FolderOpen },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/kasa', label: 'Kasa', icon: Star },
  { href: '/upload', label: 'Upload', icon: Upload },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-20 items-center gap-3 px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-white">Reputation</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1.5 px-4 py-6">
            {navItems.map(item => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'group flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-sidebar-accent text-white'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </div>
                  {isActive && (
                    <ChevronRight className="h-4 w-4 opacity-60" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-sidebar-border p-5">
            <div className="mb-4 truncate text-sm text-sidebar-foreground/70">
              {user?.email}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 flex-1">
        <div className="flex justify-end px-10 pt-6 pb-0">
          <HelpModal />
        </div>
        <div className="px-10 pb-10 pt-4">
          {children}
        </div>
      </main>
    </div>
  );
}
